module Ai
  # Extracts 3-6 topical groupings ("o que as pessoas estão falando") from a
  # product's approved reviews. Returns a structured payload the job layer
  # persists as AiSummaryTopic + AiSummaryTopicReview rows.
  #
  # Strategy: feed Claude a numbered list of reviews and ask it to cluster
  # them into 3-6 topics with PT-BR titles + ai_summary + the review row
  # numbers that belong to each. Numbers are 1-indexed against the input
  # array so the model never sees DB UUIDs (cheaper tokens, no PII leak).
  class SummaryTopicsService < BaseService
    JOB_TYPE = "summary_topics".freeze

    # Cap how many reviews we ship to Claude per call. Plenty to find
    # patterns; trims token cost for products with thousands of reviews.
    MAX_REVIEWS_PER_CALL = 80
    MAX_BODY_CHARS       = 600

    # @param product [Product]
    # @return [Array<Hash>] each topic: { title:, ai_summary:, review_ids: [<uuid>...] }
    def call(product)
      reviews = pick_reviews(product)
      return [] if reviews.empty?

      numbered = reviews.each_with_index.map do |r, i|
        body = r.body.to_s.gsub(/\s+/, " ").strip[0, MAX_BODY_CHARS]
        "##{i + 1} (#{r.rating}★): #{body}"
      end.join("\n\n")

      raw = call_claude(
        model: HAIKU,
        system: system_prompt(product),
        messages: [{ role: "user", content: build_user_prompt(product, numbered) }],
        max_tokens: 2048,
      )

      parsed = parse_json_response(raw)
      topics = Array(parsed[:topics])

      topics.first(6).map do |t|
        # `reviews` field is an array of 1-indexed numbers referencing the
        # numbered list above. Translate back to DB UUIDs, ignore invalid.
        idxs = Array(t[:reviews]).map { |n| n.to_i - 1 }.select { |i| i >= 0 && i < reviews.length }
        {
          title:      t[:title].to_s.strip,
          ai_summary: t[:summary].to_s.strip,
          review_ids: idxs.map { |i| reviews[i].id }.uniq,
        }
      end.reject { |t| t[:title].blank? || t[:review_ids].empty? }
    end

    private

    # Pick the reviews most likely to surface meaningful patterns: approved,
    # with substantial bodies, prefer recent + high helpful_count + verified
    # purchase. Cap at MAX_REVIEWS_PER_CALL.
    def pick_reviews(product)
      product.aggregated_reviews
             .where("LENGTH(body) >= ?", 40)
             .order(Arel.sql(
               "is_verified_purchase DESC NULLS LAST, " \
               "helpful_count DESC NULLS LAST, " \
               "created_at DESC"
             ))
             .limit(MAX_REVIEWS_PER_CALL)
             .to_a
    end

    def system_prompt(product)
      <<~PROMPT
        Você é um analista que extrai os tópicos mais recorrentes em avaliações
        de clientes de um produto de e-commerce, em português do Brasil.

        Seu trabalho: ler avaliações reais e identificar 3 a 6 TÓPICOS pontuais
        do que as pessoas estão falando. Cada tópico precisa:

        1. Ter um TÍTULO curto em PT-BR (5 a 8 palavras, frase nominal natural,
           SEM emojis). Ex: "Cabelo fica mais brilhoso", "Demora pra aparecer
           resultado", "Vale o preço cobrado".
        2. Ter um SUMMARY de 1-2 frases descrevendo o consenso dentro do
           tópico, em tom factual e neutro. Ex: "Várias clientes destacam que
           o brilho aparece já no primeiro uso e dura entre lavagens."
        3. Listar os NÚMEROS das avaliações que pertencem ao tópico (1-indexed
           contra a lista que o usuário enviou). Cada avaliação deve estar em
           NO MÁXIMO um tópico.

        Priorize tópicos com pelo menos 3 avaliações. Inclua tópicos negativos
        ou de atenção quando surgirem (não force só elogios).
        Retorne JSON puro, sem markdown, no formato:

        { "topics": [
            { "title": "...", "summary": "...", "reviews": [1, 3, 7] },
            ...
          ]
        }
        #{workspace_voice_context}
      PROMPT
    end

    def build_user_prompt(product, numbered_reviews)
      <<~PROMPT
        Produto: #{product.title}

        Avaliações:

        #{numbered_reviews}

        Extraia 3 a 6 tópicos seguindo o formato JSON solicitado.
      PROMPT
    end
  end
end

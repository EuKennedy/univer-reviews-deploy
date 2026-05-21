module Ai
  class GenerateService < BaseService
    JOB_TYPE = "generate"

    def call(template:, product: nil, count: 3)
      system_prompt = build_system_prompt(product)
      user_content  = build_user_prompt(template, count)

      text = call_claude(
        model: SONNET,
        system: system_prompt,
        max_tokens: 2048,
        messages: [{ role: "user", content: user_content }]
      )

      result = parse_json_response(text)
      variants = result[:variants] || result

      unless variants.is_a?(Array)
        raise "Expected array of variants from AI, got: #{text[0, 200]}"
      end

      variants.first(count).map do |v|
        {
          title:  v[:title],
          body:   v[:body],
          rating: v[:rating] || 5
        }
      end
    end

    # Generate plausible Q&A pairs for a product (questions a buyer might ask,
    # paired with helpful answers a merchant would write). Persisted by the
    # bulk_create_questions endpoint as Question rows.
    #
    # `enriched` is an optional hash of additional product context fetched
    # from the merchant's commerce platform (WooCommerce description,
    # short_description, attributes, categories). With it Claude grounds
    # answers in real product details instead of guessing from the title.
    def generate_qa_pairs(product:, count: 5, language: "pt-BR", enriched: nil)
      enriched_block = build_enriched_context(enriched)

      system_prompt = <<~PROMPT
        You write authentic e-commerce product Q&A pairs in #{language}.
        Each question must sound like a real buyer's pre-purchase doubt.
        Each answer must be concise (1-3 sentences), helpful, accurate to the
        product context. NEVER invent specs that aren't in the product context.
        Vary topics: shipping, usage, application, results, compatibility,
        ingredients/composition, durability, side effects, expectations.

        Return ONLY a JSON object:
        { "pairs": [ { "question": "...", "answer": "..." }, ... ] }
        No markdown, no explanation.#{workspace_voice_context}

        Product context:
        - Name: #{product.title}
        #{"- Handle: #{product.handle}" if product.handle.present?}#{enriched_block}
      PROMPT

      user_content = "Generate #{count} unique Q&A pairs in #{language}."

      text = call_claude(
        model: SONNET,
        system: system_prompt,
        max_tokens: 2048,
        messages: [{ role: "user", content: user_content }]
      )

      result = parse_json_response(text)
      pairs  = result[:pairs] || result

      raise "Expected array of pairs, got: #{text[0, 200]}" unless pairs.is_a?(Array)

      pairs.first(count).map do |p|
        {
          question: p[:question].to_s,
          answer:   p[:answer].to_s
        }
      end
    end

    private

    # Compose a tight block of product details for the Claude prompt. We strip
    # HTML, collapse whitespace, and cap each field to keep token usage sane.
    def build_enriched_context(enriched)
      return "" unless enriched.is_a?(Hash) && enriched.any?

      strip = ->(s, max) {
        return nil if s.nil?
        clean = s.to_s.gsub(/<[^>]+>/, " ").gsub(/\s+/, " ").strip
        clean.length > max ? "#{clean[0, max]}…" : clean
      }

      parts = []
      parts << "- Description: #{strip.call(enriched[:description], 800)}" if enriched[:description].present?
      parts << "- Short description: #{strip.call(enriched[:short_description], 300)}" if enriched[:short_description].present?
      parts << "- Categories: #{Array(enriched[:categories]).join(', ')}" if enriched[:categories].present?
      parts << "- Tags: #{Array(enriched[:tags]).join(', ')}" if enriched[:tags].present?
      parts << "- Attributes: #{Array(enriched[:attributes]).join('; ')}" if enriched[:attributes].present?
      parts << "- Price: #{enriched[:price]}" if enriched[:price].present?
      return "" if parts.empty?
      "\n        Real product details from the merchant's store:\n        #{parts.join("\n        ")}"
    end

    def build_system_prompt(product)
      prompt = <<~PROMPT
        You are a creative writing assistant generating diverse, authentic e-commerce review variants.
        Each variant must be unique in tone, structure, and focus — never copy-paste.
        Reviews must sound like different real customers wrote them.
        Return ONLY a JSON object: { "variants": [ { "title": "...", "body": "...", "rating": 4 }, ... ] }
        No markdown, no explanation, just the JSON.#{workspace_voice_context}
      PROMPT

      if product
        prompt += "\n\nProduct context:\n- Name: #{product.title}"
        prompt += "\n- Handle: #{product.handle}" if product.handle.present?
      end

      prompt
    end

    def build_user_prompt(template, count)
      <<~PROMPT
        Generate #{count} unique review variants inspired by this template:
        ---
        #{template}
        ---
        Each must have a different perspective, length, and focus area.
        Vary between 1-5 star ratings proportionally (mostly positive).
      PROMPT
    end
  end
end

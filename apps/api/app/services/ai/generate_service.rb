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
    def generate_qa_pairs(product:, count: 5, language: "pt-BR")
      system_prompt = <<~PROMPT
        You write authentic e-commerce product Q&A pairs in #{language}.
        Each question must sound like a real buyer's pre-purchase doubt.
        Each answer must be concise (1-3 sentences), helpful, accurate to the
        product context. Vary topics: shipping, sizing/fit, materials, usage,
        compatibility, durability, comparisons.

        Return ONLY a JSON object:
        { "pairs": [ { "question": "...", "answer": "..." }, ... ] }
        No markdown, no explanation.#{workspace_voice_context}

        Product context:
        - Name: #{product.title}
        #{"- Handle: #{product.handle}" if product.handle.present?}
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

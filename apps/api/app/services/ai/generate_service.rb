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

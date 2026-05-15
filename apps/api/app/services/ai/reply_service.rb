module Ai
  class ReplyService < BaseService
    JOB_TYPE = "reply"

    def call(review)
      system_prompt = build_system_prompt
      user_content  = build_user_content(review)

      text = call_claude(
        model: SONNET,
        system: system_prompt,
        max_tokens: 512,
        review_id: review.id,
        messages: [{ role: "user", content: user_content }]
      )

      result = parse_json_response(text)
      reply_body = result[:reply] || text

      { reply: reply_body }
    end

    private

    def build_system_prompt
      <<~PROMPT
        You are a customer support specialist writing on behalf of an online store.
        Write a reply to this customer review. The reply must:
        - Be warm, genuine, and professional
        - Address the specific points raised in the review
        - Thank positive reviewers; empathize with and offer solutions to negative ones
        - Be concise (2-4 sentences for positive, 3-6 for negative)
        - Never be sycophantic or generic
        - Match the customer's language (Portuguese if they wrote in Portuguese)
        Return ONLY a JSON object: { "reply": "the reply text here" }
        #{workspace_voice_context}
      PROMPT
    end

    def build_user_content(review)
      tone = case review.rating
             when 5    then "very positive"
             when 4    then "positive"
             when 3    then "neutral/mixed"
             when 2    then "negative"
             when 1    then "very negative/frustrated"
             end

      <<~CONTENT
        Customer review (#{tone}, #{review.rating}/5 stars):
        #{review.title.present? ? "Title: #{review.title}\n" : ""}Body: #{review.body}
        Author: #{review.author_name || "Anonymous"}
      CONTENT
    end
  end
end

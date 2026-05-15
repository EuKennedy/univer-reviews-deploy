module Ai
  class ModerateService < BaseService
    JOB_TYPE = "moderate"

    SYSTEM_PROMPT = <<~PROMPT.freeze
      You are a review moderation expert for an e-commerce review platform.
      Analyze the given review and return a JSON object with exactly these fields:
      {
        "quality_score": <integer 0-100>,
        "sentiment": <"positive"|"negative"|"neutral"|"mixed">,
        "is_synthetic": <boolean — true if it looks AI-generated or fake>,
        "topics": [<array of topic strings extracted from the review, max 10>],
        "suggestion": <"approve"|"review"|"reject">,
        "reason": <brief explanation of your decision>,
        "flagged_reason": <string or null — specific issue if flagging>
      }

      Guidelines:
      - quality_score: 0=completely spam/fake, 100=highly detailed genuine review
      - Suggest "approve" if score >= 65 and not synthetic and not offensive
      - Suggest "reject" if spam, offensive, synthetic, or score < 20
      - Suggest "review" for borderline cases (score 20-64)
      - is_synthetic: detect templated/AI-generated text, repeated phrases, unnatural language
      - Topics should be product features/aspects mentioned (e.g., "durability", "shipping", "price")
      - Respond ONLY with valid JSON, no markdown fences
    PROMPT

    def call(review)
      text = call_claude(
        model: SONNET,
        system: SYSTEM_PROMPT,
        max_tokens: 512,
        review_id: review.id,
        messages: [{
          role: "user",
          content: build_review_content(review)
        }]
      )

      result = parse_json_response(text)

      # Persist AI fields back to review
      review.update_columns(
        ai_quality_score:  result[:quality_score],
        ai_sentiment:      result[:sentiment],
        ai_topics:         result[:topics] || [],
        ai_is_synthetic:   result[:is_synthetic] || false,
        ai_flagged_reason: result[:flagged_reason],
        updated_at:        Time.current
      )

      result
    rescue => e
      Rails.logger.error("ModerateService failed for review #{review.id}: #{e.message}")
      raise
    end

    private

    def build_review_content(review)
      parts = []
      parts << "Rating: #{review.rating}/5"
      parts << "Title: #{review.title}" if review.title.present?
      parts << "Body: #{review.body}" if review.body.present?
      parts << "Author: #{review.author_name}" if review.author_name.present?
      parts << "Source: #{review.source}"
      parts << "Language: #{review.language}"
      parts << "Has media: #{review.has_media?}"
      parts.join("\n")
    end
  end
end

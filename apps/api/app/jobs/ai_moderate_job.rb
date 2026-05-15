class AiModerateJob < ApplicationJob
  queue_as :ai

  AUTO_APPROVE_QUALITY_THRESHOLD = 70

  def perform(review_id)
    review = Review.find_by(id: review_id)
    return unless review

    set_workspace_rls(review.workspace_id)

    service = Ai::ModerateService.new(review.workspace)
    result  = service.call(review)

    # Auto-approve if quality is high enough and not synthetic
    if should_auto_approve?(result)
      old_status = review.status
      review.update!(status: "approved", approved_at: Time.current)

      if old_status != "approved"
        RewardGrantJob.perform_later(review.id)
      end
    end

    # Also enqueue embedding generation
    AiEmbedJob.perform_later(review.id)
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("AiModerateJob: review #{review_id} not found, skipping")
  rescue => e
    Rails.logger.error("AiModerateJob failed for #{review_id}: #{e.message}")
    raise
  end

  private

  def should_auto_approve?(result)
    quality_score = result[:quality_score].to_i
    is_synthetic  = result[:is_synthetic]
    suggestion    = result[:suggestion]

    quality_score >= AUTO_APPROVE_QUALITY_THRESHOLD &&
      !is_synthetic &&
      suggestion == "approve"
  end
end

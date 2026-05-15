class AiDedupJob < ApplicationJob
  queue_as :ai

  def perform(review_id)
    review = Review.find_by(id: review_id)
    return unless review

    set_workspace_rls(review.workspace_id)

    service = Ai::DedupService.new(review.workspace)

    # Ensure review has an embedding
    service.embed(review) unless review.embedding.present?

    review.reload
    return unless review.embedding.present?

    duplicates = service.find_duplicates(review)

    if duplicates.any?
      service.cluster([review] + duplicates.to_a)
      Rails.logger.info("AiDedupJob: clustered #{duplicates.count + 1} reviews for workspace #{review.workspace_id}")
    end
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("AiDedupJob: review #{review_id} not found")
  end
end

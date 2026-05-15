class AiEmbedJob < ApplicationJob
  queue_as :ai

  def perform(review_id)
    review = Review.find_by(id: review_id)
    return unless review&.body.present?

    set_workspace_rls(review.workspace_id)

    service = Ai::DedupService.new(review.workspace)
    service.embed(review)

    # After embedding, check for duplicates
    duplicates = service.find_duplicates(review)

    if duplicates.any?
      all_reviews = [review] + duplicates.to_a
      service.cluster(all_reviews)
    end
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("AiEmbedJob: review #{review_id} not found")
  end
end

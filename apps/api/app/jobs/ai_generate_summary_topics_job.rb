class AiGenerateSummaryTopicsJob < ApplicationJob
  queue_as :ai

  # Per-product extraction. Idempotent: re-running replaces source='ai'
  # topics for the product but leaves source='manual' topics untouched, so
  # a merchant who curated a custom topic doesn't lose it when they hit
  # "Regenerar".
  def perform(product_id)
    product = Product.find_by(id: product_id)
    return unless product

    set_workspace_rls(product.workspace_id)

    begin
      service = Ai::SummaryTopicsService.new(product.workspace)
    rescue Ai::BaseService::MissingApiKeyError => e
      Rails.logger.warn("AiGenerateSummaryTopicsJob skipped: #{e.message}")
      return
    end

    topics = service.call(product)
    return if topics.empty?

    ActiveRecord::Base.transaction do
      # Clear previous AI-sourced topics for this product. Keep manuals.
      product.ai_summary_topics.where(source: "ai").destroy_all

      next_pos = (product.ai_summary_topics.maximum(:position) || -1) + 1
      topics.each_with_index do |t, idx|
        topic = product.ai_summary_topics.create!(
          workspace:    product.workspace,
          title:        t[:title],
          ai_summary:   t[:ai_summary],
          source:       "ai",
          position:     next_pos + idx,
          generated_at: Time.current,
        )
        topic.attach_reviews!(t[:review_ids])
      end
    end
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("AiGenerateSummaryTopicsJob: product #{product_id} not found")
  rescue => e
    Rails.logger.error("AiGenerateSummaryTopicsJob failed for #{product_id}: #{e.message}")
    raise
  end
end

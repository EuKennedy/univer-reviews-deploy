class AiGenerateSummaryTopicsJob < ApplicationJob
  queue_as :ai

  # Hard ceiling: a single product never carries more than this many AI
  # topics. Manual topics don't count against the cap. Enforced both here
  # (job layer) and in the controller (request layer) so direct enqueues
  # can't bypass the limit.
  MAX_AI_TOPICS_PER_PRODUCT = 5

  # Per-product extraction.
  #
  # `mode: :replace` (default for the initial "Gerar com IA" click) wipes
  # source=ai topics and seeds 1 fresh one. `mode: :append` adds ONE NEW
  # topic to the existing set, telling Claude which titles already exist so
  # it doesn't duplicate. Manual topics are always preserved.
  def perform(product_id, mode: :replace, max_topics: 1)
    product = Product.find_by(id: product_id)
    return unless product

    set_workspace_rls(product.workspace_id)

    mode       = %i[replace append].include?(mode.to_sym) ? mode.to_sym : :replace
    max_topics = max_topics.to_i.clamp(1, 6)

    existing_ai_count = product.ai_summary_topics.where(source: "ai").count

    if mode == :append && existing_ai_count >= MAX_AI_TOPICS_PER_PRODUCT
      Rails.logger.info("AiGenerateSummaryTopicsJob skipped append: product #{product_id} already at cap (#{existing_ai_count})")
      return
    end

    # Append never exceeds the cap. Replace also clamps so a future caller
    # passing max_topics=6 still respects the per-product hard ceiling.
    remaining_slots =
      if mode == :append
        MAX_AI_TOPICS_PER_PRODUCT - existing_ai_count
      else
        MAX_AI_TOPICS_PER_PRODUCT
      end
    return if remaining_slots <= 0

    max_topics = [max_topics, remaining_slots].min

    exclude_titles =
      if mode == :append
        product.ai_summary_topics.where(source: "ai").pluck(:title).compact
      else
        []
      end

    begin
      service = Ai::SummaryTopicsService.new(product.workspace)
    rescue Ai::BaseService::MissingApiKeyError => e
      Rails.logger.warn("AiGenerateSummaryTopicsJob skipped: #{e.message}")
      return
    end

    topics = service.call(product, max_topics: max_topics, exclude_titles: exclude_titles)
    return if topics.empty?

    ActiveRecord::Base.transaction do
      if mode == :replace
        # Wipe previous AI-sourced topics. Manuals stay.
        product.ai_summary_topics.where(source: "ai").destroy_all
      end

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

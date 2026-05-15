class AiCleanupDuplicatesJob < ApplicationJob
  queue_as :ai

  # For each duplicate cluster, generate unique variants and replace synthetic/low-quality duplicates
  def perform(workspace_id:, cluster_ids: [])
    workspace = Workspace.find_by(id: workspace_id)
    return unless workspace

    set_workspace_rls(workspace_id)

    generate_service = Ai::GenerateService.new(workspace)

    clusters = if cluster_ids.any?
                 cluster_ids
               else
                 workspace.reviews.where.not(ai_dup_cluster_id: nil)
                          .group(:ai_dup_cluster_id)
                          .having("COUNT(*) > 1")
                          .pluck(:ai_dup_cluster_id)
                          .first(50)
               end

    clusters.each do |cluster_id|
      cluster_reviews = workspace.reviews.where(ai_dup_cluster_id: cluster_id)
                                         .order(ai_quality_score: :desc)
      next if cluster_reviews.count <= 1

      # Keep the best review; generate variants to replace low-quality duplicates
      best     = cluster_reviews.first
      to_replace = cluster_reviews.offset(1)

      next unless best.body.present?

      variants = generate_service.call(
        template: best.body,
        product: best.product,
        count: [to_replace.count, 5].min
      )

      to_replace.each_with_index do |review, idx|
        variant = variants[idx]
        next unless variant

        review.update!(
          title:          variant[:title] || review.title,
          body:           variant[:body],
          rating:         variant[:rating] || review.rating,
          ai_dup_cluster_id: nil,
          ai_is_synthetic: false
        )
      end

      Rails.logger.info("AiCleanupDuplicatesJob: cleaned cluster #{cluster_id} (#{to_replace.count} variants)")
    rescue => e
      Rails.logger.error("AiCleanupDuplicatesJob cluster #{cluster_id} error: #{e.message}")
    end
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("AiCleanupDuplicatesJob: workspace #{workspace_id} not found")
  end
end

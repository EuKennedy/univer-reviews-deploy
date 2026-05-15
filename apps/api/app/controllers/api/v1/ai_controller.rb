module Api
  module V1
    class AiController < ApplicationController
      # POST /api/v1/ai/moderate
      def moderate
        require_write!

        review_id = params.require(:review_id)
        review = current_workspace.reviews.find(review_id)

        result = Ai::ModerateService.new(current_workspace).call(review)

        render json: { data: result }
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/generate
      def generate
        require_write!

        product_id  = params[:product_id]
        template    = params.require(:template)
        count       = (params[:count] || 3).to_i.clamp(1, 10)

        product = product_id ? current_workspace.products.find(product_id) : nil
        result  = Ai::GenerateService.new(current_workspace).call(template: template, product: product, count: count)

        render json: { data: result }
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/generate-variants
      def generate_variants
        require_write!

        review_id = params.require(:review_id)
        count     = (params[:count] || 3).to_i.clamp(1, 10)
        review    = current_workspace.reviews.find(review_id)

        result = Ai::GenerateService.new(current_workspace).call(
          template: review.body.to_s,
          product: review.product,
          count: count
        )

        render json: { data: result }
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/reply
      def reply
        require_write!

        review_id = params.require(:review_id)
        review    = current_workspace.reviews.find(review_id)

        result = Ai::ReplyService.new(current_workspace).call(review)

        render json: { data: result }
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/auto-reply
      def auto_reply
        require_write!

        review_id = params.require(:review_id)
        review    = current_workspace.reviews.find(review_id)

        result = Ai::ReplyService.new(current_workspace).call(review)

        # Persist as a reply
        reply = review.replies.create!(
          workspace: current_workspace,
          body: result[:reply],
          author_name: current_workspace.name,
          is_ai_generated: true,
          is_published: true
        )

        render json: { data: { reply_id: reply.id, body: reply.body } }
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/ai/duplicates
      def duplicates
        clusters = current_workspace.reviews
                                    .where.not(ai_dup_cluster_id: nil)
                                    .group(:ai_dup_cluster_id)
                                    .count
                                    .sort_by { |_, v| -v }
                                    .first(20)

        render json: {
          data: clusters.map { |cluster_id, count| { cluster_id: cluster_id, count: count } }
        }
      end

      # GET /api/v1/ai/duplicate-clusters
      def duplicate_clusters
        pagy, clusters = paginate(
          current_workspace.reviews
                           .select("ai_dup_cluster_id, COUNT(*) as cluster_count, MIN(created_at) as earliest_at")
                           .where.not(ai_dup_cluster_id: nil)
                           .group(:ai_dup_cluster_id)
                           .order("cluster_count DESC")
        )

        render json: {
          data: clusters.map { |c|
            {
              cluster_id: c.ai_dup_cluster_id,
              count: c.cluster_count,
              earliest_at: c.earliest_at&.iso8601
            }
          },
          meta: pagination_meta(pagy)
        }
      end

      # POST /api/v1/ai/dedup
      def dedup
        require_write!

        review_id = params.require(:review_id)
        review = current_workspace.reviews.find(review_id)

        AiDedupJob.perform_later(review.id)

        render json: { message: "Dedup job queued", review_id: review.id }
      end

      # POST /api/v1/ai/cleanup-duplicates
      def cleanup_duplicates
        require_write!

        cluster_ids = params[:cluster_ids] || []
        AiCleanupDuplicatesJob.perform_later(
          workspace_id: current_workspace.id,
          cluster_ids: cluster_ids
        )

        render json: { message: "Cleanup job queued", clusters: cluster_ids.length }
      end

      # POST /api/v1/ai/embed
      def embed
        require_write!

        review_id = params.require(:review_id)
        review = current_workspace.reviews.find(review_id)

        AiEmbedJob.perform_later(review.id)

        render json: { message: "Embed job queued", review_id: review.id }
      end

      # POST /api/v1/ai/embed-batch
      def embed_batch
        require_write!

        review_ids = params[:review_ids] || current_workspace.reviews.where(embedding: nil).limit(100).pluck(:id)
        review_ids.each { |id| AiEmbedJob.perform_later(id) }

        render json: { message: "Batch embed queued", count: review_ids.length }
      end

      # POST /api/v1/ai/find-similar
      def find_similar
        review_id = params.require(:review_id)
        limit     = (params[:limit] || 10).to_i.clamp(1, 50)
        threshold = (params[:threshold] || 0.85).to_f

        review = current_workspace.reviews.find(review_id)

        unless review.embedding.present?
          render json: { error: "no_embedding", message: "Review has no embedding yet." }, status: :unprocessable_entity
          return
        end

        similar = review.nearest_neighbors(:embedding, distance: "cosine")
                        .where(workspace_id: current_workspace.id)
                        .where.not(id: review.id)
                        .limit(limit)

        render json: {
          data: similar.map { |r|
            {
              id: r.id,
              title: r.title,
              body: r.body&.truncate(200),
              rating: r.rating,
              status: r.status,
              neighbor_distance: r.neighbor_distance
            }
          }
        }
      end
    end
  end
end

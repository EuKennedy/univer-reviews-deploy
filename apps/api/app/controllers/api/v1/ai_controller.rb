module Api
  module V1
    class AiController < ApplicationController
      # GET /api/v1/ai/health
      # No-auth-needed check that ANTHROPIC_API_KEY is present and not the
      # placeholder. Returned as { configured, reason, models } so the admin
      # can render a banner before users hit a 422 on the first action.
      def health
        key = ENV["ANTHROPIC_API_KEY"].to_s
        configured =
          if key.blank?              then [false, "missing"]
          elsif key == "SET_ME_LATER" then [false, "placeholder"]
          else                              [true,  "ok"]
          end

        render json: {
          data: {
            configured: configured[0],
            reason:     configured[1],
            models: {
              sonnet: Ai::BaseService::SONNET,
              haiku:  Ai::BaseService::HAIKU
            }
          }
        }
      end

      # POST /api/v1/ai/moderate
      def moderate
        require_write!

        review_id = params.require(:review_id)
        review = current_workspace.reviews.find(review_id)

        raw = Ai::ModerateService.new(current_workspace).call(review)

        # Normalise the shape so the admin doesn't have to know about the
        # internal Claude JSON. `suggestion` from the prompt is exposed as
        # `recommendation`; `flagged_reason` becomes a single-element array
        # when present, matching the React typings.
        result = {
          review_id:            review.id,
          quality_score:        raw[:quality_score].to_i,
          sentiment:            raw[:sentiment].to_s,
          topics:               Array(raw[:topics]),
          is_synthetic:         raw[:is_synthetic] ? true : false,
          synthetic_confidence: raw[:is_synthetic] ? 0.9 : 0.0,
          moderation_flags:     raw[:flagged_reason].present? ? [raw[:flagged_reason]] : [],
          recommendation:       raw[:suggestion].to_s.presence || "review",
          reason:               raw[:reason]
        }

        render json: { data: result }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
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
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
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
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
      rescue => e
        render json: { error: "ai_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/ai/reply
      def reply
        require_write!

        review_id = params.require(:review_id)
        review    = current_workspace.reviews.find(review_id)

        result = Ai::ReplyService.new(current_workspace).call(review)

        render json: { data: { reply: result[:reply] } }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
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

        # `reply` is the canonical field — admins read result.reply for both
        # /ai/reply (preview only) and /ai/auto-reply (persisted). reply_id
        # surfaces for callers that want to navigate to it.
        render json: { data: { reply: reply.body, reply_id: reply.id } }
      rescue Ai::BaseService::MissingApiKeyError => e
        render json: { error: "missing_api_key", message: e.message }, status: :service_unavailable
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

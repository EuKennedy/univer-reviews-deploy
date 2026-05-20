module Api
  module V1
    module Wp
      class SyncController < ApplicationController
        # GET /api/v1/wp/ping
        # Lightweight auth probe used by the WP plugin's "Testar conexão" button.
        # Returns workspace identity so the plugin can confirm the key + workspace
        # combination resolves to the right tenant.
        def ping
          render json: {
            ok: true,
            workspace: {
              id: current_workspace.id,
              slug: current_workspace.slug,
              name: current_workspace.name,
            },
            ts: Time.current.iso8601,
          }
        end

        # GET /api/v1/wp/reviews
        # Pull endpoint for the WP plugin's bidirectional sync. Returns approved
        # reviews optionally filtered by `since` (ISO 8601) and paginated by
        # `per_page` (max 200). The plugin calls this on a cron to pull
        # SaaS-originated reviews back into WooCommerce comments.
        def reviews
          scope = current_workspace.reviews.where(status: "approved")

          if params[:since].present?
            since = Time.parse(params[:since])
            scope = scope.where("updated_at >= ?", since)
          end

          per_page = [[params[:per_page].to_i, 1].max, 200].min
          per_page = 100 if per_page.zero?
          page     = [params[:page].to_i, 1].max

          reviews = scope.order(updated_at: :desc)
                        .limit(per_page)
                        .offset((page - 1) * per_page)
                        .includes(:product)

          render json: {
            data: reviews.map { |r|
              {
                id:                   r.id,
                external_id:          r.external_id,
                product_external_id:  r.product&.platform_product_id,
                product_name:         r.product&.title,
                author_name:          r.author_name,
                author_email:         r.author_email,
                rating:               r.rating,
                title:                r.title,
                body:                 r.body,
                status:               r.status,
                created_at:           r.created_at&.iso8601,
                updated_at:           r.updated_at&.iso8601,
              }
            },
            meta: {
              page:     page,
              per_page: per_page,
              count:    reviews.size,
            },
          }
        rescue ArgumentError
          render json: { error: "invalid_param", message: "since must be ISO 8601" }, status: :bad_request
        end

        # POST /api/v1/wp/sync
        def sync
          require_write!

          WooCommerceSyncJob.perform_later(current_workspace.id)
          WooCommerceImportJob.perform_later(current_workspace.id, nil)

          render json: { message: "WordPress sync queued (products + reviews)" }
        end

        # PATCH /api/v1/wp/reviews/:id/status
        # WP plugin proxies WordPress comment status changes (approve/hold/spam/trash)
        # into the SaaS via this endpoint. Maps to the same logic as
        # POST /api/v1/reviews/:id/status but accepts PATCH because that's what
        # the plugin sends.
        def update_status
          require_write!

          review = current_workspace.reviews.find(params[:id])
          new_status = params.require(:status)
          valid_statuses = %w[approved rejected hidden spam pending]

          unless valid_statuses.include?(new_status)
            render json: { error: "invalid_status", valid: valid_statuses }, status: :bad_request
            return
          end

          old_status = review.status
          review.update!(
            status: new_status,
            approved_at: new_status == "approved" ? Time.current : review.approved_at
          )

          if new_status == "approved" && old_status != "approved"
            RewardGrantJob.perform_later(review.id)
          end

          AuditLog.record(
            workspace: current_workspace,
            action: "review.status_changed_from_wp",
            entity: review,
            metadata: { from: old_status, to: new_status },
            request: request
          )

          render json: { data: { id: review.id, status: review.status } }
        end

        # POST /api/v1/wp/reviews/:id/reply
        # WP plugin pushes admin replies authored in WordPress (parent_id =
        # the review comment, content = the reply body) back to the SaaS.
        def add_reply
          require_write!

          review = current_workspace.reviews.find(params[:id])

          body = params.require(:body).to_s[0, 4_000]
          if body.blank?
            render json: { error: "missing_body" }, status: :bad_request
            return
          end

          author_name = params[:author_name].to_s[0, 120].presence || "Suporte"

          reply = review.replies.create!(
            workspace:    current_workspace,
            body:         body,
            author_name:  author_name,
            is_ai_generated: false,
            is_published: true
          )

          AuditLog.record(
            workspace: current_workspace,
            action: "review.reply_added_from_wp",
            entity: review,
            metadata: { reply_id: reply.id },
            request: request
          )

          render json: { data: { id: reply.id, review_id: review.id } }, status: :created
        end
      end
    end
  end
end

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
      end
    end
  end
end

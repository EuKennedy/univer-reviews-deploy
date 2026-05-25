module Api
  module V1
    module Public
      class VideosController < ApplicationController
        skip_before_action :set_current_workspace
        before_action :resolve_workspace

        # GET /api/v1/public/videos/:product_id
        def index
          product = resolve_product(params[:product_id])
          # No videos for products that don't exist — return empty rather
          # than 404 so the storefront widget can render gracefully without
          # showing an error alert.
          unless product
            return render json: { data: [] }
          end

          # Fan out to grouped products so variants share the same video wall.
          product_ids = product.review_scope_product_ids
          videos = ReviewMedium.joins(:review)
                               .where(type: "video")
                               .where(reviews: { product_id: product_ids, status: "approved", workspace_id: @workspace.id })
                               .order("review_media.created_at DESC")
                               .limit(20)

          render json: {
            data: videos.map { |v|
              {
                id: v.id, url: v.url, thumb_url: v.thumb_url,
                duration_sec: v.duration_sec,
                review: {
                  id: v.review.id, rating: v.review.rating,
                  author_name: v.review.author_name
                }
              }
            }
          }
        end

        private

        # Mirror of Public::ReviewsController#resolve_product — accepts our
        # internal UUID, the product handle/slug, or the storefront's native
        # platform_product_id (e.g. the WooCommerce post ID).
        def resolve_product(identifier)
          ident = identifier.to_s
          return nil if ident.blank?

          if ident.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
            p = @workspace.products.find_by(id: ident)
            return p if p
          end
          p = @workspace.products.find_by(handle: ident)
          return p if p
          @workspace.products.find_by(platform_product_id: ident)
        end

        def resolve_workspace
          domain_header = request.headers["X-Univer-Domain"] ||
                          request.headers["Origin"]&.gsub(/https?:\/\//, "")&.split("/")&.first

          domain_record = WorkspaceDomain.find_by(domain: domain_header&.downcase&.strip)

          unless domain_record
            render json: { error: "workspace_not_found" }, status: :not_found
            return
          end

          @workspace = domain_record.workspace
          set_rls_workspace(@workspace.id)
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

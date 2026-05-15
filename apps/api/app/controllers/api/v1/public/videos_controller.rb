module Api
  module V1
    module Public
      class VideosController < ApplicationController
        skip_before_action :set_current_workspace
        before_action :resolve_workspace

        # GET /api/v1/public/videos/:product_id
        def index
          product = @workspace.products.find(params[:product_id])

          videos = ReviewMedium.joins(:review)
                               .where(type: "video")
                               .where(reviews: { product_id: product.id, status: "approved", workspace_id: @workspace.id })
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
        rescue ActiveRecord::RecordNotFound
          render json: { error: "not_found" }, status: :not_found
        end

        private

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

module Api
  module V1
    module Public
      class ReviewsController < ApplicationController
        skip_before_action :set_current_workspace
        before_action :resolve_workspace

        RATE_LIMIT_SUBMIT = 5 # submissions per IP per hour

        # GET /api/v1/public/reviews/:product_id
        def index
          product = @workspace.products.find_by!(id: params[:product_id]) rescue
                    @workspace.products.find_by!(handle: params[:product_id])

          scope = product.reviews.approved
                         .includes(:review_media, :replies)

          # Sorting
          sort = params[:sort] == "rating" ? "rating" : "created_at"
          dir  = params[:dir] == "asc" ? :asc : :desc
          scope = scope.order(sort => dir)

          scope = scope.where(rating: params[:rating].to_i) if params[:rating].present?
          scope = scope.where(ai_sentiment: params[:sentiment]) if params[:sentiment].present?

          pagy, reviews = pagy(scope, page: params[:page], limit: [(params[:per_page] || 20).to_i, 100].min)

          render json: {
            data: reviews.map { |r| public_serialize(r) },
            meta: {
              current_page: pagy.page,
              total_pages: pagy.pages,
              total_count: pagy.count,
              per_page: pagy.limit
            }
          }
        rescue ActiveRecord::RecordNotFound
          render json: { error: "not_found" }, status: :not_found
        end

        # GET /api/v1/public/summary/:product_id
        def summary
          product = @workspace.products.find(params[:product_id])
          approved = product.reviews.approved

          total = approved.count
          avg   = approved.average(:rating)&.round(2) || 0.0

          dist  = (1..5).map { |r|
            count = approved.where(rating: r).count
            { rating: r, count: count, percentage: total.positive? ? (count.to_f / total * 100).round(1) : 0.0 }
          }

          render json: {
            data: {
              product_id: product.id,
              total_reviews: total,
              avg_rating: avg,
              rating_distribution: dist,
              featured: approved.where(is_featured: true).limit(3).map { |r| public_serialize(r) }
            }
          }
        rescue ActiveRecord::RecordNotFound
          render json: { error: "not_found" }, status: :not_found
        end

        # POST /api/v1/public/submit
        def submit
          if rate_limited?
            render json: { error: "rate_limited", message: "Too many submissions. Try again later." },
                   status: :too_many_requests
            return
          end

          product_id = params.require(:product_id)
          product    = @workspace.products.find(product_id)

          review = @workspace.reviews.new(
            product: product,
            rating:       submit_params[:rating],
            title:        submit_params[:title],
            body:         submit_params[:body],
            author_name:  submit_params[:author_name],
            author_email: submit_params[:author_email]&.downcase,
            source:       "widget",
            status:       "pending",
            ip_address:   request.remote_ip,
            user_agent:   request.user_agent,
            language:     @workspace.default_locale
          )

          if review.save
            set_rls_workspace(@workspace.id)
            AiModerateJob.perform_later(review.id)

            render json: {
              data: { id: review.id, status: review.status, message: "Review submitted and pending moderation." }
            }, status: :created
          else
            render json: {
              error: "unprocessable_entity",
              issues: review.errors.full_messages
            }, status: :unprocessable_entity
          end
        rescue ActiveRecord::RecordNotFound
          render json: { error: "not_found" }, status: :not_found
        end

        private

        def resolve_workspace
          domain_header = request.headers["X-Univer-Domain"] ||
                          request.headers["Origin"]&.gsub(/https?:\/\//, "")&.split("/")&.first

          if domain_header.blank?
            render json: { error: "domain_required", message: "X-Univer-Domain header required" }, status: :bad_request
            return
          end

          domain_record = WorkspaceDomain.find_by(domain: domain_header.downcase.strip)

          unless domain_record
            render json: { error: "workspace_not_found" }, status: :not_found
            return
          end

          @workspace = domain_record.workspace

          raise UnauthorizedError if @workspace.suspended?

          set_rls_workspace(@workspace.id)
        end

        def rate_limited?
          key   = "submit_rl:#{request.remote_ip}"
          redis = Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"))
          count = redis.incr(key)
          redis.expire(key, 3600) if count == 1
          count > RATE_LIMIT_SUBMIT
        rescue
          false # fail open if Redis is down
        end

        def submit_params
          params.permit(:product_id, :rating, :title, :body, :author_name, :author_email)
        end

        def public_serialize(review)
          {
            id: review.id,
            rating: review.rating,
            title: review.title,
            body: review.body,
            author_name: review.author_name,
            is_verified_purchase: review.is_verified_purchase,
            is_featured: review.is_featured,
            language: review.language,
            created_at: review.created_at&.iso8601,
            media: review.review_media.map { |m|
              { type: m.type, url: m.url, thumb_url: m.thumb_url }
            },
            replies: review.replies.published.map { |r|
              { body: r.body, author_name: r.author_name, created_at: r.created_at&.iso8601 }
            }
          }
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

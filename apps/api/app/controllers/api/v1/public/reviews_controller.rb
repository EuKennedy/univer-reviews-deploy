module Api
  module V1
    module Public
      class ReviewsController < ApplicationController
        skip_before_action :set_current_workspace
        before_action :resolve_workspace

        RATE_LIMIT_SUBMIT = 5 # submissions per IP per hour

        # GET /api/v1/public/reviews/:product_id
        # `:product_id` accepts our internal UUID, the product handle/slug,
        # OR the storefront's native platform_product_id (e.g. WooCommerce
        # numeric ID) — covers the three ways shortcode authors might pass it.
        def index
          product = resolve_product(params[:product_id])
          raise ActiveRecord::RecordNotFound unless product

          scope = product.reviews.approved
                         .includes(:review_media, :replies)

          # Filters
          scope = scope.where(rating: params[:rating].to_i)        if params[:rating].present?
          scope = scope.where(ai_sentiment: params[:sentiment])    if params[:sentiment].present?
          scope = scope.with_photo                                 if truthy?(params[:with_photo])
          scope = scope.with_video                                 if truthy?(params[:with_video])
          scope = scope.with_media                                 if truthy?(params[:with_media])
          scope = scope.verified                                   if truthy?(params[:verified])
          scope = scope.by_country(params[:country].to_s.upcase)   if params[:country].present?
          scope = scope.search_body(params[:q])                    if params[:q].present?

          # Sorting
          case params[:sort]
          when "helpful"  then scope = scope.most_helpful
          when "rating"   then scope = scope.order(rating: params[:dir] == "asc" ? :asc : :desc)
          when "oldest"   then scope = scope.order(created_at: :asc)
          else                  scope = scope.order(created_at: :desc)
          end

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
          product = resolve_product(params[:product_id])
          raise ActiveRecord::RecordNotFound unless product
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

        # GET /api/v1/public/featured
        # Workspace-wide featured reviews (no product scoping). Used by the
        # [univer_featured_reviews] shortcode for landing-page social proof.
        def featured
          limit      = [(params[:limit] || 30).to_i, 100].min
          min_rating = (params[:min_rating] || 4).to_i.clamp(1, 5)

          scope = @workspace.reviews.approved
                            .where("rating >= ?", min_rating)
                            .includes(:review_media, :replies, :product)

          scope = scope.featured if truthy?(params[:featured_only])

          scope = case params[:sort]
                  when "helpful" then scope.most_helpful
                  when "rating"  then scope.order(rating: :desc, created_at: :desc)
                  else scope.order(created_at: :desc)
                  end

          reviews = scope.limit(limit)

          render json: {
            data: reviews.map { |r|
              public_serialize(r).merge(
                product: r.product && {
                  id: r.product.id,
                  title: r.product.title,
                  handle: r.product.handle,
                  image_url: r.product.image_url
                }
              )
            },
            meta: { total: reviews.length, limit: limit, min_rating: min_rating }
          }
        end

        # POST /api/v1/public/reviews/:id/helpful
        def helpful
          review = @workspace.reviews.approved.find(params[:id])
          if truthy?(params[:undo])
            review.decrement!(:helpful_count) if review.helpful_count.to_i.positive?
          else
            review.mark_helpful!
          end
          render json: { data: { id: review.id, helpful_count: review.helpful_count, unhelpful_count: review.unhelpful_count } }
        rescue ActiveRecord::RecordNotFound
          render json: { error: "not_found" }, status: :not_found
        end

        # POST /api/v1/public/reviews/:id/unhelpful
        def unhelpful
          review = @workspace.reviews.approved.find(params[:id])
          if truthy?(params[:undo])
            review.decrement!(:unhelpful_count) if review.unhelpful_count.to_i.positive?
          else
            review.mark_unhelpful!
          end
          render json: { data: { id: review.id, helpful_count: review.helpful_count, unhelpful_count: review.unhelpful_count } }
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
          product    = resolve_product(product_id)
          raise ActiveRecord::RecordNotFound unless product

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
            attach_media!(review)
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

        # Persist uploaded photos / videos onto MinIO via StorageService and
        # link them to the just-created review. Silently skips failures so a
        # bad file does not lose the review itself.
        def attach_media!(review)
          uploads = Array(params[:media])
          return if uploads.empty?

          storage = StorageService.new
          uploads.first(5).each do |file|
            next unless file.respond_to?(:tempfile) && file.respond_to?(:content_type)
            kind = file.content_type.to_s.start_with?("video/") ? "video" : "image"
            next if file.size.to_i > 25 * 1024 * 1024 # 25 MB ceiling

            key = storage.review_media_key(@workspace.id, review.id, file.original_filename)
            url = storage.upload(
              key: key,
              body: file.tempfile,
              content_type: file.content_type,
              public: true,
            )

            ReviewMedium.create!(
              workspace: @workspace,
              review: review,
              type: kind,
              storage_key: key,
              url: url,
              thumb_url: url,
            )
          rescue => e
            Rails.logger.warn("[review-media] upload failed: #{e.class}: #{e.message}")
          end
        end

        # Lookup a product by UUID, handle/slug, or platform_product_id.
        def resolve_product(identifier)
          ident = identifier.to_s
          return nil if ident.blank?

          # UUID first (cheapest; only attempts lookup if format matches)
          if ident.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
            p = @workspace.products.find_by(id: ident)
            return p if p
          end
          # Then handle / slug
          p = @workspace.products.find_by(handle: ident)
          return p if p
          # Finally platform-native id (WC numeric id, Shopify gid, etc.)
          @workspace.products.find_by(platform_product_id: ident)
        end

        def resolve_workspace
          domain_header = request.headers["X-Univer-Domain"] ||
                          request.headers["Origin"]&.gsub(/https?:\/\//, "")&.split("/")&.first

          if domain_header.blank?
            render json: { error: "domain_required", message: "X-Univer-Domain header required" }, status: :bad_request
            return
          end

          domain_record = find_workspace_domain(domain_header)

          unless domain_record
            render json: { error: "workspace_not_found", host: domain_header },
                   status: :not_found
            return
          end

          @workspace = domain_record.workspace

          raise UnauthorizedError if @workspace.suspended?

          set_rls_workspace(@workspace.id)
        end

        # Look up a workspace domain with progressive fallbacks:
        #   exact → strip port → strip www. → strip leading subdomains.
        # Lets a single registered apex (lizzon.com.br) cover staging.lizzon.com.br,
        # www.lizzon.com.br, etc. without forcing the admin to register every variant.
        def find_workspace_domain(raw)
          host = raw.to_s.downcase.strip.sub(/^https?:\/\//, "").split("/").first.to_s
          host = host.split(":").first # strip port

          candidates = []
          candidates << host
          candidates << host.sub(/^www\./, "") if host.start_with?("www.")

          # Walk up subdomains: staging.lizzon.com.br → lizzon.com.br
          parts = host.split(".")
          while parts.length > 2
            parts.shift
            candidates << parts.join(".")
          end

          candidates.uniq.each do |c|
            d = WorkspaceDomain.find_by(domain: c)
            return d if d
          end
          nil
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
            author_country: review.author_country,
            is_verified_purchase: review.is_verified_purchase,
            is_featured: review.is_featured,
            helpful_count: review.helpful_count.to_i,
            unhelpful_count: review.unhelpful_count.to_i,
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

        def truthy?(val)
          %w[true 1 yes].include?(val.to_s.downcase)
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

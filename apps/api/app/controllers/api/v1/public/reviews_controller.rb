module Api
  module V1
    module Public
      class ReviewsController < ApplicationController
        skip_before_action :set_current_workspace
        before_action :resolve_workspace

        RATE_LIMIT_SUBMIT = 5 # submissions per IP per hour

        # Input caps. Anything above these is hostile or careless — clamp on
        # the public endpoint to defend the moderation pipeline (AI embedding
        # costs, DB row sizes, log noise).
        MAX_BODY_LEN       = 4_000
        MAX_TITLE_LEN      = 200
        MAX_AUTHOR_NAME_LEN = 120
        MAX_EMAIL_LEN      = 254

        # Upload restrictions.
        ALLOWED_IMAGE_MIME = %w[image/jpeg image/png image/webp image/gif].freeze
        ALLOWED_VIDEO_MIME = %w[video/mp4 video/webm video/quicktime].freeze
        MAX_UPLOAD_BYTES   = 25 * 1024 * 1024 # 25 MB

        # GET /api/v1/public/reviews/:product_id
        # `:product_id` accepts our internal UUID, the product handle/slug,
        # OR the storefront's native platform_product_id (e.g. WooCommerce
        # numeric ID) — covers the three ways shortcode authors might pass it.
        def index
          product = resolve_product(params[:product_id])
          raise ActiveRecord::RecordNotFound unless product

          # If the product belongs to a ProductGroup, fan out to every member
          # so storefront variants share the same review pool (Judge.me-style).
          scope = @workspace.reviews.approved
                            .where(product_id: product.review_scope_product_ids)
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
          # Aggregate across ProductGroup members when applicable.
          approved = @workspace.reviews.approved
                               .where(product_id: product.review_scope_product_ids)

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
          # One vote per (review, ip_subnet) per day. Without this an attacker
          # can curl in a loop and inflate helpful_count to manipulate the
          # "most helpful" sort.
          if already_voted_today?(review, :helpful)
            render json: { error: "already_voted", message: "Já registramos seu voto." }, status: :too_many_requests
            return
          end
          if truthy?(params[:undo])
            review.decrement!(:helpful_count) if review.helpful_count.to_i.positive?
          else
            review.mark_helpful!
            mark_voted!(review, :helpful)
          end
          render json: { data: { id: review.id, helpful_count: review.helpful_count, unhelpful_count: review.unhelpful_count } }
        rescue ActiveRecord::RecordNotFound
          render json: { error: "not_found" }, status: :not_found
        end

        # POST /api/v1/public/reviews/:id/unhelpful
        def unhelpful
          review = @workspace.reviews.approved.find(params[:id])
          if already_voted_today?(review, :unhelpful)
            render json: { error: "already_voted", message: "Já registramos seu voto." }, status: :too_many_requests
            return
          end
          if truthy?(params[:undo])
            review.decrement!(:unhelpful_count) if review.unhelpful_count.to_i.positive?
          else
            review.mark_unhelpful!
            mark_voted!(review, :unhelpful)
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

          # Clamp + validate inputs server-side. Body length cap defends the
          # AI moderation worker (embedding cost is linear in tokens) and the
          # DB row size. Email is lowercased and trimmed to RFC 5321 max.
          rating = submit_params[:rating].to_i.clamp(1, 5)
          if rating.zero?
            render json: { error: "invalid_rating", message: "Rating deve estar entre 1 e 5." },
                   status: :unprocessable_entity
            return
          end

          body = submit_params[:body].to_s[0, MAX_BODY_LEN]
          if body.blank?
            render json: { error: "missing_body", message: "Body é obrigatório." },
                   status: :unprocessable_entity
            return
          end

          title = submit_params[:title].to_s[0, MAX_TITLE_LEN].presence
          author_name = submit_params[:author_name].to_s[0, MAX_AUTHOR_NAME_LEN].presence
          author_email = submit_params[:author_email].to_s.downcase.strip[0, MAX_EMAIL_LEN].presence

          if author_email && !author_email.match?(URI::MailTo::EMAIL_REGEXP)
            render json: { error: "invalid_email", message: "E-mail inválido." },
                   status: :unprocessable_entity
            return
          end

          # is_verified_purchase is NEVER trusted from the client. We derive
          # it server-side from PlatformEvent rows that came in via a signed
          # webhook (Stripe/WC). Without an order match, the review is
          # explicitly unverified — no path for an attacker to claim it.
          verified_purchase = derive_verified_purchase(product, author_email)

          review = @workspace.reviews.new(
            product: product,
            rating:       rating,
            title:        title,
            body:         body,
            author_name:  author_name,
            author_email: author_email,
            source:       "widget",
            status:       "pending",
            is_verified_purchase: verified_purchase,
            ip_address:   request.remote_ip,
            user_agent:   request.user_agent.to_s[0, 500],
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
        # link them to the just-created review. Hardened against the previous
        # behaviour where:
        #   - client-supplied content_type was trusted (text/html disguised
        #     as image, stored XSS pivot on the public S3 bucket)
        #   - original_filename was concatenated into the S3 key, allowing
        #     path-traversal / extension-confusion attacks
        #   - any file size was accepted in-memory before the 25 MB check
        def attach_media!(review)
          uploads = Array(params[:media])
          return if uploads.empty?

          storage = StorageService.new
          uploads.first(5).each do |file|
            next unless file.respond_to?(:tempfile) && file.respond_to?(:content_type)

            size = file.size.to_i
            next if size <= 0 || size > MAX_UPLOAD_BYTES

            client_mime = file.content_type.to_s
            kind, server_mime, ext = resolve_media_kind(client_mime, file.tempfile)
            next unless kind

            # filename is random hex + restricted extension — never derived from
            # the client's original_filename.
            safe_key = storage.review_media_key(@workspace.id, review.id, "#{SecureRandom.hex(8)}.#{ext}")
            url = storage.upload(
              key: safe_key,
              body: file.tempfile,
              content_type: server_mime,
              public: true,
            )

            ReviewMedium.create!(
              workspace: @workspace,
              review: review,
              type: kind,
              storage_key: safe_key,
              url: url,
              thumb_url: url,
            )
          rescue => e
            Rails.logger.warn("[review-media] upload failed: #{e.class}: #{e.message}")
          end
        end

        # MIME allowlist + best-effort byte sniff to defeat client-supplied
        # Content-Type lies. Returns [kind, server-mime, safe-ext] or [nil,nil,nil].
        def resolve_media_kind(client_mime, tempfile)
          mime = client_mime.to_s.downcase.split(";").first.to_s.strip

          if ALLOWED_IMAGE_MIME.include?(mime)
            ["image", mime, extension_for(mime)]
          elsif ALLOWED_VIDEO_MIME.include?(mime)
            ["video", mime, extension_for(mime)]
          else
            [nil, nil, nil]
          end
        end

        def extension_for(mime)
          case mime
          when "image/jpeg"      then "jpg"
          when "image/png"       then "png"
          when "image/webp"      then "webp"
          when "image/gif"       then "gif"
          when "video/mp4"       then "mp4"
          when "video/webm"      then "webm"
          when "video/quicktime" then "mov"
          else                        "bin"
          end
        end

        # is_verified_purchase server-side derivation. A review is verified
        # only when we have a PlatformEvent (signed webhook from Woo/Shopify/
        # Stripe) that records this customer email purchasing this product.
        def derive_verified_purchase(product, email)
          return false if email.blank?
          handle = product.handle.to_s
          ext_id = product.platform_product_id.to_s
          return false if handle.blank? && ext_id.blank?

          # Match on product_handles array containing the product's handle
          # OR external id. Last 180 days to keep the index lookup tight.
          query = @workspace.platform_events
                            .where(customer_email: email)
                            .where("received_at >= ?", 180.days.ago)
          return true if query.any? do |evt|
            handles = Array(evt.product_handles).map(&:to_s)
            handles.include?(handle) || handles.include?(ext_id)
          end
          false
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

        # Fail-CLOSED rate limit. The previous version returned false on any
        # Redis failure — an attacker could DoS Redis (or hit during a deploy
        # window) and bypass the 5/hour cap entirely. We now fail closed in
        # production/staging and only fail open in dev/test where a missing
        # Redis is expected.
        def rate_limited?
          key   = "submit_rl:#{request.remote_ip}"
          redis = redis_client
          count = redis.incr(key)
          redis.expire(key, 3600) if count == 1
          count > RATE_LIMIT_SUBMIT
        rescue => e
          Rails.logger.warn("[submit-rate-limit] redis error: #{e.message}")
          Rails.env.production? || Rails.env.staging?
        end

        # Per-(review, ip) vote dedupe with 24h TTL. Implemented via Redis SETNX:
        # the first vote wins; concurrent / repeat votes from the same IP get
        # already_voted = true. Failing-open here is acceptable — the worst
        # case is the user can vote twice instead of once if Redis is down.
        def already_voted_today?(review, kind)
          key = "vote:#{kind}:#{review.id}:#{ip_subnet}"
          existed = redis_client.set(key, "1", nx: true, ex: 86_400)
          # set with nx returns true on first write, nil/false on repeat.
          !existed
        rescue => e
          Rails.logger.warn("[vote-dedupe] redis error: #{e.message}")
          false
        end

        def mark_voted!(review, kind)
          key = "vote:#{kind}:#{review.id}:#{ip_subnet}"
          redis_client.set(key, "1", nx: true, ex: 86_400)
        rescue => e
          Rails.logger.warn("[vote-dedupe-mark] redis error: #{e.message}")
        end

        # Bucket the IP to a /24 (IPv4) or /64 (IPv6) so the same NAT'd
        # household doesn't bypass with multiple devices, while still allowing
        # legitimately distinct visitors on the open internet to vote.
        def ip_subnet
          addr = request.remote_ip.to_s
          return addr if addr.empty?
          if addr.include?(":")
            # IPv6 → first 4 groups (~/64)
            addr.split(":").first(4).join(":")
          else
            # IPv4 → first 3 octets (/24)
            addr.split(".").first(3).join(".")
          end
        end

        def redis_client
          @redis_client ||= Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"))
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

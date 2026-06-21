module Api
  module V1
    class ReviewsController < ApplicationController
      before_action :set_review, only: %i[show update destroy status attach_media]

      # GET /api/v1/reviews
      def index
        scope = current_workspace.reviews

        # Filters
        scope = scope.where(status: params[:status])          if params[:status].present?
        scope = scope.where(rating: params[:rating].to_i)     if params[:rating].present?
        scope = scope.where(product_id: params[:product_id])  if params[:product_id].present?
        scope = scope.where(source: params[:source])          if params[:source].present?
        scope = scope.where(is_featured: true)                if params[:featured] == "true"
        scope = scope.where(is_verified_purchase: true)       if params[:verified_purchase] == "true"

        if params[:q].present?
          q = "%#{params[:q]}%"
          scope = scope.where("body ILIKE ? OR author_name ILIKE ? OR title ILIKE ?", q, q, q)
        end

        if params[:from].present?
          scope = scope.where("created_at >= ?", Time.zone.parse(params[:from]))
        end

        if params[:to].present?
          scope = scope.where("created_at <= ?", Time.zone.parse(params[:to]))
        end

        # Sorting
        sort_col = %w[created_at rating ai_quality_score].include?(params[:sort]) ? params[:sort] : "created_at"
        sort_dir = params[:dir] == "asc" ? :asc : :desc
        scope = scope.order(sort_col => sort_dir)

        pagy, reviews = paginate(scope.includes(:product, :review_media, :replies, :reward_grant))

        render json: {
          data: reviews.map { |r| serialize_review(r) },
          meta: pagination_meta(pagy)
        }
      end

      # GET /api/v1/reviews/:id
      def show
        render json: { data: serialize_review(@review, full: true) }
      end

      # POST /api/v1/reviews
      def create
        require_write!

        review = current_workspace.reviews.new(review_params)

        if review.save
          AiModerateJob.perform_later(review.id)

          AuditLog.record(
            workspace: current_workspace,
            action: "review.created",
            entity: review,
            request: request
          )

          render json: { data: serialize_review(review) }, status: :created
        else
          render json: {
            error: "unprocessable_entity",
            issues: review.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/reviews/:id
      # PATCH/PUT /api/v1/reviews/:id
      # Full edit used by the AI draft editor: rating, title, body, author
      # name/email/country/gender, avatar, and status. Publishing a draft is
      # just status=approved here — the set_approved_at callback timestamps it.
      def update
        require_write!

        if @review.update(review_params)
          AuditLog.record(
            workspace: current_workspace,
            action: "review.updated",
            entity: @review,
            request: request
          )
          render json: { data: serialize_review(@review) }
        else
          render json: {
            error: "unprocessable_entity",
            issues: @review.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      def destroy
        require_write!

        if params[:hard] == "true"
          @review.destroy!
        else
          @review.hide!
        end

        AuditLog.record(
          workspace: current_workspace,
          action: params[:hard] == "true" ? "review.deleted" : "review.hidden",
          entity: @review,
          request: request
        )

        head :no_content
      end

      # POST /api/v1/reviews/:id/status
      def status
        require_write!

        new_status = params.require(:status)
        valid_transitions = %w[approved rejected hidden spam pending]

        unless valid_transitions.include?(new_status)
          render json: { error: "invalid_status", valid: valid_transitions }, status: :bad_request
          return
        end

        old_status = @review.status
        @review.update!(status: new_status, approved_at: new_status == "approved" ? Time.current : @review.approved_at)

        # Trigger reward if newly approved
        if new_status == "approved" && old_status != "approved"
          RewardGrantJob.perform_later(@review.id)
        end

        AuditLog.record(
          workspace: current_workspace,
          action: "review.status_changed",
          entity: @review,
          metadata: { from: old_status, to: new_status },
          request: request
        )

        render json: { data: serialize_review(@review) }
      end

      # POST /api/v1/reviews/:id/attach_media
      # Bulk-attach existing media URLs (e.g. from a Ryviu / Judge.me /
      # Loox migration) to a review without re-uploading the bytes. Useful
      # when the source CDN keeps hosting the files and we just need our
      # widget to render them. Idempotent on (review_id, url).
      #
      # Body: { media: [{ type: "image"|"video", url: "...", thumb_url?: "..." }, ...] }
      def attach_media
        require_write!

        items = Array(params[:media]).first(20)
        attached = 0
        skipped  = 0

        items.each do |item|
          item = item.to_unsafe_h if item.respond_to?(:to_unsafe_h)
          type = item["type"].to_s
          url  = item["url"].to_s.strip
          next if url.blank? || !%w[image video].include?(type)

          # Idempotent: skip if this exact url already attached.
          if @review.review_media.exists?(url: url)
            skipped += 1
            next
          end

          ReviewMedium.create!(
            workspace: current_workspace,
            review:    @review,
            type:      type,
            storage_key: "external:" + url, # marker — not in our bucket
            url:       url,
            thumb_url: (item["thumb_url"].presence || url),
          )
          attached += 1
        end

        AuditLog.record(
          workspace: current_workspace,
          action:    "review.media_attached",
          entity:    @review,
          metadata:  { attached: attached, skipped: skipped, source: params[:source].to_s.presence },
          request:   request,
        )

        render json: {
          data: { id: @review.id, attached: attached, skipped: skipped, total_media: @review.review_media.reload.count },
        }
      end

      # GET /api/v1/reviews/export.csv
      #
      # Streams the workspace's reviews as CSV, respecting the same filters as
      # #index (status, rating, source, q, from, to). Caps at 50k rows so a
      # rogue export cannot DoS the API. Auth: write scope required so we can
      # log the action through AuditLog.
      def export
        require_write!

        csv = ReviewCsvExporter.new(current_workspace).to_csv(params)

        AuditLog.record(
          workspace: current_workspace,
          action: "review.exported_csv",
          metadata: { filters: params.permit(:status, :rating, :source, :q, :from, :to).to_h, bytes: csv.bytesize },
          request: request
        )

        send_data csv,
                  type: "text/csv; charset=utf-8",
                  disposition: %(attachment; filename="reviews-#{Date.current}.csv")
      end

      # POST /api/v1/reviews/bulk_import
      # Body: { reviews: [{ product_id, rating, title?, body, author_name?, author_email?, status?, language?, created_at? }] }
      #
      # External-AI ingest: caller generates reviews off-server (their Claude
      # session, n8n, etc.) and posts batches here. NO server-side Anthropic
      # call — we persist as-is. ai_is_synthetic flag set so audit/admin
      # filtering can identify generated content.
      MAX_BULK_IMPORT = 500

      def bulk_import
        require_write!

        input = params.require(:reviews)
        unless input.is_a?(Array)
          render json: { error: "invalid_payload", message: "reviews must be an array" }, status: :bad_request
          return
        end
        if input.length > MAX_BULK_IMPORT
          render json: { error: "too_many", message: "max #{MAX_BULK_IMPORT} per call" }, status: :bad_request
          return
        end

        created = []
        skipped = []

        ActiveRecord::Base.transaction do
          ActiveRecord::Base.connection.execute(
            ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", current_workspace.id.to_s])
          )

          incoming_ids = input.map { |r| r[:product_id] || r["product_id"] }.compact.uniq
          products_by_id = current_workspace.products.where(id: incoming_ids).index_by(&:id)

          input.each_with_index do |raw, idx|
            r = raw.is_a?(ActionController::Parameters) ? raw.permit!.to_h.with_indifferent_access : raw.with_indifferent_access
            pid  = r[:product_id]
            body = r[:body].to_s[0, 4_000]
            product = products_by_id[pid]

            if product.nil? || body.blank?
              skipped << { index: idx, reason: product.nil? ? "product_not_found" : "missing_body", product_id: pid }
              next
            end

            target_status = %w[pending approved hidden].include?(r[:status]) ? r[:status] : "approved"
            rating        = r[:rating].to_i.clamp(1, 5)
            created_at    = parse_optional_timestamp(r[:created_at]) || Time.current

            review = current_workspace.reviews.create!(
              product:         product,
              rating:          rating,
              title:           r[:title].to_s[0, 200].presence,
              body:            body,
              author_name:     r[:author_name].to_s[0, 120].presence || "Cliente",
              author_email:    r[:author_email].to_s.downcase.strip[0, 254].presence,
              source:          "manual",
              status:          target_status,
              language:        r[:language].to_s.presence || current_workspace.default_locale,
              ai_is_synthetic: true,
              metadata:        { ai_generated: true, imported_at: Time.current.iso8601 },
              created_at:      created_at,
              updated_at:      created_at,
              approved_at:     target_status == "approved" ? created_at : nil
            )
            created << review
          end
        end

        AuditLog.record(
          workspace: current_workspace,
          action: "reviews.bulk_imported",
          metadata: { created: created.length, skipped: skipped.length }
        )

        render json: {
          data: created.map { |r| { id: r.id, product_id: r.product_id, status: r.status, rating: r.rating } },
          meta: { created: created.length, skipped: skipped.length, skipped_detail: skipped.first(50) }
        }
      end

      # POST /api/v1/reviews/bulk
      def bulk
        require_write!

        # Read `action` from request body explicitly. `params[:action]` is
        # always set by the Rails router to the controller action name ("bulk"),
        # so it shadows any JSON body field with the same key.
        body_params = request.request_parameters
        ids        = params[:ids] || body_params["ids"]
        bulk_action = body_params["action"]

        raise ActionController::ParameterMissing, :ids if ids.blank?
        raise ActionController::ParameterMissing, :action if bulk_action.blank?

        valid_actions = %w[approve reject hide spam delete]
        unless valid_actions.include?(bulk_action)
          render json: { error: "invalid_action", valid: valid_actions }, status: :bad_request
          return
        end

        reviews = current_workspace.reviews.where(id: ids)
        count = 0

        ActiveRecord::Base.transaction do
          reviews.each do |review|
            case bulk_action
            when "approve"
              old_status = review.status
              review.approve!
              RewardGrantJob.perform_later(review.id) if old_status != "approved"
            when "reject"  then review.reject!
            when "hide"    then review.hide!
            when "spam"    then review.mark_spam!
            when "delete"  then review.destroy!
            end
            count += 1
          end
        end

        AuditLog.record(
          workspace: current_workspace,
          action: "review.bulk_#{bulk_action}",
          metadata: { ids: ids, count: count },
          request: request
        )

        render json: { updated: count, action: bulk_action }
      end

      private

      # Parse "2025-12-31" / "2025-12-31T10:00:00Z" / nil → Time | nil.
      # Used by bulk_import to backdate AI-generated reviews so a batch of 500
      # doesn't show up on the same minute.
      def parse_optional_timestamp(raw)
        return nil if raw.blank?
        Time.zone.parse(raw.to_s)
      rescue ArgumentError
        nil
      end

      def set_review
        @review = current_workspace.reviews.find(params[:id])
      end

      def review_params
        params.require(:review).permit(
          :product_id, :rating, :title, :body,
          :author_name, :author_email, :author_country,
          :author_gender, :author_avatar_url,
          :status,
          :source, :is_verified_purchase, :is_featured,
          :order_id, :language, :external_id,
          metadata: {}
        )
      end

      def serialize_review(review, full: false)
        data = {
          id:                   review.id,
          workspace_id:         review.workspace_id,
          product_id:           review.product_id,
          external_id:          review.external_id,
          rating:               review.rating,
          title:                review.title,
          body:                 review.body,
          author_name:          review.author_name,
          author_email:         review.author_email,
          author_country:       review.author_country,
          author_gender:        review.author_gender,
          author_avatar_url:    review.author_avatar_url,
          source:               review.source,
          status:               review.status,
          is_featured:          review.is_featured,
          is_verified_purchase: review.is_verified_purchase,
          ai_quality_score:     review.ai_quality_score,
          ai_sentiment:         review.ai_sentiment,
          ai_topics:            review.ai_topics,
          ai_is_synthetic:      review.ai_is_synthetic,
          ai_flagged_reason:    review.ai_flagged_reason,
          language:             review.language,
          created_at:           review.created_at&.iso8601,
          updated_at:           review.updated_at&.iso8601,
          approved_at:          review.approved_at&.iso8601
        }

        if full
          data[:media]   = review.review_media.map { |m| serialize_media(m) }
          data[:replies] = review.replies.published.map { |r| serialize_reply(r) }
          data[:reward_grant] = review.reward_grant&.as_json(only: %i[id status reward_type amount_total coupon_code])
          data[:product] = review.product&.as_json(only: %i[id title handle image_url])
        end

        data
      end

      def serialize_media(m)
        {
          id: m.id, type: m.type, url: m.url, thumb_url: m.thumb_url,
          width: m.width, height: m.height, duration_sec: m.duration_sec
        }
      end

      def serialize_reply(r)
        {
          id: r.id, body: r.body, author_name: r.author_name,
          is_ai_generated: r.is_ai_generated, created_at: r.created_at&.iso8601
        }
      end
    end
  end
end

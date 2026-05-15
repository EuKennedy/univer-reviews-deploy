module Api
  module V1
    class ReviewsController < ApplicationController
      before_action :set_review, only: %i[show destroy status]

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

      # POST /api/v1/reviews/bulk
      def bulk
        require_write!

        ids    = params.require(:ids)
        action = params.require(:action)

        valid_actions = %w[approve reject hide spam delete]
        unless valid_actions.include?(action)
          render json: { error: "invalid_action", valid: valid_actions }, status: :bad_request
          return
        end

        reviews = current_workspace.reviews.where(id: ids)
        count = 0

        ActiveRecord::Base.transaction do
          reviews.each do |review|
            case action
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
          action: "review.bulk_#{action}",
          metadata: { ids: ids, count: count },
          request: request
        )

        render json: { updated: count, action: action }
      end

      private

      def set_review
        @review = current_workspace.reviews.find(params[:id])
      end

      def review_params
        params.require(:review).permit(
          :product_id, :rating, :title, :body,
          :author_name, :author_email, :author_country,
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

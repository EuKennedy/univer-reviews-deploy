module Api
  module V1
    # Admin CRUD for AI Summary topics. The storefront reads via the public
    # endpoint (Api::V1::Public::AiSummaryTopicsController). Mutations require
    # the `write` scope via require_write!.
    class AiSummaryTopicsController < ApplicationController
      before_action :set_topic, only: %i[show update destroy attach_reviews detach_reviews]

      # GET /api/v1/ai_summary_topics?product_id=...
      def index
        product_id = params[:product_id]
        raise ActionController::ParameterMissing, :product_id if product_id.blank?

        topics = current_workspace.ai_summary_topics
                                  .where(product_id: product_id)
                                  .ordered
                                  .includes(:reviews)

        render json: { data: topics.map { |t| serialize(t) } }
      end

      # GET /api/v1/ai_summary_topics/:id
      def show
        render json: { data: serialize(@topic, with_reviews: true) }
      end

      # POST /api/v1/ai_summary_topics
      #
      # Body:
      #   product_id  uuid (required)
      #   title       string (required at model layer — empty 422s with field error)
      #   ai_summary  string (optional, 1-2 sentence consensus blurb)
      #   source      "manual" | "ai" (defaults to "manual"; pass "ai" when the
      #               topic was authored externally — e.g. Claude Code driving
      #               the generation directly via curl instead of Haiku — so
      #               the storefront still paints the "Gerado por IA" pill
      #               and the dashboard counts it toward ai_count)
      #   review_ids  [uuid] (optional — attached after the row persists)
      def create
        require_write!

        product = current_workspace.products.find(params.require(:product_id))
        # Pass title directly (not require) so empty/missing values surface as
        # a model 422 with the "Title can't be blank" issue, matching the
        # rest of our CRUD endpoints. require() would short-circuit with 400
        # and lose the per-field error message.
        source = %w[manual ai].include?(params[:source]) ? params[:source] : "manual"

        topic = current_workspace.ai_summary_topics.new(
          product:      product,
          title:        params[:title].to_s,
          ai_summary:   params[:ai_summary].to_s.presence,
          source:       source,
          position:     next_position_for(product),
          generated_at: source == "ai" ? Time.current : nil,
        )

        if topic.save
          topic.attach_reviews!(params[:review_ids]) if params[:review_ids].present?
          render json: { data: serialize(topic, with_reviews: true) }, status: :created
        else
          render json: { error: "unprocessable_entity", issues: topic.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/ai_summary_topics/:id
      def update
        require_write!
        if @topic.update(topic_params)
          render json: { data: serialize(@topic, with_reviews: true) }
        else
          render json: { error: "unprocessable_entity", issues: @topic.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/ai_summary_topics/:id
      def destroy
        require_write!
        @topic.destroy!
        head :no_content
      end

      # POST /api/v1/ai_summary_topics/:id/attach_reviews
      def attach_reviews
        require_write!
        attached = @topic.attach_reviews!(params[:review_ids])
        render json: { data: serialize(@topic, with_reviews: true), attached: attached }
      end

      # POST /api/v1/ai_summary_topics/:id/detach_reviews
      def detach_reviews
        require_write!
        detached = @topic.detach_reviews!(params[:review_ids])
        render json: { data: serialize(@topic, with_reviews: true), detached: detached }
      end

      private

      def set_topic
        @topic = current_workspace.ai_summary_topics.find(params[:id])
      end

      def topic_params
        params.require(:ai_summary_topic).permit(:title, :position, :ai_summary)
      end

      def next_position_for(product)
        (current_workspace.ai_summary_topics.where(product_id: product.id).maximum(:position) || -1) + 1
      end

      def serialize(topic, with_reviews: false)
        payload = {
          id:           topic.id,
          product_id:   topic.product_id,
          title:        topic.title,
          position:     topic.position,
          source:       topic.source,
          review_count: topic.review_count,
          stars_avg:    topic.stars_avg,
          ai_summary:   topic.ai_summary,
          generated_at: topic.generated_at&.iso8601,
          created_at:   topic.created_at&.iso8601,
          updated_at:   topic.updated_at&.iso8601,
        }
        if with_reviews
          payload[:reviews] = topic.reviews.order(:created_at).map do |r|
            {
              id:           r.id,
              rating:       r.rating,
              title:        r.title,
              body:         r.body,
              author_name:  r.author_name,
              created_at:   r.created_at&.iso8601,
            }
          end
        end
        payload
      end
    end
  end
end

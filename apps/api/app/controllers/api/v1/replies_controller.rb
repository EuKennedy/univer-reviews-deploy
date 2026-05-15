module Api
  module V1
    class RepliesController < ApplicationController
      before_action :set_review,  only: [:create]
      before_action :set_reply,   only: %i[update destroy]

      # POST /api/v1/reviews/:review_id/replies
      def create
        require_write!

        reply = @review.replies.new(reply_params)
        reply.workspace = current_workspace

        if reply.save
          render json: { data: reply.as_json(only: %i[id body author_name is_ai_generated is_published created_at]) },
                 status: :created
        else
          render json: { error: "unprocessable_entity", issues: reply.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/replies/:id
      def update
        require_write!

        if @reply.update(reply_params)
          render json: { data: @reply.as_json(only: %i[id body author_name is_ai_generated is_published updated_at]) }
        else
          render json: { error: "unprocessable_entity", issues: @reply.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/replies/:id
      def destroy
        require_write!
        @reply.destroy!
        head :no_content
      end

      private

      def set_review
        @review = current_workspace.reviews.find(params[:review_id])
      end

      def set_reply
        @reply = current_workspace.reviews.joins(:replies).then do
          Reply.where(workspace_id: current_workspace.id).find(params[:id])
        end
      end

      def reply_params
        params.require(:reply).permit(:body, :author_name, :is_published, :is_ai_generated)
      end
    end
  end
end

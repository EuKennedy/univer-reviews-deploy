module Api
  module V1
    class QuestionsController < ApplicationController
      before_action :set_question, only: %i[show update destroy helpful]

      # GET /api/v1/questions
      def index
        scope = current_workspace.questions

        scope = scope.where(status: params[:status])       if params[:status].present?
        scope = scope.where(product_id: params[:product_id]) if params[:product_id].present?
        scope = scope.order(created_at: :desc)

        pagy, questions = paginate(scope)

        render json: {
          data: questions.map { |q| serialize_question(q) },
          meta: pagination_meta(pagy)
        }
      end

      # GET /api/v1/questions/:id
      def show
        render json: { data: serialize_question(@question) }
      end

      # PATCH /api/v1/questions/:id  — answer or update status
      def update
        require_write!

        if params.dig(:question, :answer).present?
          @question.answer!(
            body: params[:question][:answer],
            user: fetch_current_user
          )
        elsif params.dig(:question, :status).present?
          @question.update!(status: params[:question][:status])
        else
          @question.update!(question_params)
        end

        render json: { data: serialize_question(@question) }
      rescue => e
        render json: { error: "unprocessable_entity", message: e.message }, status: :unprocessable_entity
      end

      # DELETE /api/v1/questions/:id
      def destroy
        require_write!
        @question.update!(status: "rejected")
        head :no_content
      end

      # POST /api/v1/questions/:id/helpful
      def helpful
        @question.increment_helpful!
        render json: { data: { id: @question.id, helpful_count: @question.helpful_count } }
      end

      private

      def set_question
        @question = current_workspace.questions.find(params[:id])
      end

      def question_params
        params.require(:question).permit(:status)
      end

      def fetch_current_user
        # Attempt to find user from JWT if present
        WorkspaceUser.find_by(workspace: current_workspace) ||
          current_workspace.workspace_users.first
      end

      def serialize_question(q)
        {
          id: q.id, product_id: q.product_id,
          author_name: q.author_name, body: q.body,
          answer: q.answer, answered_at: q.answered_at&.iso8601,
          helpful_count: q.helpful_count, status: q.status,
          created_at: q.created_at&.iso8601, updated_at: q.updated_at&.iso8601
        }
      end
    end
  end
end

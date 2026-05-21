module Api
  module V1
    class QuestionsController < ApplicationController
      before_action :set_question, only: %i[show update destroy helpful]

      # GET /api/v1/questions
      def index
        scope = current_workspace.questions

        scope = scope.where(status: params[:status])                     if params[:status].present?
        scope = scope.where(product_id: params[:product_id])             if params[:product_id].present?
        scope = scope.where(question_group_id: params[:question_group_id]) if params[:question_group_id].present?
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

      # POST /api/v1/questions/bulk_import
      # Body: { questions: [{ product_id, question, answer, author_name?, status?, language? }] }
      #
      # External-AI flow: an off-server client (Claude tool, n8n, etc.) generates
      # Q&A pairs in its own context and POSTs them here in batches. The endpoint
      # does NO Anthropic call server-side — it just persists what the caller
      # supplies, so the workspace's ANTHROPIC_API_KEY isn't charged.
      #
      # Capped at 500 per call to keep the transaction reasonable. Reject any
      # row whose product_id doesn't belong to the workspace (cross-tenant
      # protection beyond RLS).
      MAX_BULK_IMPORT = 500

      def bulk_import
        require_write!

        input = params.require(:questions)
        unless input.is_a?(Array)
          render json: { error: "invalid_payload", message: "questions must be an array" }, status: :bad_request
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

          # Pre-fetch products to avoid N+1 lookups. Filter by workspace —
          # any product_id outside the workspace silently drops to `skipped`.
          incoming_ids = input.map { |q| q[:product_id] || q["product_id"] }.compact.uniq
          products_by_id = current_workspace.products.where(id: incoming_ids).index_by(&:id)

          input.each_with_index do |raw, idx|
            q = raw.is_a?(ActionController::Parameters) ? raw.permit!.to_h.with_indifferent_access : raw.with_indifferent_access
            pid    = q[:product_id]
            body   = q[:question].to_s[0, 1_000]
            answer = q[:answer].to_s[0, 5_000]
            product = products_by_id[pid]

            if product.nil? || body.blank? || answer.blank?
              skipped << { index: idx, reason: product.nil? ? "product_not_found" : "missing_body_or_answer", product_id: pid }
              next
            end

            target_status = %w[pending published].include?(q[:status]) ? q[:status] : "published"

            question = current_workspace.questions.create!(
              product:       product,
              author_name:   q[:author_name].to_s.presence&.slice(0, 120) || "Cliente",
              author_email:  q[:author_email].to_s.presence&.downcase&.slice(0, 254),
              body:          body,
              answer:        answer,
              status:        target_status,
              answered_at:   target_status == "published" ? Time.current : nil
            )
            created << question
          end
        end

        AuditLog.record(
          workspace: current_workspace,
          action: "questions.bulk_imported",
          metadata: { created: created.length, skipped: skipped.length }
        )

        render json: {
          data: created.map { |q| { id: q.id, product_id: q.product_id, status: q.status } },
          meta: { created: created.length, skipped: skipped.length, skipped_detail: skipped.first(50) }
        }
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
          question_group_id: q.question_group_id,
          author_name: q.author_name, body: q.body,
          answer: q.answer, answered_at: q.answered_at&.iso8601,
          helpful_count: q.helpful_count, status: q.status,
          created_at: q.created_at&.iso8601, updated_at: q.updated_at&.iso8601
        }
      end
    end
  end
end

module Api
  module V1
    module Public
      class QuestionsController < ApplicationController
        skip_before_action :set_current_workspace
        before_action :resolve_workspace

        # GET /api/v1/public/questions/:product_id
        # Accepts the internal UUID, the handle/slug, or the storefront's
        # platform_product_id (matches /public/reviews/:product_id semantics).
        # Returns the union of questions linked directly to the product OR via
        # any QuestionGroup it belongs to.
        def index
          product = resolve_product(params[:product_id])
          raise ActiveRecord::RecordNotFound unless product

          questions = product.all_questions
                              .where(status: "published")
                              .order(helpful_count: :desc, created_at: :desc)
                              .limit(50)

          render json: {
            data: questions.map { |q|
              {
                id: q.id,
                body: q.body,
                author_name: q.author_name,
                answer: q.answer,
                answered_at: q.answered_at&.iso8601,
                helpful_count: q.helpful_count,
                created_at: q.created_at&.iso8601
              }
            }
          }
        rescue ActiveRecord::RecordNotFound
          render json: { error: "not_found" }, status: :not_found
        end

        # POST /api/v1/public/questions/:product_id
        def create
          product = resolve_product(params[:product_id])
          raise ActiveRecord::RecordNotFound unless product

          question = @workspace.questions.new(
            product: product,
            author_name: params[:author_name],
            author_email: params[:author_email]&.downcase,
            body: params.require(:body),
            status: "pending"
          )

          if question.save
            render json: { data: { id: question.id, message: "Question submitted." } }, status: :created
          else
            render json: { error: "unprocessable_entity", issues: question.errors.full_messages },
                   status: :unprocessable_entity
          end
        rescue ActiveRecord::RecordNotFound
          render json: { error: "not_found" }, status: :not_found
        end

        private

        # Same resolver pattern as Api::V1::Public::ReviewsController#resolve_product.
        def resolve_product(identifier)
          ident = identifier.to_s
          return nil if ident.blank?

          if ident.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
            p = @workspace.products.find_by(id: ident)
            return p if p
          end
          p = @workspace.products.find_by(handle: ident)
          return p if p
          @workspace.products.find_by(platform_product_id: ident)
        end

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

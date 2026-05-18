module Api
  module V1
    class QuestionGroupsController < ApplicationController
      before_action :set_group, only: %i[show update destroy attach_products detach_products]

      # GET /api/v1/question_groups
      def index
        scope = current_workspace.question_groups.recent
        scope = scope.where("name ILIKE ?", "%#{params[:q]}%") if params[:q].present?

        pagy, groups = paginate(scope)

        render json: {
          data: groups.map { |g| serialize_group(g) },
          meta: pagination_meta(pagy)
        }
      end

      # GET /api/v1/question_groups/:id
      def show
        render json: { data: serialize_group(@group, with_products: true) }
      end

      # POST /api/v1/question_groups
      def create
        require_write!
        group = current_workspace.question_groups.new(group_params)

        if group.save
          group.attach_products!(params[:product_ids]) if params[:product_ids].present?
          render json: { data: serialize_group(group, with_products: true) }, status: :created
        else
          render json: { error: "unprocessable_entity", issues: group.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/question_groups/:id
      def update
        require_write!
        if @group.update(group_params)
          render json: { data: serialize_group(@group, with_products: true) }
        else
          render json: { error: "unprocessable_entity", issues: @group.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/question_groups/:id
      def destroy
        require_write!
        @group.destroy!
        head :no_content
      end

      # POST /api/v1/question_groups/:id/attach_products
      def attach_products
        require_write!
        attached = @group.attach_products!(params[:product_ids])
        render json: { data: serialize_group(@group, with_products: true), attached: attached }
      end

      # POST /api/v1/question_groups/:id/detach_products
      def detach_products
        require_write!
        detached = @group.detach_products!(params[:product_ids])
        render json: { data: serialize_group(@group, with_products: true), detached: detached }
      end

      private

      def set_group
        @group = current_workspace.question_groups.find(params[:id])
      end

      def group_params
        params.require(:question_group).permit(:name, :description)
      end

      def serialize_group(g, with_products: false)
        payload = {
          id: g.id,
          name: g.name,
          description: g.description,
          products_count: g.question_group_products.count,
          questions_count: g.questions.count,
          created_at: g.created_at&.iso8601,
          updated_at: g.updated_at&.iso8601
        }
        if with_products
          payload[:products] = g.products.select(:id, :title, :handle, :image_url).map do |p|
            { id: p.id, title: p.title, handle: p.handle, image_url: p.image_url }
          end
        end
        payload
      end
    end
  end
end

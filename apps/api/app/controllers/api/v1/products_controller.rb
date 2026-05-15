module Api
  module V1
    class ProductsController < ApplicationController
      before_action :set_product, only: %i[show update destroy]

      # GET /api/v1/products
      def index
        scope = current_workspace.products

        scope = scope.where(active: params[:active] == "true")   if params[:active].present?
        scope = scope.where(platform: params[:platform])         if params[:platform].present?

        if params[:q].present?
          q = "%#{params[:q]}%"
          scope = scope.where("title ILIKE ? OR handle ILIKE ?", q, q)
        end

        scope = scope.order(created_at: :desc)

        pagy, products = paginate(scope)

        render json: {
          data: products.map { |p| serialize_product(p) },
          meta: pagination_meta(pagy)
        }
      end

      # GET /api/v1/products/:id
      def show
        render json: { data: serialize_product(@product, full: true) }
      end

      # POST /api/v1/products
      def create
        require_write!

        product = current_workspace.products.new(product_params)

        if product.save
          render json: { data: serialize_product(product) }, status: :created
        else
          render json: { error: "unprocessable_entity", issues: product.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/products/:id
      def update
        require_write!

        if @product.update(product_params)
          render json: { data: serialize_product(@product) }
        else
          render json: { error: "unprocessable_entity", issues: @product.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/products/:id
      def destroy
        require_write!
        @product.destroy!
        head :no_content
      end

      # POST /api/v1/products/sync
      def sync
        require_write!

        WooCommerceSyncJob.perform_later(current_workspace.id)
        render json: { message: "Product sync queued" }
      end

      private

      def set_product
        @product = current_workspace.products.find(params[:id])
      end

      def product_params
        params.require(:product).permit(
          :platform, :platform_product_id, :handle,
          :title, :image_url, :price, :currency, :active,
          metadata: {}
        )
      end

      def serialize_product(p, full: false)
        data = {
          id: p.id, title: p.title, handle: p.handle,
          platform: p.platform, platform_product_id: p.platform_product_id,
          image_url: p.image_url, price: p.price, currency: p.currency,
          active: p.active, last_synced_at: p.last_synced_at&.iso8601,
          created_at: p.created_at&.iso8601
        }

        if full
          data[:avg_rating]    = p.avg_rating
          data[:reviews_count] = p.reviews_count
          data[:metadata]      = p.metadata
        end

        data
      end
    end
  end
end

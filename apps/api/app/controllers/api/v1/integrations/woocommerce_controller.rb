module Api
  module V1
    module Integrations
      class WoocommerceController < ApplicationController
        # GET /api/v1/integrations/woocommerce
        def show
          domain = current_workspace.woocommerce_domain

          if domain
            # Return config without secrets (only presence indicators)
            meta = domain.platform_meta || {}
            render json: {
              data: {
                id: domain.id,
                domain: domain.domain,
                store_url: meta["store_url"],
                has_consumer_key: meta["consumer_key"].present?,
                has_consumer_secret: meta["consumer_secret"].present?,
                verified: domain.verified?,
                verified_at: domain.verified_at&.iso8601
              }
            }
          else
            render json: { data: nil }
          end
        end

        # POST /api/v1/integrations/woocommerce
        def create
          require_write!

          if current_workspace.woocommerce_domain.present?
            render json: { error: "already_exists", message: "WooCommerce integration already configured. Use PATCH to update." },
                   status: :conflict
            return
          end

          domain = current_workspace.workspace_domains.new(
            domain: woo_params[:store_url].to_s.gsub(/https?:\/\//, "").split("/").first.to_s.downcase,
            platform: "woocommerce",
            platform_meta: {
              "store_url"       => woo_params[:store_url],
              "consumer_key"    => woo_params[:consumer_key],
              "consumer_secret" => woo_params[:consumer_secret]
            }
          )

          if domain.save
            AuditLog.record(workspace: current_workspace, action: "woocommerce.connected", request: request)
            render json: { data: { id: domain.id, connected: true } }, status: :created
          else
            render json: { error: "unprocessable_entity", issues: domain.errors.full_messages },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/integrations/woocommerce
        def update
          require_write!

          domain = current_workspace.woocommerce_domain
          unless domain
            render json: { error: "not_found", message: "WooCommerce not configured" }, status: :not_found
            return
          end

          new_meta = domain.platform_meta.merge({
            "store_url"       => woo_params[:store_url] || domain.woo_store_url,
            "consumer_key"    => woo_params[:consumer_key] || domain.woo_consumer_key,
            "consumer_secret" => woo_params[:consumer_secret] || domain.woo_consumer_secret
          }.compact)

          domain.update!(platform_meta: new_meta)
          render json: { data: { id: domain.id, updated: true } }
        end

        # DELETE /api/v1/integrations/woocommerce
        def destroy
          require_write!

          domain = current_workspace.woocommerce_domain
          unless domain
            render json: { error: "not_found" }, status: :not_found
            return
          end

          domain.destroy!
          AuditLog.record(workspace: current_workspace, action: "woocommerce.disconnected", request: request)
          head :no_content
        end

        # POST /api/v1/integrations/woocommerce/test
        def test
          domain = current_workspace.woocommerce_domain
          unless domain&.woo_store_url.present?
            render json: { error: "not_configured" }, status: :bad_request
            return
          end

          result = Integrations::WooCommerceAdapter.new(
            store_url: domain.woo_store_url,
            consumer_key: domain.woo_consumer_key,
            consumer_secret: domain.woo_consumer_secret
          ).test_connection

          if result[:success]
            domain.verify! unless domain.verified?
          end

          render json: { data: result }
        end

        # POST /api/v1/integrations/woocommerce/sync_products
        def sync_products
          require_write!
          WooCommerceSyncJob.perform_later(current_workspace.id)
          render json: { message: "Product sync queued" }
        end

        # POST /api/v1/integrations/woocommerce/sync_reviews
        def sync_reviews
          require_write!
          import = current_workspace.imports.create!(source: "woocommerce")
          WooCommerceImportJob.perform_later(current_workspace.id, import.id)
          render json: { data: { import_id: import.id, message: "Review import queued" } }
        end

        private

        def woo_params
          params.permit(:store_url, :consumer_key, :consumer_secret)
        end
      end
    end
  end
end

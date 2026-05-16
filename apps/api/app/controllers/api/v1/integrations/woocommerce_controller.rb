module Api
  module V1
    module Integrations
      class WoocommerceController < ApplicationController
        # GET /api/v1/integrations/woocommerce
        def show
          render json: config_payload(current_workspace.woocommerce_domain)
        end

        # POST /api/v1/integrations/woocommerce
        # Upserts the WooCommerce integration (idempotent).
        def create
          require_write!

          domain = current_workspace.woocommerce_domain || current_workspace.workspace_domains.new(
            platform: "woocommerce"
          )

          merged_meta = (domain.platform_meta || {}).merge({
            "store_url"          => woo_params[:store_url].presence    || domain.woo_store_url,
            "consumer_key"       => woo_params[:consumer_key].presence || domain.woo_consumer_key,
            "consumer_secret"    => woo_params[:consumer_secret].presence || domain.woo_consumer_secret,
            "sync_products"      => boolish(woo_params[:sync_products], default: true),
            "sync_reviews"       => boolish(woo_params[:sync_reviews],  default: true),
            "auto_sync_interval" => (woo_params[:auto_sync_interval] || 3600).to_i
          }.compact)

          domain.assign_attributes(
            domain: extract_host(merged_meta["store_url"]),
            platform_meta: merged_meta
          )

          if domain.save
            was_new = domain.previous_changes.key?("id")
            AuditLog.record(
              workspace: current_workspace,
              action: was_new ? "woocommerce.connected" : "woocommerce.updated",
              request: request
            )
            render json: config_payload(domain), status: was_new ? :created : :ok
          else
            render json: { error: "unprocessable_entity", issues: domain.errors.full_messages },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/integrations/woocommerce
        def update
          create
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
        # Accepts optional creds in body to test BEFORE save.
        def test
          store_url       = woo_params[:store_url].presence
          consumer_key    = woo_params[:consumer_key].presence
          consumer_secret = woo_params[:consumer_secret].presence

          if [store_url, consumer_key, consumer_secret].any?(&:nil?)
            domain = current_workspace.woocommerce_domain
            store_url       ||= domain&.woo_store_url
            consumer_key    ||= domain&.woo_consumer_key
            consumer_secret ||= domain&.woo_consumer_secret
          end

          unless store_url.present? && consumer_key.present? && consumer_secret.present?
            render json: { success: false, message: "Configure URL e credenciais antes de testar." },
                   status: :bad_request
            return
          end

          result = ::Integrations::WooCommerceAdapter.new(
            store_url: store_url,
            consumer_key: consumer_key,
            consumer_secret: consumer_secret
          ).test_connection

          if result[:success]
            current_workspace.woocommerce_domain&.verify!
            render json: {
              success: true,
              message: "Conectado a #{result[:store_name] || store_url}",
              store_name: result[:store_name],
              wc_version: result[:wc_version],
              wp_version: result[:wp_version]
            }
          else
            render json: { success: false, message: result[:error] || "Falha na conexão" },
                   status: :ok
          end
        end

        # POST /api/v1/integrations/woocommerce/sync_products
        def sync_products
          require_write!
          unless current_workspace.woocommerce_domain&.woo_store_url.present?
            render json: { error: "not_configured", message: "WooCommerce não configurado" },
                   status: :bad_request
            return
          end
          WooCommerceSyncJob.perform_later(current_workspace.id)
          render json: { message: "Sincronização de produtos enfileirada" }
        end

        # POST /api/v1/integrations/woocommerce/sync_reviews
        def sync_reviews
          require_write!
          unless current_workspace.woocommerce_domain&.woo_store_url.present?
            render json: { error: "not_configured", message: "WooCommerce não configurado" },
                   status: :bad_request
            return
          end
          import = current_workspace.imports.create!(source: "woocommerce")
          WooCommerceImportJob.perform_later(current_workspace.id, import.id)
          render json: { import_id: import.id, message: "Importação de avaliações enfileirada" }
        end

        private

        def woo_params
          params.permit(:store_url, :consumer_key, :consumer_secret,
                        :sync_products, :sync_reviews, :auto_sync_interval)
        end

        def boolish(val, default:)
          return default if val.nil?
          ActiveModel::Type::Boolean.new.cast(val)
        end

        def extract_host(url)
          return nil if url.blank?
          URI.parse(url).host.to_s.downcase.presence || url.to_s.gsub(%r{https?://}, "").split("/").first.to_s.downcase
        rescue URI::InvalidURIError
          url.to_s.gsub(%r{https?://}, "").split("/").first.to_s.downcase
        end

        def config_payload(domain)
          unless domain
            return {
              connected: false,
              store_url: nil,
              sync_products: true,
              sync_reviews: true,
              auto_sync_interval: 3600,
              last_sync_at: nil,
              product_count: nil,
              review_count: nil
            }
          end

          meta = domain.platform_meta || {}
          last_import = current_workspace.imports
                                         .where(source: "woocommerce")
                                         .order(finished_at: :desc)
                                         .limit(1)
                                         .first

          {
            connected: true,
            verified: domain.verified?,
            verified_at: domain.verified_at&.iso8601,
            store_url: meta["store_url"],
            has_consumer_key: meta["consumer_key"].present?,
            has_consumer_secret: meta["consumer_secret"].present?,
            sync_products: meta.fetch("sync_products", true),
            sync_reviews: meta.fetch("sync_reviews", true),
            auto_sync_interval: meta.fetch("auto_sync_interval", 3600),
            last_sync_at: (last_import&.finished_at || last_import&.started_at)&.iso8601,
            product_count: current_workspace.products.where(platform: "woocommerce").count,
            review_count: current_workspace.reviews.where(source: "woo").count
          }
        end
      end
    end
  end
end

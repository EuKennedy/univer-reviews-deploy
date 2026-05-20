module Api
  module V1
    module Webhooks
      class ShopifyController < ApplicationController
        skip_before_action :set_current_workspace

        # POST /api/v1/webhooks/shopify
        #
        # Shopify ships every delivery with X-Shopify-Hmac-Sha256, a base64
        # HMAC of the raw request body using the per-shop webhook secret.
        # Without verification the endpoint is wide open: any attacker who
        # knows a merchant's *.myshopify.com host can POST forged orders and
        # trigger campaigns / rewards.
        #
        # We verify BEFORE any DB lookup or job enqueue.
        def create
          shop_domain = request.headers["X-Shopify-Shop-Domain"]
          topic       = request.headers["X-Shopify-Topic"]
          signature   = request.headers["X-Shopify-Hmac-Sha256"]

          domain_record = WorkspaceDomain.find_by(domain: shop_domain&.downcase)

          unless domain_record
            head :not_found
            return
          end

          secret = domain_record.platform_meta.is_a?(Hash) ? domain_record.platform_meta["webhook_secret"] : nil

          # Fail closed: in production we never accept unsigned/unsecured
          # deliveries. Dev/test allow it for fixtures but log loudly.
          if secret.blank? || signature.blank?
            if Rails.env.production? || Rails.env.staging?
              Rails.logger.warn("[shopify-webhook] rejected: missing secret or signature for #{shop_domain}")
              head :unauthorized
              return
            else
              Rails.logger.warn("[shopify-webhook] accepted UNSIGNED in #{Rails.env} for #{shop_domain}")
            end
          else
            raw_body = request.body.tap(&:rewind).read
            expected = Base64.strict_encode64(OpenSSL::HMAC.digest("sha256", secret, raw_body))
            unless ActiveSupport::SecurityUtils.secure_compare(signature, expected)
              Rails.logger.warn("[shopify-webhook] signature mismatch for #{shop_domain}")
              head :unauthorized
              return
            end
          end

          @workspace = domain_record.workspace
          set_rls_workspace(@workspace.id)

          # Read body for parsing (already read above for signed flow; re-read safely).
          raw_body ||= request.body.tap(&:rewind).read
          payload = JSON.parse(raw_body)

          case topic
          when "orders/create", "orders/fulfilled"
            CampaignTriggerJob.perform_later(
              workspace_id: @workspace.id,
              order_id: payload["id"].to_s,
              customer_email: payload.dig("email"),
              order_status: payload["financial_status"],
              line_items: payload["line_items"] || []
            )
          end

          head :ok
        rescue JSON::ParserError
          head :bad_request
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

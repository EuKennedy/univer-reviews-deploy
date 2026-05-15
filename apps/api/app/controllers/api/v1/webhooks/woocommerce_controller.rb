module Api
  module V1
    module Webhooks
      class WoocommerceController < ApplicationController
        skip_before_action :set_current_workspace
        skip_before_action :verify_authenticity_token, raise: false

        # POST /api/v1/webhooks/woocommerce
        def create
          domain_header = request.headers["X-Wc-Webhook-Source"]

          unless domain_header.present?
            head :bad_request
            return
          end

          domain_record = WorkspaceDomain.find_by(domain: domain_header.gsub(/https?:\/\//, "").split("/").first.downcase)

          unless domain_record
            head :not_found
            return
          end

          @workspace = domain_record.workspace

          # Verify HMAC signature
          secret = domain_record.platform_meta&.dig("webhook_secret")
          if secret.present? && !valid_signature?(secret)
            head :unauthorized
            return
          end

          set_rls_workspace(@workspace.id)

          payload = JSON.parse(request.body.read)
          topic   = request.headers["X-Wc-Webhook-Topic"]

          handle_event(topic, payload)
          head :ok
        rescue JSON::ParserError
          head :bad_request
        rescue => e
          Rails.logger.error("WooCommerce webhook error: #{e.message}")
          Sentry.capture_exception(e)
          head :internal_server_error
        end

        private

        def valid_signature?(secret)
          signature = request.headers["X-Wc-Webhook-Signature"]
          return false unless signature.present?

          body = request.body.tap(&:rewind).read
          expected = Base64.strict_encode64(
            OpenSSL::HMAC.digest("SHA256", secret, body)
          )
          ActiveSupport::SecurityUtils.secure_compare(signature, expected)
        end

        def handle_event(topic, payload)
          case topic
          when "order.created", "order.updated"
            status = payload["status"]
            if %w[completed processing].include?(status)
              CampaignTriggerJob.perform_later(
                workspace_id: @workspace.id,
                order_id: payload["id"].to_s,
                customer_email: payload.dig("billing", "email"),
                order_status: status,
                line_items: payload["line_items"] || []
              )
            end
          when "product.created", "product.updated"
            WooCommerceUpsertProductJob.perform_later(@workspace.id, payload)
          when "review.created"
            WooCommerceUpsertReviewJob.perform_later(@workspace.id, payload)
          end
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

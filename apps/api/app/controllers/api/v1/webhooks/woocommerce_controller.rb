module Api
  module V1
    module Webhooks
      class WoocommerceController < ApplicationController
        skip_before_action :set_current_workspace
        skip_before_action :verify_authenticity_token, raise: false

        # POST /api/v1/webhooks/woocommerce
        def create
          @workspace_domain = resolve_workspace_domain
          unless @workspace_domain
            head :not_found
            return
          end
          @workspace = @workspace_domain.workspace

          raw_body = request.body.tap(&:rewind).read

          # Mandatory HMAC verification. The previous code had a "backwards-compat"
          # path that accepted unsigned deliveries when platform_meta lacked a
          # webhook_secret — combined with an attacker-controllable host header,
          # that gave anyone the ability to forge order events against any
          # WooCommerce-connected tenant.
          #
          # Fail closed in production/staging. Legacy domains MUST re-register
          # via WooCommerceWebhookRegistrar to get a secret minted.
          secret = @workspace_domain.platform_meta.is_a?(Hash) ? @workspace_domain.platform_meta["webhook_secret"] : nil
          if secret.blank?
            if Rails.env.production? || Rails.env.staging?
              Rails.logger.warn("[wc-webhook] no secret on domain=#{@workspace_domain.id} — rejecting")
              head :unauthorized
              return
            else
              Rails.logger.warn("[wc-webhook] no secret on domain=#{@workspace_domain.id} — accepting in #{Rails.env}")
            end
          else
            unless valid_signature?(secret, raw_body)
              head :unauthorized
              return
            end
          end

          payload = JSON.parse(raw_body)
          topic   = request.headers["X-Wc-Webhook-Topic"].to_s

          set_rls_workspace(@workspace.id)

          handle_event(topic, payload)
          head :ok
        rescue JSON::ParserError
          head :bad_request
        rescue => e
          Rails.logger.error("WooCommerce webhook error: #{e.message}")
          Sentry.capture_exception(e) if defined?(Sentry)
          head :internal_server_error
        end

        private

        # Resolve the tenant strictly by X-Wc-Webhook-Source.
        # Removed: Referer fallback (attacker-controllable) and progressive
        # subdomain walk (let evil.victim.com hit victim.com's workspace).
        # We still strip an exact "www." prefix because WooCommerce often
        # sends www.<host> for stores registered as the bare apex — that
        # one-step normalisation is narrow and does not enable cross-tenant
        # routing the way the old subdomain walk did.
        def resolve_workspace_domain
          host = host_from_header(request.headers["X-Wc-Webhook-Source"])
          return nil if host.blank?
          WorkspaceDomain.find_by(domain: host) ||
            (host.start_with?("www.") && WorkspaceDomain.find_by(domain: host.sub(/\Awww\./, ""))) ||
            nil
        end

        def host_from_header(value)
          return nil if value.blank?
          value.to_s.gsub(/\Ahttps?:\/\//, "").split("/").first&.downcase
        end

        def valid_signature?(secret, body)
          signature = request.headers["X-Wc-Webhook-Signature"]
          return false if signature.blank?

          expected = Base64.strict_encode64(
            OpenSSL::HMAC.digest("SHA256", secret, body.to_s)
          )
          ActiveSupport::SecurityUtils.secure_compare(signature, expected)
        end

        def handle_event(topic, payload)
          # Always route product/review topics through their dedicated jobs.
          case topic
          when "product.created", "product.updated"
            WooCommerceUpsertProductJob.perform_later(@workspace.id, payload)
            return
          when "review.created"
            WooCommerceUpsertReviewJob.perform_later(@workspace.id, payload)
            return
          end

          # Order topics → normalize → PlatformEvent → ProcessPlatformEventJob
          attrs = PlatformEvents::WooCommerceNormalizer.normalize(payload, topic)
          return if attrs.nil?

          event = nil
          with_workspace_rls(@workspace.id) do
            # Idempotency: skip if we've already seen this (platform, event_type, order).
            existing = PlatformEvent.find_by(
              workspace_id:      @workspace.id,
              platform:          attrs[:platform],
              event_type:        attrs[:event_type],
              external_order_id: attrs[:external_order_id]
            )
            if existing
              event = existing
              next
            end

            event = PlatformEvent.create!(attrs.merge(workspace_id: @workspace.id))
          end

          ProcessPlatformEventJob.perform_later(event.id) if event && !event.processed?
        end

        # Wraps a block in a transaction with SET LOCAL app.workspace_id, identical
        # to the helper in ApplicationJob — controllers don't have it natively.
        def with_workspace_rls(workspace_id)
          ActiveRecord::Base.transaction do
            ActiveRecord::Base.connection.execute(
              ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", workspace_id.to_s])
            )
            yield
          end
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

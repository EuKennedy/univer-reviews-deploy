module Api
  module V1
    module Webhooks
      class WoocommerceController < ApplicationController
        skip_before_action :set_current_workspace
        skip_before_action :verify_authenticity_token, raise: false

        # POST /api/v1/webhooks/woocommerce
        def create
          @workspace = resolve_workspace
          unless @workspace
            head :not_found
            return
          end

          raw_body = request.body.tap(&:rewind).read

          # Verify HMAC signature when configured for this domain.
          # Backwards-compat: when no secret is stored yet (older connections
          # that pre-date the auto-register feature), we accept the delivery
          # but log a warning so the next reconnect upgrades them.
          secret = @workspace_domain.platform_meta.is_a?(Hash) ? @workspace_domain.platform_meta["webhook_secret"] : nil
          if secret.present?
            unless valid_signature?(secret, raw_body)
              head :unauthorized
              return
            end
          else
            Rails.logger.warn(
              "[WC-WEBHOOK] no webhook_secret stored for workspace_domain=#{@workspace_domain.id} — accepting unsigned delivery"
            )
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

        def resolve_workspace
          host = host_from_header(request.headers["X-Wc-Webhook-Source"]) ||
                 host_from_referer
          return nil if host.blank?

          @workspace_domain = find_domain_progressively(host)
          @workspace_domain&.workspace
        end

        def host_from_header(value)
          return nil if value.blank?
          value.to_s.gsub(/\Ahttps?:\/\//, "").split("/").first&.downcase
        end

        def host_from_referer
          return nil if request.referer.blank?
          URI.parse(request.referer).host&.downcase
        rescue URI::InvalidURIError
          nil
        end

        # Mirror of the public/reviews resolution: exact → strip www → walk
        # subdomains until we find a registered workspace_domain.
        def find_domain_progressively(host)
          candidates = [host]
          candidates << host.sub(/\Awww\./, "") if host.start_with?("www.")
          # Walk up subdomains: foo.bar.example.com → bar.example.com → example.com
          parts = host.split(".")
          while parts.length > 2
            parts.shift
            candidates << parts.join(".")
          end
          candidates.uniq.each do |c|
            domain = WorkspaceDomain.find_by(domain: c)
            return domain if domain
          end
          nil
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

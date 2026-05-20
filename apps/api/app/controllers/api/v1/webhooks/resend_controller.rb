module Api
  module V1
    module Webhooks
      class ResendController < ApplicationController
        skip_before_action :set_current_workspace
        skip_before_action :verify_authenticity_token, raise: false

        # POST /api/v1/webhooks/resend
        def create
          raw_body = request.body.tap(&:rewind).read

          unless verify_signature(raw_body)
            head :unauthorized
            return
          end

          payload = JSON.parse(raw_body)
          type    = payload["type"].to_s
          data    = payload["data"] || {}

          send = find_send(data)
          if send
            ActiveRecord::Base.transaction do
              ActiveRecord::Base.connection.execute(
                ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", send.workspace_id.to_s])
              )
              dispatch_event(send, type, data)
            end
          end

          head :ok
        rescue JSON::ParserError
          head :bad_request
        rescue => e
          Rails.logger.error("Resend webhook error: #{e.message}")
          Sentry.capture_exception(e) if defined?(Sentry)
          head :internal_server_error
        end

        private

        # Resend signs webhooks via the Svix protocol — three headers:
        # svix-id, svix-timestamp, svix-signature. Verification is
        # base64(hmac_sha256(secret, "#{id}.#{ts}.#{body}")).
        #
        # In production/staging RESEND_WEBHOOK_SECRET is REQUIRED — missing
        # secret means we reject deliveries (fail closed). Previously we
        # logged a warning and accepted the webhook, which let any attacker
        # mark sends as bounced/complained/opened and poison suppression
        # lists during any window where the env var was unset.
        #
        # Also rejects deliveries whose timestamp is older than
        # WEBHOOK_TIMESTAMP_TOLERANCE to prevent replay of captured deliveries.
        WEBHOOK_TIMESTAMP_TOLERANCE = 5.minutes

        def verify_signature(body)
          secret = ENV["RESEND_WEBHOOK_SECRET"].to_s.strip
          if secret.empty?
            if Rails.env.production? || Rails.env.staging?
              Rails.logger.error("[resend-webhook] RESEND_WEBHOOK_SECRET unset in #{Rails.env} — rejecting")
              return false
            else
              Rails.logger.warn("[resend-webhook] RESEND_WEBHOOK_SECRET missing — accepting in #{Rails.env}")
              return true
            end
          end

          svix_id   = request.headers["Svix-Id"]
          svix_ts   = request.headers["Svix-Timestamp"]
          svix_sig  = request.headers["Svix-Signature"]
          return false if svix_id.blank? || svix_ts.blank? || svix_sig.blank?

          # Replay protection: reject deliveries older than the tolerance window.
          ts_int = svix_ts.to_i
          return false if ts_int.zero?
          return false if (Time.now.to_i - ts_int).abs > WEBHOOK_TIMESTAMP_TOLERANCE.to_i

          # Svix secret format: "whsec_<base64>"
          key_bytes = secret.start_with?("whsec_") ? Base64.decode64(secret.sub(/\Awhsec_/, "")) : secret
          signed    = "#{svix_id}.#{svix_ts}.#{body}"
          expected  = Base64.strict_encode64(OpenSSL::HMAC.digest("SHA256", key_bytes, signed))

          # Header can carry multiple signatures, space-separated, each "v1,<sig>".
          svix_sig.to_s.split(" ").any? do |part|
            sig = part.split(",", 2).last.to_s
            ActiveSupport::SecurityUtils.secure_compare(expected, sig)
          end
        end

        def find_send(data)
          # Prefer custom header X-Univer-Send-Id that we set on every Resend send
          headers = data["headers"]
          header_value = nil
          if headers.is_a?(Array)
            entry = headers.find { |h| h.is_a?(Hash) && h["name"].to_s.casecmp("X-Univer-Send-Id").zero? }
            header_value = entry && entry["value"]
          elsif headers.is_a?(Hash)
            header_value = headers["X-Univer-Send-Id"] || headers["x-univer-send-id"]
          end

          return CampaignSend.find_by(id: header_value) if header_value.present?

          message_id = data["email_id"].presence || data["id"].presence
          CampaignSend.find_by(resend_message_id: message_id) if message_id.present?
        end

        def dispatch_event(send, type, data)
          case type
          when "email.delivered"
            send.mark_delivered!
          when "email.bounced", "email.bounce"
            reason = data.dig("bounce", "message") || data["reason"]
            send.mark_bounced!(reason: reason)
          when "email.complained", "email.complaint"
            send.mark_complained!
          when "email.opened"
            send.mark_opened!
          when "email.clicked"
            send.mark_clicked!
          else
            Rails.logger.info("Resend webhook: unhandled type=#{type}")
          end
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

module Api
  module V1
    module Webhooks
      # POST /api/v1/webhooks/univercart
      #
      # Receives `entitlement.*` deliveries from the Univercart Connect
      # platform (the founder's payment gateway). The flow:
      #
      #   1. Verify HMAC via Univercart::SignatureVerifier (5-min replay
      #      window, constant-time compare).
      #   2. Parse JSON. Reject malformed payloads with 400.
      #   3. Insert a `connect_events` row keyed by `event.id` — the
      #      unique index lets a retried delivery short-circuit at 200
      #      with `{ idempotent: true }` without re-running provisioning.
      #   4. Skip `livemode=false` events with a logged 200 so the
      #      Univercart dashboard's "test" mode doesn't write live state.
      #   5. Out-of-order guard: if a newer event for the same
      #      `externalUserId` has already been processed, drop this one
      #      (logged + idempotent). Stripe-style retries can land out of
      #      sequence; the last processed timestamp wins.
      #   6. Dispatch to Univercart::EntitlementProcessor and mark the
      #      row processed (with workspace link) or failed (with error).
      #
      # Response shape is minimal — we never echo workspace IDs back to
      # the caller. Provisioning happens server-side and the buyer learns
      # about it via the Univercart-issued magic-link email.
      class UnivercartController < ApplicationController
        skip_before_action :set_current_workspace
        skip_before_action :verify_authenticity_token, raise: false

        MAX_BODY_BYTES = 128.kilobytes

        def receive
          # ── 1. Env-secret gate ──────────────────────────────────────────
          secret = ENV["UNIVERCART_WEBHOOK_SECRET"].to_s.strip
          if secret.empty?
            Rails.logger.error("[univercart-webhook] UNIVERCART_WEBHOOK_SECRET unset — rejecting")
            head :service_unavailable
            return
          end

          # ── 2. Content-type + body-size gates ───────────────────────────
          unless request.content_type.to_s.start_with?("application/json")
            head :unsupported_media_type
            return
          end
          if request.content_length.to_i > MAX_BODY_BYTES
            head :payload_too_large
            return
          end

          raw_body = request.body.tap(&:rewind).read
          if raw_body.bytesize > MAX_BODY_BYTES
            head :payload_too_large
            return
          end

          # ── 3. HMAC verification ────────────────────────────────────────
          verdict = ::Univercart::SignatureVerifier.verify(
            secret:           secret,
            raw_body:         raw_body,
            signature_header: request.headers["X-Univercart-Signature"],
          )
          unless verdict == :ok
            Rails.logger.warn(
              "[univercart-webhook] signature #{verdict} from #{request.remote_ip}",
            )
            head :unauthorized
            return
          end

          # ── 4. Parse + minimal contract checks ──────────────────────────
          payload    = JSON.parse(raw_body)
          event_id   = payload["id"].to_s
          event_type = payload["type"].to_s
          livemode   = payload["livemode"] == true
          created_at = parse_created(payload["created"])

          if event_id.blank? || event_type.blank?
            Rails.logger.warn("[univercart-webhook] missing id or type")
            head :bad_request
            return
          end

          # ── 5. Idempotency: insert-then-process ─────────────────────────
          connect_event = nil
          begin
            ActiveRecord::Base.transaction do
              connect_event = ConnectEvent.create!(
                event_id:         event_id,
                event_type:       event_type,
                payload:          payload,
                livemode:         livemode,
                external_user_id: payload.dig("data", "externalUserId").to_s.presence,
                event_created_at: created_at,
              )
            end
          rescue ActiveRecord::RecordNotUnique
            Rails.logger.info("[univercart-webhook] event=#{event_id} replay — short-circuit")
            render json: { received: true, idempotent: true }
            return
          end

          # ── 6. Mode gate ────────────────────────────────────────────────
          unless livemode
            connect_event.mark_processed!  # acknowledge but skip side effects
            Rails.logger.info("[univercart-webhook] event=#{event_id} type=#{event_type} test-mode — skipped")
            render json: { received: true, livemode: false }
            return
          end

          # ── 7. Out-of-order guard ───────────────────────────────────────
          sub_id = connect_event.external_user_id
          if sub_id.present? && created_at
            last_seen = ConnectEvent.last_processed_at_for(sub_id)
            if last_seen && created_at < last_seen
              connect_event.mark_processed!
              Rails.logger.info(
                "[univercart-webhook] event=#{event_id} stale (created=#{created_at} < last=#{last_seen}) — skipped",
              )
              render json: { received: true, stale: true }
              return
            end
          end

          # ── 8. Dispatch ─────────────────────────────────────────────────
          begin
            result = ::Univercart::EntitlementProcessor.process!(
              event_type: event_type,
              data:       payload["data"],
              request:    request,
            )

            if result.ok
              connect_event.mark_processed!(workspace: result.workspace_id.present? ? Workspace.find_by(id: result.workspace_id) : nil)
              Rails.logger.info(
                "[univercart-webhook] event=#{event_id} type=#{event_type} ok " \
                "ws=#{result.workspace_id} provisioned=#{result.provisioned}",
              )
              render json: { received: true, provisioned: result.provisioned.to_s }
            else
              connect_event.mark_failed!(result.error.to_s)
              Rails.logger.warn("[univercart-webhook] event=#{event_id} rejected: #{result.error}")
              render json: { received: false, error: result.error.to_s }, status: :unprocessable_entity
            end
          rescue => e
            connect_event.mark_failed!(e.message)
            Rails.logger.error("[univercart-webhook] event=#{event_id} failed: #{e.class}: #{e.message}")
            Sentry.capture_exception(e) if defined?(Sentry)
            head :internal_server_error
          end
        rescue JSON::ParserError
          Rails.logger.warn("[univercart-webhook] invalid JSON body")
          head :bad_request
        rescue => e
          Rails.logger.error("[univercart-webhook] unexpected error: #{e.class}: #{e.message}")
          Sentry.capture_exception(e) if defined?(Sentry)
          head :internal_server_error
        end

        private

        # `created` field is Unix seconds per Univercart docs. Tolerate
        # millisecond timestamps just in case (some gateways drift).
        def parse_created(value)
          return nil if value.blank?
          secs = value.to_i
          secs = secs / 1000 if secs > 10_000_000_000
          Time.at(secs).utc
        rescue StandardError
          nil
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

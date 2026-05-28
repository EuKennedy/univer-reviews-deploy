module Api
  module V1
    module Webhooks
      # POST /api/v1/webhooks/payment
      #
      # Inbound webhook from the external payment platform (NOT Stripe).
      # When a customer pays, that platform fires here. We:
      #   1. Verify HMAC-SHA256 (constant-time) against
      #      ENV['PAYMENT_WEBHOOK_SECRET'].
      #   2. Insert a PaymentEvent row keyed by `transaction_id`. Unique
      #      index lets a duplicate delivery short-circuit with idempotent=true.
      #   3. Dispatch to Payment::WebhookProcessor for find-or-create user /
      #      workspace / workspace_user / magic-link / audit.
      #
      # Response shape is intentionally minimal — we never echo IDs back to
      # the caller. Provisioning happens server-side and the buyer learns
      # about it via e-mail.
      class PaymentController < ApplicationController
        skip_before_action :set_current_workspace
        skip_before_action :verify_authenticity_token, raise: false

        MAX_BODY_BYTES = 64.kilobytes

        def receive
          # ── 1. Env-secret gate ──────────────────────────────────────────
          secret = ENV["PAYMENT_WEBHOOK_SECRET"].to_s.strip
          if secret.empty?
            Rails.logger.error("[payment-webhook] PAYMENT_WEBHOOK_SECRET unset — rejecting")
            head :service_unavailable
            return
          end

          # ── 2. Content-type gate ────────────────────────────────────────
          unless request.content_type.to_s.start_with?("application/json")
            head :unsupported_media_type
            return
          end

          # ── 3. Body-size gate (memory protection) ───────────────────────
          # Trust Content-Length first (cheaper), fall back to read length.
          if request.content_length.to_i > MAX_BODY_BYTES
            head :payload_too_large
            return
          end

          raw_body = request.body.tap(&:rewind).read
          if raw_body.bytesize > MAX_BODY_BYTES
            head :payload_too_large
            return
          end

          # ── 4. HMAC verification (constant-time compare) ────────────────
          unless valid_signature?(secret, raw_body)
            Rails.logger.warn("[payment-webhook] signature mismatch from #{request.remote_ip}")
            head :unauthorized
            return
          end

          # ── 5. Parse + minimal contract checks ──────────────────────────
          payload = JSON.parse(raw_body)
          tx_id   = payload["transaction_id"].to_s
          event   = payload["event"].to_s

          if tx_id.blank? || event.blank?
            Rails.logger.warn("[payment-webhook] missing transaction_id or event")
            head :bad_request
            return
          end

          # Only handle `payment.succeeded` for now. Other event types
          # (refund, chargeback) get logged as PaymentEvent rows for future
          # processors but we return 200 so the provider stops retrying.
          unless event == "payment.succeeded"
            log_unhandled_event(tx_id: tx_id, event: event, payload: payload)
            Rails.logger.info("[payment-webhook] tx=#{tx_id} unhandled event=#{event} — acknowledged")
            render json: { ok: true, idempotent: false }, status: :ok
            return
          end

          # ── 6. Idempotency: insert-then-process ─────────────────────────
          # Wrapping in a transaction so a concurrent retry can't both pass
          # the uniqueness check and both try to provision.
          #
          # Strict policy: ANY existing row for the same transaction_id
          # short-circuits with `idempotent: true`. This matches the
          # documented contract (see docs/PAYMENT_WEBHOOK.md). Failed
          # provisioning is surfaced via `payment_events.error` for ops to
          # inspect — re-runs are triggered manually (rake task / console)
          # rather than via webhook replay, to avoid accidental double-work
          # if the provider re-delivers an already-processed event whose
          # `processed_at` write happened to race against the unique-
          # violation reply.
          payment_event = nil
          begin
            ActiveRecord::Base.transaction do
              payment_event = PaymentEvent.create!(
                transaction_id: tx_id,
                event:          event,
                payload:        payload
              )
            end
          rescue ActiveRecord::RecordNotUnique
            Rails.logger.info("[payment-webhook] tx=#{tx_id} replay — short-circuit")
            render json: { ok: true, idempotent: true }, status: :ok
            return
          end

          # ── 7. Process ──────────────────────────────────────────────────
          begin
            result = Payment::WebhookProcessor.process!(payload, request: request)
            if result.ok
              payment_event.mark_processed!
              Rails.logger.info(
                "[payment-webhook] tx=#{tx_id} processed=#{result.provisioned} ws=#{result.workspace_id}"
              )
              render json: { ok: true, idempotent: false }, status: :ok
            else
              payment_event.mark_failed!(result.error.to_s)
              Rails.logger.warn("[payment-webhook] tx=#{tx_id} rejected: #{result.error}")
              # Bad-request on validation failures — we already have the
              # PaymentEvent row, so retries won't reprocess.
              render json: { ok: false }, status: :unprocessable_entity
            end
          rescue => e
            payment_event.mark_failed!(e.message)
            Rails.logger.error("[payment-webhook] tx=#{tx_id} failed: #{e.class}: #{e.message}")
            Sentry.capture_exception(e) if defined?(Sentry)
            # 5xx so the provider retries — but the next attempt will hit
            # the idempotent path and return 200 without re-running the
            # business logic. We accept that trade-off: the alternative is
            # silently swallowing every failure.
            head :internal_server_error
          end
        rescue JSON::ParserError
          Rails.logger.warn("[payment-webhook] invalid JSON body")
          head :bad_request
        rescue => e
          Rails.logger.error("[payment-webhook] unexpected error: #{e.class}: #{e.message}")
          Sentry.capture_exception(e) if defined?(Sentry)
          head :internal_server_error
        end

        private

        # Header format: `X-Payment-Signature: sha256=<hex>`. We accept both
        # the prefixed form and a bare hex digest (defensive — some
        # providers omit the algorithm tag).
        def valid_signature?(secret, body)
          header = request.headers["X-Payment-Signature"].to_s
          return false if header.empty?

          provided = header.start_with?("sha256=") ? header.sub("sha256=", "") : header
          # Hex-only: the secure_compare assertion below also gates on equal
          # byte length, so junk strings fall through to `false`.
          return false unless provided.match?(/\A[0-9a-fA-F]+\z/)

          expected = OpenSSL::HMAC.hexdigest("SHA256", secret, body.to_s)
          ActiveSupport::SecurityUtils.secure_compare(
            expected.downcase, provided.downcase
          )
        end

        # Persist non-success events (refund, chargeback, etc) so they can
        # be inspected later. We swallow the unique-violation on duplicate
        # delivery — these rows are pure forensics, no business logic
        # depends on uniqueness here.
        def log_unhandled_event(tx_id:, event:, payload:)
          PaymentEvent.create!(
            transaction_id: tx_id,
            event:          event,
            payload:        payload,
            processed_at:   Time.current
          )
        rescue ActiveRecord::RecordNotUnique
          # duplicate — fine, we already logged this one
        rescue => e
          Rails.logger.warn("[payment-webhook] could not log unhandled event #{event}: #{e.message}")
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

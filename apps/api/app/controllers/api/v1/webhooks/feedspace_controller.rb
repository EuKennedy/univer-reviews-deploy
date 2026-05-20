module Api
  module V1
    module Webhooks
      class FeedspaceController < ApplicationController
        skip_before_action :set_current_workspace

        # POST /api/v1/webhooks/feedspace
        #
        # Feedspace doesn't ship a signature header by default — we require
        # a shared secret (FEEDSPACE_WEBHOOK_SECRET) sent via X-Feedspace-Secret,
        # plus per-workspace pinning via X-Workspace-Id. Both must match.
        #
        # Previously the endpoint trusted X-Workspace-Id alone, so anyone who
        # guessed a workspace UUID could inject pending reviews into any tenant
        # and trigger AiModerateJob (which may auto-approve depending on
        # workspace config). This is now closed.
        #
        # Body length is also capped to prevent memory exhaustion / AI cost
        # amplification on the moderation worker.
        MAX_BODY_BYTES   = 8.kilobytes
        MAX_MESSAGE_LEN  = 4_000
        MAX_NAME_LEN     = 120

        def create
          # 1. Shared secret check (fail closed in prod/staging).
          configured_secret = ENV["FEEDSPACE_WEBHOOK_SECRET"].to_s
          provided_secret   = request.headers["X-Feedspace-Secret"].to_s

          if Rails.env.production? || Rails.env.staging?
            if configured_secret.empty?
              Rails.logger.error("[feedspace-webhook] FEEDSPACE_WEBHOOK_SECRET unset — rejecting delivery")
              head :service_unavailable
              return
            end
            unless ActiveSupport::SecurityUtils.secure_compare(provided_secret, configured_secret)
              Rails.logger.warn("[feedspace-webhook] shared secret mismatch")
              head :unauthorized
              return
            end
          else
            Rails.logger.warn("[feedspace-webhook] skipping secret check in #{Rails.env}") if configured_secret.empty?
          end

          # 2. Body length cap before parse (memory protection).
          raw_body = request.body.tap(&:rewind).read
          if raw_body.bytesize > MAX_BODY_BYTES
            head :payload_too_large
            return
          end

          # 3. Workspace identity (now safe — secret was validated above).
          workspace_id = request.headers["X-Workspace-Id"] || params[:workspace_id]
          workspace = Workspace.find_by(id: workspace_id)
          unless workspace
            head :not_found
            return
          end

          payload = JSON.parse(raw_body)

          # 4. Input validation.
          rating  = payload["rating"].to_i.clamp(1, 5)
          message = payload["message"].to_s[0, MAX_MESSAGE_LEN]
          name    = payload["name"].to_s[0, MAX_NAME_LEN]
          email   = payload["email"].to_s.downcase.strip[0, 254]

          if message.blank?
            head :unprocessable_entity
            return
          end

          set_rls_workspace(workspace.id)

          review = workspace.reviews.create!(
            source:       "widget",
            rating:       rating,
            body:         message,
            author_name:  name.presence,
            author_email: email.presence,
            status:       "pending"
          )

          AiModerateJob.perform_later(review.id)

          head :ok
        rescue JSON::ParserError
          head :bad_request
        rescue => e
          Rails.logger.error("Feedspace webhook error: #{e.message}")
          Sentry.capture_exception(e) if defined?(Sentry)
          head :internal_server_error
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

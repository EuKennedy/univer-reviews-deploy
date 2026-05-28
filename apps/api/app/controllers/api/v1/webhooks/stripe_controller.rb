module Api
  module V1
    module Webhooks
      class StripeController < ApplicationController
        skip_before_action :set_current_workspace

        # POST /api/v1/webhooks/stripe
        def create
          secret = ENV["STRIPE_WEBHOOK_SECRET"].to_s.strip
          if secret.empty?
            if Rails.env.production? || Rails.env.staging?
              Rails.logger.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET unset — rejecting")
              head :service_unavailable
              return
            else
              Rails.logger.warn("[stripe-webhook] secret empty in #{Rails.env} — accepting without verification")
            end
          end

          payload = request.body.read
          sig_header = request.env["HTTP_STRIPE_SIGNATURE"]

          event =
            if secret.empty?
              # Dev/test: parse without verification so fixtures can fire events.
              raw = JSON.parse(payload)
              OpenStruct.new(
                id:   raw["id"],
                type: raw["type"],
                data: OpenStruct.new(object: OpenStruct.new(raw.dig("data", "object") || {}))
              )
            else
              Stripe::Webhook.construct_event(payload, sig_header, secret)
            end

          # Idempotency: insert a StripeEvent row keyed by event.id BEFORE
          # processing. Stripe re-delivers on 5xx for 3 days; without this
          # guard, replayed events double-process (extra subscription writes,
          # extra audit log rows, extra downgrade on subscription.deleted).
          if event.id.present?
            begin
              StripeEvent.create!(event_id: event.id, event_type: event.type)
            rescue ActiveRecord::RecordNotUnique
              Rails.logger.info("[stripe-webhook] replay #{event.id} (#{event.type}) — skipping")
              head :ok
              return
            end
          end

          handle_stripe_event(event)

          StripeEvent.where(event_id: event.id).update_all(processed_at: Time.current) if event.id.present?
          head :ok
        rescue Stripe::SignatureVerificationError => e
          Rails.logger.warn("Stripe webhook signature failed: #{e.message}")
          head :bad_request
        rescue JSON::ParserError
          head :bad_request
        rescue => e
          Rails.logger.error("Stripe webhook error: #{e.message}")
          Sentry.capture_exception(e) if defined?(Sentry)
          head :internal_server_error
        end

        private

        def handle_stripe_event(event)
          case event.type
          when "checkout.session.completed"
            handle_checkout_completed(event.data.object)
          when "customer.subscription.updated"
            handle_subscription_updated(event.data.object)
          when "customer.subscription.deleted"
            handle_subscription_deleted(event.data.object)
          when "invoice.payment_failed"
            handle_payment_failed(event.data.object)
          end
        end

        def handle_checkout_completed(session)
          workspace_id = session.metadata&.dig("workspace_id")
          plan_slug    = session.metadata&.dig("plan_slug")
          return unless workspace_id && plan_slug

          workspace = Workspace.find_by(id: workspace_id)
          return unless workspace

          plan = BillingPlan.find_by(slug: plan_slug)
          return unless plan

          # Retrieve the subscription from Stripe
          stripe_sub = Stripe::Subscription.retrieve(session.subscription)

          set_rls_workspace(workspace.id)

          sub = workspace.subscription || workspace.build_subscription
          sub.update!(
            plan: plan,
            status: "active",
            external_id: stripe_sub.id,
            current_period_start: Time.at(stripe_sub.current_period_start).utc,
            current_period_end:   Time.at(stripe_sub.current_period_end).utc
          )

          workspace.update!(plan: plan_slug)

          AuditLog.record(
            workspace: workspace,
            action: "subscription.activated",
            metadata: { plan: plan_slug, stripe_session: session.id }
          )
        end

        def handle_subscription_updated(stripe_sub)
          sub = Subscription.find_by(external_id: stripe_sub.id)
          return unless sub

          set_rls_workspace(sub.workspace_id)

          new_status = case stripe_sub.status
                       when "active"    then "active"
                       when "trialing"  then "trialing"
                       when "past_due"  then "past_due"
                       when "canceled"  then "canceled"
                       else "past_due"
                       end

          sub.update!(
            status: new_status,
            current_period_start: Time.at(stripe_sub.current_period_start).utc,
            current_period_end:   Time.at(stripe_sub.current_period_end).utc,
            canceled_at: stripe_sub.canceled_at ? Time.at(stripe_sub.canceled_at).utc : nil
          )

          AuditLog.record(
            workspace: sub.workspace,
            action: "subscription.updated",
            metadata: { status: new_status }
          )
        end

        def handle_subscription_deleted(stripe_sub)
          sub = Subscription.find_by(external_id: stripe_sub.id)
          return unless sub

          set_rls_workspace(sub.workspace_id)

          sub.update!(status: "canceled", canceled_at: Time.current)
          # No freemium tier exists post-T1.3 — a canceled subscription
          # drops the workspace to the floor paid tier (entry). Access
          # control is then driven by Subscription#status="canceled"
          # rather than by demoting the plan; the plan only governs
          # what's available IF the subscription becomes active again.
          sub.workspace.update!(plan: "entry")

          AuditLog.record(
            workspace: sub.workspace,
            action: "subscription.canceled"
          )
        end

        def handle_payment_failed(invoice)
          stripe_sub_id = invoice.subscription
          return unless stripe_sub_id

          sub = Subscription.find_by(external_id: stripe_sub_id)
          return unless sub

          set_rls_workspace(sub.workspace_id)
          sub.update!(status: "past_due")

          AuditLog.record(
            workspace: sub.workspace,
            action: "subscription.payment_failed",
            metadata: { invoice_id: invoice.id }
          )
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

module Api
  module V1
    module Webhooks
      class StripeController < ApplicationController
        skip_before_action :set_current_workspace

        WEBHOOK_SECRET = ENV.fetch("STRIPE_WEBHOOK_SECRET", "")

        # POST /api/v1/webhooks/stripe
        def create
          payload = request.body.read
          sig_header = request.env["HTTP_STRIPE_SIGNATURE"]

          event = Stripe::Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)

          handle_stripe_event(event)
          head :ok
        rescue Stripe::SignatureVerificationError => e
          Rails.logger.warn("Stripe webhook signature failed: #{e.message}")
          head :bad_request
        rescue JSON::ParserError
          head :bad_request
        rescue => e
          Rails.logger.error("Stripe webhook error: #{e.message}")
          Sentry.capture_exception(e)
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
          sub.workspace.update!(plan: "free")

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

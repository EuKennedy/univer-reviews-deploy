module Api
  module V1
    class BillingController < ApplicationController
      # GET /api/v1/billing
      def show
        sub = current_workspace.subscription

        render json: {
          data: {
            plan: current_workspace.plan,
            subscription: sub ? {
              id:                  sub.id,
              status:              sub.status,
              external_id:         sub.external_id,
              current_period_start: sub.current_period_start&.iso8601,
              current_period_end:  sub.current_period_end&.iso8601,
              trial_ends_at:       sub.trial_ends_at&.iso8601,
              canceled_at:         sub.canceled_at&.iso8601,
              plan: sub.plan ? {
                slug:  sub.plan.slug,
                name:  sub.plan.name,
                price_monthly_cents: sub.plan.price_monthly_cents,
                features: sub.plan.features
              } : nil
            } : nil,
            available_plans: BillingPlan.active.order(:price_monthly_cents).map { |p|
              {
                slug: p.slug, name: p.name,
                price_monthly_cents: p.price_monthly_cents,
                price_yearly_cents: p.price_yearly_cents,
                features: p.features
              }
            }
          }
        }
      end

      # POST /api/v1/billing/create_checkout
      def create_checkout
        require_write!

        plan_slug    = params.require(:plan)
        billing_type = params[:billing_type] || "monthly"
        success_url  = params[:success_url] || ENV.fetch("FRONTEND_URL", "http://localhost:3001")
        cancel_url   = params[:cancel_url]  || ENV.fetch("FRONTEND_URL", "http://localhost:3001")

        plan = BillingPlan.active.find_by!(slug: plan_slug)

        price_cents = billing_type == "yearly" ? plan.price_yearly_cents : plan.price_monthly_cents

        session = Stripe::Checkout::Session.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [{
            price_data: {
              currency: "brl",
              unit_amount: price_cents,
              recurring: { interval: billing_type == "yearly" ? "year" : "month" },
              product_data: { name: "UniverReviews #{plan.name}" }
            },
            quantity: 1
          }],
          metadata: {
            workspace_id: current_workspace.id,
            plan_slug: plan_slug
          },
          success_url: success_url,
          cancel_url: cancel_url
        })

        render json: { data: { checkout_url: session.url, session_id: session.id } }
      rescue Stripe::StripeError => e
        render json: { error: "stripe_error", message: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/billing/portal
      def portal
        require_write!

        sub = current_workspace.subscription

        unless sub&.external_id.present?
          render json: { error: "no_subscription", message: "No active Stripe subscription found" }, status: :bad_request
          return
        end

        return_url = params[:return_url] || ENV.fetch("FRONTEND_URL", "http://localhost:3001")

        # Retrieve customer ID from Stripe subscription
        stripe_sub = Stripe::Subscription.retrieve(sub.external_id)
        portal_session = Stripe::BillingPortal::Session.create({
          customer: stripe_sub.customer,
          return_url: return_url
        })

        render json: { data: { portal_url: portal_session.url } }
      rescue Stripe::StripeError => e
        render json: { error: "stripe_error", message: e.message }, status: :unprocessable_entity
      end
    end
  end
end

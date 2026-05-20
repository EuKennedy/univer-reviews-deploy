module Api
  module V1
    class BillingController < ApplicationController
      # Billing endpoints are restricted to owner/admin. The previous code
      # gated only on require_write! (which includes editor), so any editor
      # session could open the Stripe billing portal and cancel/refund/
      # change the plan on the workspace's Stripe customer.
      before_action :require_billing_role!, only: %i[create_checkout portal]

      # Frontend hosts we accept for post-checkout / portal-return redirects.
      # Anything else is treated as user input and dropped to the safe default.
      ALLOWED_REDIRECT_HOSTS = %w[
        dash.univerreviews.com
        app.univerreviews.com
        univerreviews.com
        www.univerreviews.com
      ].freeze

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
        plan_slug    = params.require(:plan)
        billing_type = params[:billing_type] || "monthly"
        success_url  = safe_redirect_url(params[:success_url])
        cancel_url   = safe_redirect_url(params[:cancel_url])

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
          # client_reference_id binds this checkout to our workspace at Stripe's
          # level; we verify against this on the inbound webhook to prevent
          # checkout-metadata forgery (a hostile workspace can no longer set
          # someone else's workspace_id in metadata and have it applied).
          client_reference_id: current_workspace.id.to_s,
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
        sub = current_workspace.subscription

        unless sub&.external_id.present?
          render json: { error: "no_subscription", message: "No active Stripe subscription found" }, status: :bad_request
          return
        end

        return_url = safe_redirect_url(params[:return_url])

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

      private

      # Only owner/admin can touch billing. require_write! lets editor through
      # which is fine for review moderation but NOT for changing plans / opening
      # the Stripe portal where the user can cancel, refund, or swap payment
      # methods on the workspace's account.
      def require_billing_role!
        role = current_user&.role
        unless %w[owner admin].include?(role)
          raise ForbiddenError, "Billing actions require an owner or admin role"
        end
      end

      # Open-redirect defense. The previous endpoints forwarded any
      # success_url / cancel_url / return_url straight to Stripe, which
      # then 303s the browser to the attacker's domain post-payment —
      # phishing + token leakage via Referer.
      #
      # Accept only:
      #   - URLs whose host is in ALLOWED_REDIRECT_HOSTS
      #   - http on localhost / 127.0.0.1 in development
      # Anything else falls back to ENV["FRONTEND_URL"] (which itself must be
      # set to a trusted host in prod).
      def safe_redirect_url(value)
        fallback = ENV.fetch("FRONTEND_URL", "https://dash.univerreviews.com")
        return fallback if value.blank?

        begin
          uri = URI.parse(value.to_s)
        rescue URI::InvalidURIError
          return fallback
        end

        return fallback unless %w[http https].include?(uri.scheme)

        host = uri.host.to_s.downcase
        return fallback if host.empty?

        if ALLOWED_REDIRECT_HOSTS.include?(host)
          return value.to_s
        end

        if (Rails.env.development? || Rails.env.test?) && %w[localhost 127.0.0.1].include?(host)
          return value.to_s
        end

        fallback
      end
    end
  end
end

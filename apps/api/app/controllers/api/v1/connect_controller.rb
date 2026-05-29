module Api
  module V1
    # POST /api/v1/connect/redeem
    #
    # Server-to-server proxy for Univercart's `/v1/tokens/:jti/redeem`.
    # The Next.js `/connect/setup` page calls this AFTER it has verified
    # the inbound HS256 JWT. Why a proxy and not a direct call from Next?
    #
    #   - UNIVERCART_API_KEY lives only in Rails ENV; the Next app never
    #     sees it. Shipping a `sk_live_*` key through a browser bundle
    #     would be game over.
    #   - Centralising the redeem lets us audit-log every attempt
    #     (success or 410) into our system, which is the only place that
    #     will track partner-side replay attempts.
    #
    # This endpoint is intentionally NOT under a workspace scope and
    # carries no Better Auth session — the Next page invokes it from its
    # own server-render path with a shared `CONNECT_PROXY_SECRET` header
    # so a rogue browser can't trigger redemptions.
    class ConnectController < ApplicationController
      skip_before_action :set_current_workspace
      skip_before_action :verify_authenticity_token, raise: false

      def redeem
        # ── 1. Proxy secret gate ────────────────────────────────────────
        # The Next.js server uses CONNECT_PROXY_SECRET to authenticate
        # itself; without it any visitor could hit this endpoint with a
        # guessed JTI. Constant-time compare so we don't leak the secret
        # via timing.
        expected = ENV["CONNECT_PROXY_SECRET"].to_s
        if expected.empty?
          Rails.logger.error("[connect-redeem] CONNECT_PROXY_SECRET unset — rejecting")
          head :service_unavailable
          return
        end
        provided = request.headers["X-Connect-Proxy-Secret"].to_s
        unless provided.length == expected.length &&
               ActiveSupport::SecurityUtils.secure_compare(provided, expected)
          head :unauthorized
          return
        end

        # ── 2. JTI sanity ───────────────────────────────────────────────
        jti = params[:jti].to_s
        unless jti.match?(/\A[A-Za-z0-9_\-]+\z/) && jti.length.between?(8, 128)
          render json: { error: "bad_request", message: "Malformed jti" }, status: :bad_request
          return
        end

        # ── 3. Dev bypass (NEVER set in production) ─────────────────────
        # Lets the founder simulate the full Univercart flow offline:
        # `scripts/univercart-simulate.rb` fires a webhook + emits a
        # magic-link URL whose JTI doesn't exist on Univercart's side.
        # When this env var is set the redeem short-circuits with 200
        # so the buyer lands on /<workspace>/dashboard without us
        # talking to Univercart.
        #
        # Guards:
        #   - ENV var name is intentionally verbose so it can't get set by
        #     mistake (no `DEV_MODE` umbrella).
        #   - Logs a loud warning every hit.
        #   - Refuses to bypass if Rails.env is production AND the env
        #     value isn't literally the string "force"; gives the founder
        #     a deliberate footgun if they ever genuinely need to bypass
        #     prod for a one-off recovery, but blocks accidental
        #     contamination from a stray Coolify env paste.
        bypass = ENV["UNIVERCART_DEV_SKIP_REDEEM"].to_s
        if bypass.present? && (!Rails.env.production? || bypass == "force")
          Rails.logger.warn(
            "[connect-redeem] DEV BYPASS active — jti=#{jti} env=#{Rails.env} value=#{bypass.inspect}"
          )
          render json: { ok: true, dev_bypass: true }
          return
        end

        # ── 4. Hit Univercart ───────────────────────────────────────────
        result = ::Univercart::TokenRedeemer.redeem(jti: jti)
        Rails.logger.info("[connect-redeem] jti=#{jti} status=#{result.status} reason=#{result.reason}")

        case result.status
        when 200
          render json: { ok: true }
        when 404
          render json: { ok: false, error: "unknown_jti" }, status: :not_found
        when 410
          render json: { ok: false, error: result.reason }, status: :gone
        else
          render json: { ok: false, error: result.reason || "redeem_failed" }, status: :bad_gateway
        end
      end

      private

      def skip_authentication?
        true
      end
    end
  end
end

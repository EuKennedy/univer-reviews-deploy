module Api
  module V1
    class AuthController < ApplicationController
      skip_before_action :set_current_workspace

      # JWT_SECRET must be supplied via env. The previous code had a hardcoded
      # fallback string; if the env var ever went unset in production, every
      # JWT the API issued (and accepted) could be forged by anyone holding
      # the public source. Fail fast on boot instead.
      JWT_SECRET = ENV.fetch("JWT_SECRET") do
        if Rails.env.production? || Rails.env.staging?
          raise "JWT_SECRET environment variable is required in #{Rails.env}"
        end
        # Dev/test: derive a per-boot secret so tests/devs don't have to set it,
        # but the value is not stable across processes (intentional — forces
        # config in any shared environment).
        Rails.env.test? ? "test-jwt-secret-do-not-use-in-prod-#{"0" * 32}" : SecureRandom.hex(64)
      end
      JWT_ALGO   = "HS256"
      TOKEN_TTL  = 24.hours

      # POST /api/v1/auth/login
      # Body: { email:, password:, workspace_slug: }
      #
      # workspace_slug is REQUIRED. Without it the previous implementation
      # picked an arbitrary WorkspaceUser when the email existed in more
      # than one tenant — same class of bug as the "lizzon" cross-tenant
      # redirect we just shipped a fix for on the Next.js side. Make the
      # tenant explicit at the API boundary.
      def login
        email          = params.require(:email).to_s.downcase.strip
        password       = params.require(:password).to_s
        workspace_slug = params[:workspace_slug].to_s.strip

        if workspace_slug.empty?
          render json: {
            error: "missing_workspace_slug",
            message: "workspace_slug é obrigatório para autenticar."
          }, status: :bad_request
          return
        end

        user = find_user(email, workspace_slug)

        unless user && user.authenticate(password)
          render json: { error: "invalid_credentials", message: "E-mail ou senha incorretos." }, status: :unauthorized
          return
        end

        user.update_column(:last_login_at, Time.current)

        jwt = encode_jwt(user)

        render json: {
          token: jwt,
          expires_at: TOKEN_TTL.from_now.iso8601,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            workspace_id: user.workspace_id,
            workspace_slug: user.workspace.slug
          }
        }
      end

      # POST /api/v1/auth/magic-link
      # Body: { email:, workspace_slug: }
      # workspace_slug is required for the same reason as #login above.
      def magic_link
        email          = params.require(:email).downcase.strip
        workspace_slug = params[:workspace_slug].to_s.strip

        if workspace_slug.empty?
          # Match the success response to prevent user/workspace enumeration.
          render json: { message: "If that email exists, a magic link was sent." }
          return
        end

        user = find_user(email, workspace_slug)

        unless user
          # Always return 200 to prevent user enumeration
          render json: { message: "If that email exists, a magic link was sent." }
          return
        end

        # Invalidate previous tokens for this user
        user.magic_link_tokens.valid.update_all(used_at: Time.current)

        _record, raw_token = MagicLinkToken.generate_for(user, ttl: 15.minutes)

        MagicLinkMailerJob.perform_later(
          user_id: user.id,
          raw_token: raw_token,
          workspace_name: user.workspace.name
        )

        render json: { message: "If that email exists, a magic link was sent." }
      end

      # POST /api/v1/auth/verify
      # Body: { token: "raw_magic_link_token" }
      #
      # Used to be GET with the token in the query string — that put the
      # token in browser history, Referer headers leaked it to any third-
      # party asset on the post-login page, and proxy/access logs captured
      # it. Magic-link tokens are 24h credentials; we now require POST + body.
      def verify
        raw_token = (params[:token].presence || request.headers["X-Magic-Link-Token"]).to_s
        if raw_token.empty?
          render json: { error: "missing_token", message: "Token é obrigatório." }, status: :bad_request
          return
        end
        token_record = MagicLinkToken.find_valid(raw_token)

        if token_record.nil?
          render json: { error: "invalid_token", message: "Token is invalid or expired." }, status: :unauthorized
          return
        end

        token_record.use!

        user = token_record.workspace_user
        user.update!(last_login_at: Time.current)

        jwt = encode_jwt(user)

        render json: {
          token: jwt,
          expires_at: TOKEN_TTL.from_now.iso8601,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            workspace_id: user.workspace_id
          }
        }
      end

      # DELETE /api/v1/auth/logout
      # Requires valid JWT in Authorization header
      def logout
        # JWT is stateless; client should discard the token.
        # Optionally we could maintain a denylist in Redis for high-security needs.
        render json: { message: "Logged out." }
      end

      private

      def find_user(email, workspace_slug)
        scope = WorkspaceUser.where(email: email)
        scope = scope.joins(:workspace).where(workspaces: { slug: workspace_slug }) if workspace_slug.present?
        scope.first
      end

      def encode_jwt(user)
        payload = {
          sub:          user.id,
          workspace_id: user.workspace_id,
          role:         user.role,
          iat:          Time.current.to_i,
          exp:          TOKEN_TTL.from_now.to_i
        }
        JWT.encode(payload, JWT_SECRET, JWT_ALGO)
      end

      def skip_authentication?
        true
      end
    end
  end
end

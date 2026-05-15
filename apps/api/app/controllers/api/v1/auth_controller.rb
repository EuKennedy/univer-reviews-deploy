module Api
  module V1
    class AuthController < ApplicationController
      skip_before_action :set_current_workspace

      JWT_SECRET = ENV.fetch("JWT_SECRET", "change_me_in_production_min_64_chars_long_secret_key_here_!!!")
      JWT_ALGO   = "HS256"
      TOKEN_TTL  = 24.hours

      # POST /api/v1/auth/magic-link
      # Body: { email:, workspace_slug: }
      def magic_link
        email          = params.require(:email).downcase.strip
        workspace_slug = params[:workspace_slug]

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

      # GET /api/v1/auth/verify?token=xxx
      def verify
        raw_token = params.require(:token)
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

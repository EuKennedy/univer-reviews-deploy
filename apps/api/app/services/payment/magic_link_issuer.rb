module Payment
  # Mints a Better Auth magic-link for an arbitrary e-mail and dispatches it
  # via Resend. Used by the payment webhook to land a freshly-paid buyer
  # straight into their workspace without forcing them to set a password.
  #
  # ── Why we insert into `auth.verification` directly ─────────────────────
  # Better Auth's JS API is not reachable from Rails (different process,
  # different runtime). The cleanest equivalent is to mimic the schema
  # contract the `magic-link` plugin uses internally:
  #
  #   verificationToken = generateRandomString(32, "a-z", "A-Z")
  #   storedToken       = verificationToken            (storeToken: "plain")
  #   row {
  #     identifier: storedToken,
  #     value:      JSON.stringify({ email, name }),
  #     expires_at: NOW() + 24h
  #   }
  #   url = `${ADMIN_URL}/api/auth/magic-link/verify?token=${verificationToken}&callbackURL=/`
  #
  # The plugin in lib/auth.ts uses the default `storeToken: "plain"`, so the
  # raw token IS the identifier — no hashing required. See
  # node_modules/better-auth/.../plugins/magic-link/index.mjs for the
  # source-of-truth contract that this mirrors.
  #
  # NB the `disableSignUp: true` flag in lib/auth.ts only affects the
  # *public* /sign-in/magic-link endpoint — direct verification of a token
  # that points at an existing `auth.user` row works unconditionally, which
  # is what we need here (we just created the user row in WebhookProcessor).
  class MagicLinkIssuer
    DEFAULT_EXPIRY  = 24.hours
    ADMIN_URL       = ENV.fetch("ADMIN_URL", "https://app.univerreviews.com").freeze
    FROM_EMAIL      = ENV.fetch("FROM_EMAIL", "auth@univerreviews.com").freeze
    # Allowed character set matches Better Auth's
    # generateRandomString(32, "a-z", "A-Z") so tokens look identical to
    # those minted by the JS API and pass any future format sniff-tests.
    TOKEN_ALPHABET  = (("a".."z").to_a + ("A".."Z").to_a).freeze

    Result = Struct.new(:token, :url, :verification_id, keyword_init: true)

    # @param email [String] buyer e-mail (already lowercased by caller)
    # @param name  [String] display name to surface on first login (used when
    #              Better Auth needs to call createUser on verification)
    # @param expires_in [ActiveSupport::Duration]
    # @param callback_path [String] post-verification redirect (relative URL)
    # @return [Result]
    def self.issue!(email:, name:, expires_in: DEFAULT_EXPIRY, callback_path: "/")
      raise ArgumentError, "email required" if email.blank?

      # 32 chars from a-zA-Z, matching Better Auth's
      # `generateRandomString(32, "a-z", "A-Z")` so the token shape is
      # indistinguishable from one minted by the JS API.
      raw_token       = SecureRandom.random_bytes(32).bytes.map { |b| TOKEN_ALPHABET[b % TOKEN_ALPHABET.length] }.join
      verification_id = SecureRandom.uuid
      identifier      = raw_token
      value_json      = JSON.generate(email: email, name: name)
      expires_at      = Time.current + expires_in

      # Direct SQL with parameter binding — `auth.verification` is owned by
      # Better Auth (Drizzle migrations), not Rails, so we deliberately
      # bypass ActiveRecord here.
      ActiveRecord::Base.connection.execute(
        ActiveRecord::Base.sanitize_sql([
          "INSERT INTO auth.verification (id, identifier, value, expires_at, created_at, updated_at) " \
          "VALUES (?, ?, ?, ?, NOW(), NOW())",
          verification_id, identifier, value_json, expires_at
        ])
      )

      callback = callback_path.to_s.start_with?("/") ? callback_path : "/"
      url = "#{ADMIN_URL.chomp('/')}/api/auth/magic-link/verify?token=#{CGI.escape(raw_token)}&callbackURL=#{CGI.escape(callback)}"

      Result.new(token: raw_token, url: url, verification_id: verification_id)
    end

    # Send the magic-link e-mail. Returns the Result.
    # Failure to send is logged + captured to Sentry but does not raise —
    # the webhook should still 200 (the row is in DB; ops can resend).
    def self.send_email!(email:, name:, url:, workspace_name:)
      if ENV["RESEND_API_KEY"].to_s.empty?
        Rails.logger.warn("[payment-webhook] RESEND_API_KEY missing — would mail #{email}")
        return false
      end

      Resend::Emails.send({
        from: "UniverReviews <#{FROM_EMAIL}>",
        to: email,
        subject: "Sua conta UniverReviews está pronta — #{workspace_name}",
        html: render_email(name: name, url: url, workspace_name: workspace_name)
      })
      true
    rescue => e
      Rails.logger.error("[payment-webhook] magic-link mail failed for #{email}: #{e.message}")
      Sentry.capture_exception(e) if defined?(Sentry)
      false
    end

    # Convenience: mint + mail in one call. Returns the Result regardless of
    # whether the e-mail send succeeded.
    def self.issue_and_send!(email:, name:, workspace_name:, expires_in: DEFAULT_EXPIRY, callback_path: "/")
      result = issue!(email: email, name: name, expires_in: expires_in, callback_path: callback_path)
      send_email!(email: email, name: name, url: result.url, workspace_name: workspace_name)
      result
    end

    def self.render_email(name:, url:, workspace_name:)
      first_name = name.to_s.split(" ").first.presence || "olá"
      <<~HTML
        <!DOCTYPE html>
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                       background: #0a0a0b; color: #f0f0f2; margin: 0; padding: 40px;">
            <div style="max-width: 520px; margin: 0 auto; background: #111114; border-radius: 14px;
                        padding: 40px; border: 1px solid #1f1f24;">
              <h1 style="font-size: 22px; font-weight: 600; color: #d4a850; margin: 0 0 6px;">
                UniverReviews
              </h1>
              <p style="color: #8b8b96; margin: 0 0 28px; font-size: 14px;">#{ERB::Util.html_escape(workspace_name)}</p>

              <h2 style="font-size: 18px; font-weight: 500; color: #f0f0f2; margin: 0 0 16px;">
                #{ERB::Util.html_escape(first_name.capitalize)}, seu acesso está pronto.
              </h2>
              <p style="color: #b8b8c2; font-size: 14px; line-height: 1.65; margin: 0 0 28px;">
                Recebemos seu pagamento e criamos seu workspace. Clique no botão abaixo
                para entrar — sem senha, sem fricção. O link é válido por 24 horas.
              </p>

              <a href="#{ERB::Util.html_escape(url)}"
                 style="display: inline-block; background: linear-gradient(135deg, #d4a850, #c49040);
                        color: #0a0a0b; text-decoration: none; padding: 14px 32px;
                        border-radius: 10px; font-weight: 600; font-size: 15px;">
                Entrar no UniverReviews
              </a>

              <p style="color: #5a5a64; font-size: 12px; margin: 36px 0 0; line-height: 1.6;">
                Se este e-mail chegou por engano, ignore-o. Nenhuma ação será feita até
                que o link seja aberto.
              </p>
            </div>
          </body>
        </html>
      HTML
    end
  end
end

module Payment
  # Business logic for /api/v1/webhooks/payment.
  #
  # Extracted from the controller so it is unit-testable without exercising
  # HMAC verification, request mocking, or the full Rack stack. The
  # controller is responsible for:
  #   • HMAC verification
  #   • Body-size + content-type gating
  #   • Idempotency row insertion (PaymentEvent)
  # Everything that touches DB state lives here.
  #
  # Flow:
  #   1. Lowercase + sanity-check the buyer e-mail
  #   2. Validate the plan against ALLOWED_PLANS
  #   3. Find-or-create the Better Auth user (auth.user, direct SQL)
  #   4. Find existing WorkspaceUser by lower(email)
  #      → no match: provision a brand-new workspace + workspace_user (owner)
  #      → match w/ NULL better_auth_user_id: link them
  #      → match w/ different plan: upgrade workspace.plan + audit
  #   5. Mint a 24h Better Auth magic-link + mail it
  #   6. Audit log the success
  #
  # Returns a hash describing what happened (used by specs + ops audit).
  class WebhookProcessor
    # Plan whitelist mirrors T1.3 rename (entry|medium|ultra). Until the DB
    # check constraint catches up, we ALSO accept the legacy free/starter/pro/
    # enterprise names so the rename can land without breaking webhooks
    # mid-deploy. Unknown plans are rejected outright.
    ALLOWED_PLANS = %w[entry medium ultra free starter pro enterprise].freeze

    Result = Struct.new(
      :ok,
      :workspace_id,
      :workspace_user_id,
      :better_auth_user_id,
      :magic_link_url,
      :provisioned,        # :new | :linked | :upgraded | :noop
      :error,
      keyword_init: true
    )

    # @param payload [Hash] parsed JSON body (already verified upstream)
    # @param request [ActionDispatch::Request, nil] for audit log ip/UA
    def self.process!(payload, request: nil)
      new(payload, request: request).process!
    end

    def initialize(payload, request: nil)
      @payload = payload || {}
      @request = request
    end

    def process!
      buyer    = @payload["buyer"] || {}
      email    = buyer["email"].to_s.downcase.strip
      name     = buyer["name"].to_s.strip.presence || email.split("@").first.to_s
      plan     = @payload["plan"].to_s.strip.downcase
      amount   = @payload["amount_cents"].to_i
      currency = @payload["currency"].to_s.upcase.presence || "BRL"

      if email.blank? || !email.include?("@")
        return Result.new(ok: false, error: "invalid_email")
      end
      unless ALLOWED_PLANS.include?(plan)
        return Result.new(ok: false, error: "invalid_plan:#{plan}")
      end

      ba_user_id = find_or_create_better_auth_user!(email: email, name: name)

      ws_user, provisioned = find_or_provision_workspace_user!(
        email: email,
        name:  name,
        plan:  plan,
        better_auth_user_id: ba_user_id
      )

      workspace = ws_user.workspace

      # Audit ALWAYS — even on a no-op so the operations team has a paper
      # trail of every paid event that hit the workspace.
      AuditLog.record(
        workspace: workspace,
        action: "payment.processed",
        metadata: {
          transaction_id: @payload["transaction_id"].to_s,
          plan:           plan,
          amount_cents:   amount,
          currency:       currency,
          provisioned:    provisioned.to_s
        },
        request: @request
      )

      # Magic-link is sent in ALL cases. Repeat buyers pay → repeat link;
      # this is the founder's intentional choice (zero-password onboarding).
      magic = MagicLinkIssuer.issue_and_send!(
        email: email,
        name:  name,
        workspace_name: workspace.name
      )

      Result.new(
        ok: true,
        workspace_id:        workspace.id,
        workspace_user_id:   ws_user.id,
        better_auth_user_id: ba_user_id,
        magic_link_url:      magic.url,
        provisioned:         provisioned
      )
    end

    private

    # ── Better Auth user ────────────────────────────────────────────────
    # Direct SQL because `auth.user` is owned by Drizzle, not Rails. We
    # treat it the way the migration rake task does (see lib/tasks/
    # auth_migration.rake#upsert_better_auth_user!).
    def find_or_create_better_auth_user!(email:, name:)
      conn = ActiveRecord::Base.connection

      # Better Auth's email lookup is case-insensitive but the column is
      # stored as-typed. We always insert lowercase and look up lowercase.
      existing = conn.exec_query(
        "SELECT id FROM auth.user WHERE LOWER(email) = $1 LIMIT 1",
        "find_ba_user",
        [email]
      ).first
      return existing["id"] if existing

      user_id = SecureRandom.uuid
      conn.exec_query(
        "INSERT INTO auth.user (id, name, email, email_verified, role, created_at, updated_at) " \
        "VALUES ($1, $2, $3, true, 'user', NOW(), NOW())",
        "create_ba_user",
        [user_id, name, email]
      )
      user_id
    end

    # ── workspace_users provisioning ────────────────────────────────────
    # Mirrors lib/auth.ts databaseHooks.user.create.after but with the plan
    # supplied by the payment webhook (not 'free'/'trial'). RLS is bypassed
    # so the cross-tenant email lookup works.
    def find_or_provision_workspace_user!(email:, name:, plan:, better_auth_user_id:)
      ws_user        = nil
      provisioned    = :noop

      ActiveRecord::Base.transaction do
        conn = ActiveRecord::Base.connection
        begin
          conn.execute("SET LOCAL row_security = off")
        rescue => e
          Rails.logger.warn("[payment-webhook] cannot bypass RLS: #{e.message}")
        end

        ws_user = WorkspaceUser.where("LOWER(email) = ?", email).first

        if ws_user.nil?
          # Brand-new tenant: create workspace + workspace_user. Slug
          # derivation mirrors lib/auth.ts so users provisioned via the
          # signup path and via this webhook end up with identical
          # workspace URLs.
          local_part = email.split("@").first.to_s
          base_slug = local_part.downcase.gsub(/[^a-z0-9-]/, "-").gsub(/-+/, "-").gsub(/\A-|-\z/, "")[0, 24]
          base_slug = "workspace" if base_slug.blank?
          suffix    = SecureRandom.alphanumeric(6).downcase
          slug      = "#{base_slug}-#{suffix}"

          # SET LOCAL app.workspace_id needs a non-blank value; use a
          # zero-UUID sentinel just so RLS doesn't reject the writes we're
          # about to perform.
          conn.execute(
            ActiveRecord::Base.sanitize_sql([
              "SET LOCAL app.workspace_id = ?", "00000000-0000-0000-0000-000000000000"
            ])
          )

          workspace = Workspace.create!(
            slug:             slug,
            name:             name.presence || local_part.presence || "Meu workspace",
            plan:             plan_for_workspace(plan),
            status:           "active",          # they paid
            brand_color:      "#d4a850",
            default_locale:   "pt-BR",
            default_currency: "BRL"
          )

          # Re-pin RLS to the freshly-minted workspace before inserting the
          # workspace_user (workspace_users has FORCE RLS).
          conn.execute(
            ActiveRecord::Base.sanitize_sql([
              "SET LOCAL app.workspace_id = ?", workspace.id.to_s
            ])
          )

          ws_user = WorkspaceUser.create!(
            workspace_id:        workspace.id,
            email:               email,
            name:                name,
            role:                "owner",
            better_auth_user_id: better_auth_user_id
          )
          provisioned = :new
        else
          # Existing workspace_user. Pin RLS to it for any update we do.
          conn.execute(
            ActiveRecord::Base.sanitize_sql([
              "SET LOCAL app.workspace_id = ?", ws_user.workspace_id.to_s
            ])
          )

          if ws_user.better_auth_user_id.blank?
            ws_user.update!(better_auth_user_id: better_auth_user_id)
            provisioned = :linked
          end

          ws        = ws_user.workspace
          new_plan  = plan_for_workspace(plan)

          if ws.plan != new_plan
            previous_plan = ws.plan
            ws.update!(plan: new_plan, status: "active")
            provisioned = :upgraded
            AuditLog.record(
              workspace: ws,
              action: "workspace.plan_changed",
              metadata: { from: previous_plan, to: new_plan, source: "payment_webhook" },
              request: @request
            )
          end
        end
      end

      [ws_user, provisioned]
    end

    # The `workspaces.plan` column currently constrains to the legacy
    # %w[free starter pro enterprise]. T1.3 renames the set to
    # entry|medium|ultra. Until that rename lands (agent C, parallel
    # branch), pass legacy plans straight through and translate the new
    # names to their nearest legacy equivalent so we don't fail validation.
    LEGACY_PLAN_FALLBACK = {
      "entry"  => "starter",
      "medium" => "pro",
      "ultra"  => "enterprise"
    }.freeze

    def plan_for_workspace(plan)
      return plan if Workspace::PLANS.include?(plan)
      LEGACY_PLAN_FALLBACK[plan] || "starter"
    end
  end
end

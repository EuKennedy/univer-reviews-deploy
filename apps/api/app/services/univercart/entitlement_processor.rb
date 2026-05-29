module Univercart
  # Drives every `entitlement.*` webhook into our domain model:
  #
  #   entitlement.granted     → provision (create/upsert) workspace + owner
  #   entitlement.role_changed → flip workspace.plan
  #   entitlement.suspended    → workspace.status = 'suspended'
  #   entitlement.reactivated  → workspace.status = 'active'
  #   entitlement.revoked      → workspace.status = 'cancelled'
  #
  # The join key is `data.externalUserId` (Univercart's subscription id),
  # mirrored into `workspaces.univercart_subscription_id`. One Univercart
  # subscription is exactly one of our workspaces; a second purchase by
  # the same email creates a second workspace and the Better Auth user
  # ends up linked to both via separate workspace_users rows.
  class EntitlementProcessor
    ALLOWED_PLANS = %w[entry medium ultra].freeze
    SLUG_RE       = /\A[a-z0-9-]+\z/

    Result = Struct.new(
      :ok,
      :workspace_id,
      :workspace_slug,
      :workspace_user_id,
      :better_auth_user_id,
      :provisioned,        # :new | :linked | :upgraded | :status_changed | :noop | :skipped
      :error,
      keyword_init: true
    )

    def self.process!(event_type:, data:, request: nil)
      new(event_type: event_type, data: (data || {}), request: request).process!
    end

    def initialize(event_type:, data:, request: nil)
      @event_type = event_type.to_s
      @data       = data
      @request    = request
    end

    def process!
      sub_id = @data["externalUserId"].to_s
      if sub_id.empty?
        return Result.new(ok: false, error: "missing_external_user_id")
      end

      case @event_type
      when "entitlement.granted"     then handle_granted(sub_id)
      when "entitlement.role_changed" then handle_role_change(sub_id)
      when "entitlement.suspended"    then handle_status(sub_id, target_status: "suspended", audit: "univercart.entitlement.suspended")
      when "entitlement.reactivated"  then handle_status(sub_id, target_status: "active",    audit: "univercart.entitlement.reactivated")
      when "entitlement.revoked"      then handle_status(sub_id, target_status: "cancelled", audit: "univercart.entitlement.revoked")
      else
        Result.new(ok: false, error: "unhandled_event_type")
      end
    end

    private

    # ── granted ─────────────────────────────────────────────────────────
    def handle_granted(sub_id)
      email = @data["email"].to_s.downcase.strip
      name  = @data["name"].to_s.strip.presence || email.split("@").first.to_s
      role  = @data["role"].to_s.downcase

      return Result.new(ok: false, error: "missing_email")        if email.empty? || !email.include?("@")
      return Result.new(ok: false, error: "unknown_plan: #{role}") unless ALLOWED_PLANS.include?(role)

      ba_user_id  = find_or_create_better_auth_user!(email: email, name: name)
      workspace   = upsert_workspace_for_subscription!(sub_id: sub_id, email: email, name: name, role: role)
      ws_user     = ensure_owner_link!(workspace: workspace, email: email, name: name, ba_user_id: ba_user_id)
      provisioned = @provisioned_state || :linked

      AuditLog.record(
        workspace: workspace,
        action:    "univercart.entitlement.granted",
        entity:    workspace,
        metadata:  {
          subscription_id: sub_id,
          email:           email,
          role:            role,
          provisioned:     provisioned.to_s,
          valid_until:     @data["validUntil"],
          plan_id:         @data["planId"],
        },
        request: @request,
      )

      Result.new(
        ok:                   true,
        workspace_id:         workspace.id,
        workspace_slug:       workspace.slug,
        workspace_user_id:    ws_user&.id,
        better_auth_user_id:  ba_user_id,
        provisioned:          provisioned,
      )
    end

    # ── role_changed ────────────────────────────────────────────────────
    def handle_role_change(sub_id)
      role = @data["role"].to_s.downcase
      return Result.new(ok: false, error: "unknown_plan: #{role}") unless ALLOWED_PLANS.include?(role)

      ws = Workspace.find_by(univercart_subscription_id: sub_id)
      return Result.new(ok: false, error: "workspace_not_found")  unless ws

      previous = ws.plan
      if previous == role
        return Result.new(ok: true, workspace_id: ws.id, workspace_slug: ws.slug, provisioned: :noop)
      end

      ws.update!(
        plan: role,
        univercart_valid_until: parse_iso(@data["validUntil"]) || ws.univercart_valid_until,
      )
      AuditLog.record(
        workspace: ws,
        action:    "univercart.entitlement.role_changed",
        entity:    ws,
        metadata:  {
          subscription_id: sub_id,
          previous_role:   previous,
          new_role:        role,
          effective_at:    @data["effectiveAt"],
        },
        request: @request,
      )
      Result.new(ok: true, workspace_id: ws.id, workspace_slug: ws.slug, provisioned: :upgraded)
    end

    # ── suspended / reactivated / revoked ───────────────────────────────
    def handle_status(sub_id, target_status:, audit:)
      ws = Workspace.find_by(univercart_subscription_id: sub_id)
      return Result.new(ok: false, error: "workspace_not_found") unless ws

      previous = ws.status
      if previous == target_status
        return Result.new(ok: true, workspace_id: ws.id, workspace_slug: ws.slug, provisioned: :noop)
      end

      attrs = { status: target_status }
      attrs[:univercart_valid_until] = parse_iso(@data["validUntil"]) if @data["validUntil"].present?
      ws.update!(attrs)

      AuditLog.record(
        workspace: ws,
        action:    audit,
        entity:    ws,
        metadata:  {
          subscription_id: sub_id,
          previous_status: previous,
          new_status:      target_status,
          reason:          @data["reason"],
          attempts_made:   @data["attemptsMade"],
          will_retry_at:   @data["willRetryAt"],
          revoked_at:      @data["revokedAt"],
        }.compact,
        request: @request,
      )
      Result.new(ok: true, workspace_id: ws.id, workspace_slug: ws.slug, provisioned: :status_changed)
    end

    # ── helpers ────────────────────────────────────────────────────────
    def upsert_workspace_for_subscription!(sub_id:, email:, name:, role:)
      ws = Workspace.find_by(univercart_subscription_id: sub_id)
      if ws.nil?
        ws = Workspace.new(
          slug:                       derive_slug(email),
          name:                       name.presence || email.split("@").first || "Workspace",
          plan:                       role,
          status:                     "active",
          brand_color:                "#d4a850",
          default_locale:             "pt-BR",
          default_currency:           "BRL",
          univercart_subscription_id: sub_id,
          univercart_email:           email,
          univercart_valid_until:     parse_iso(@data["validUntil"]),
        )
        @provisioned_state = :new
      else
        ws.assign_attributes(
          plan:                   role,
          status:                 "active",
          univercart_email:       email,
          univercart_valid_until: parse_iso(@data["validUntil"]) || ws.univercart_valid_until,
        )
        @provisioned_state = ws.changed? ? :upgraded : :noop
      end
      ws.save!
      ws
    end

    def ensure_owner_link!(workspace:, email:, name:, ba_user_id:)
      wu = workspace.workspace_users.find_by("LOWER(email) = ?", email)
      if wu.nil?
        wu = workspace.workspace_users.create!(
          email:               email,
          name:                name,
          role:                "owner",
          better_auth_user_id: ba_user_id,
        )
      elsif wu.better_auth_user_id.blank?
        wu.update!(better_auth_user_id: ba_user_id)
      end
      wu
    end

    # Inserts a row into auth.user directly because Better Auth's JS API
    # isn't reachable from Rails. We mimic the schema contract: UUID id,
    # email_verified = true (Univercart already verified by collecting
    # payment), role = 'user'. Returns the user id either fresh or
    # pre-existing.
    def find_or_create_better_auth_user!(email:, name:)
      existing = ActiveRecord::Base.connection.exec_query(
        ActiveRecord::Base.sanitize_sql([
          %(SELECT id FROM auth."user" WHERE LOWER(email) = ? LIMIT 1),
          email,
        ])
      ).first
      return existing["id"] if existing

      user_id = SecureRandom.uuid
      ActiveRecord::Base.connection.exec_query(
        ActiveRecord::Base.sanitize_sql([
          %(INSERT INTO auth."user" (id, name, email, email_verified, role, created_at, updated_at)
            VALUES (?, ?, ?, true, 'user', NOW(), NOW())),
          user_id, name, email,
        ])
      )
      user_id
    end

    def derive_slug(email)
      local = email.to_s.split("@").first.to_s
      base  = local.downcase.gsub(/[^a-z0-9-]/, "-").squeeze("-").gsub(/\A-|-\z/, "")[0, 24]
      base  = "workspace" if base.blank?
      candidate = "#{base}-#{SecureRandom.hex(3)}"
      # Re-roll on the unlikely collision so we never bomb on the slug
      # unique index. Three retries is enough — the hex suffix gives 16M
      # entries; the loop is purely defensive.
      3.times do
        return candidate unless Workspace.exists?(slug: candidate)
        candidate = "#{base}-#{SecureRandom.hex(3)}"
      end
      candidate
    end

    def parse_iso(value)
      return nil if value.blank?
      Time.iso8601(value.to_s)
    rescue ArgumentError
      nil
    end
  end
end

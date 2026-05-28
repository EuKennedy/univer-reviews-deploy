module Api
  module V1
    module SuperAdmin
      # Base controller for every Api::V1::SuperAdmin::* endpoint.
      #
      # Founder-only ops surface. Diverges from the regular per-tenant
      # ApplicationController in three deliberate ways:
      #
      #   1. NO `set_current_workspace` callback. Super admin actions are
      #      cross-tenant by design — they list/manage *every* workspace,
      #      so binding the request to a single one is wrong. We still wrap
      #      the action in a transaction so any `SET LOCAL` we issue is
      #      scoped to the request.
      #
      #   2. RLS is explicitly disabled for the request. Super admin needs
      #      to read across the FORCE ROW LEVEL SECURITY boundary (audit
      #      logs, workspace_users, etc). We `SET LOCAL row_security = off`
      #      which only works if the DB role has BYPASSRLS — production
      #      app role MUST have it. If the DB rejects the statement we log
      #      and continue; the policies would still allow workspace-id-bound
      #      reads but cross-tenant listings would return empty.
      #
      #   3. Auth resolution returns 404 (not 401/403) on failure. We do
      #      not want unauthenticated visitors or non-admins to learn that
      #      /api/v1/super_admin/* exists at all. Same defense as the
      #      Next.js /super layout — the route is invisible to non-admins.
      class ApplicationController < ::ApplicationController
        # Override the parent's callback chain. Super admin requests live
        # outside the workspace-bound auth flow because they operate on
        # every workspace at once.
        skip_before_action :set_current_workspace
        skip_around_action :request_transaction

        around_action :super_admin_request_transaction
        before_action  :require_super_admin!

        private

        # Wrap every super admin action in a transaction so the `SET LOCAL
        # row_security = off` we issue stays scoped to this request. Without
        # the wrapping transaction SET LOCAL silently degrades to session-
        # level state and pollutes pooled connections.
        def super_admin_request_transaction(&block)
          ActiveRecord::Base.transaction(&block)
        end

        # Look up the Better Auth session, verify the user has role='admin'.
        # Failure mode is 404 (head :not_found) intentionally — see header.
        def require_super_admin!
          token = extract_session_token.presence || extract_bearer_token
          return deny if token.blank?

          found = lookup_better_auth_session(token)
          return deny unless found

          ba_user = found[:user]
          return deny unless ba_user&.respond_to?(:role) && ba_user.role.to_s == "admin"

          @current_ba_user    = ba_user
          @current_ba_session = found[:session]

          # Disable RLS for the entire request. Requires BYPASSRLS on the
          # app DB role. If we can't disable it, super admin listings of
          # workspace-scoped tables (audit_logs, workspace_users) will
          # return empty rows — which is a safer fail mode than leaking.
          disable_rls!
        end

        def disable_rls!
          ActiveRecord::Base.connection.execute("SET LOCAL row_security = off")
        rescue ActiveRecord::StatementInvalid => e
          Rails.logger.warn("[super_admin] cannot disable RLS — grant BYPASSRLS to app DB role: #{e.message}")
        end

        # 404, not 403/401 — we don't want an unauthenticated visitor or a
        # logged-in non-admin to discover that /super_admin/* exists.
        def deny
          head :not_found
        end

        # Email of the human performing the action. Logged into every
        # AuditLog metadata payload so the operator can later trace who
        # did what across tenants.
        def actor_email
          @current_ba_user&.email
        end

        # Workspaces are NOT RLS-protected (the table itself is the
        # tenant boundary). Used by the workspaces controller index.
        def all_workspaces_scope
          Workspace.all
        end
      end
    end
  end
end

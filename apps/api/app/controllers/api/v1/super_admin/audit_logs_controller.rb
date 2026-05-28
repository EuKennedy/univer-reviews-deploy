module Api
  module V1
    module SuperAdmin
      # Audit log feed for the super admin panel — read-only.
      # Scoped to a single workspace at a time (nested under
      # /super_admin/workspaces/:workspace_id/audit_logs) so the operator
      # can dig into one tenant without leaking another's history into the
      # response.
      class AuditLogsController < ApplicationController
        # GET /api/v1/super_admin/workspaces/:workspace_id/audit_logs
        def index
          ws = Workspace.find_by(id: params[:workspace_id])
          return head :not_found unless ws

          scope = ws.audit_logs.recent
          scope = scope.where(action: params[:action]) if params[:action].present?
          scope = scope.where("action LIKE ?", "super_admin.%") if params[:scope] == "super_admin"

          if params[:from].present?
            scope = scope.where("created_at >= ?", Time.zone.parse(params[:from].to_s))
          end
          if params[:to].present?
            scope = scope.where("created_at <= ?", Time.zone.parse(params[:to].to_s))
          end

          pagy, rows = paginate(scope.includes(:user))

          render json: {
            data: rows.map { |row| serialize_log(row) },
            meta: pagination_meta(pagy),
          }
        end

        private

        def serialize_log(row)
          actor = if row.user
                    { id: row.user.id, email: row.user.email, name: row.user.name }
                  elsif row.metadata.is_a?(Hash) && row.metadata["actor_email"].present?
                    # Super-admin actions carry the operator's email in
                    # metadata since `user_id` is nil for them.
                    { id: nil, email: row.metadata["actor_email"], name: "Super admin" }
                  end

          {
            id:          row.id,
            action:      row.action,
            entity_type: row.entity_type,
            entity_id:   row.entity_id,
            metadata:    row.metadata,
            actor:       actor,
            ip_address:  row.ip_address,
            user_agent:  row.user_agent,
            created_at:  row.created_at&.iso8601,
          }
        end
      end
    end
  end
end

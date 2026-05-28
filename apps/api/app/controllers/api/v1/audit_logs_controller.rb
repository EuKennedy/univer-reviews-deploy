module Api
  module V1
    # Workspace audit log — read-only. Surfaces who did what when.
    #
    # Defense-in-depth on top of Rails RLS: the controller still scopes
    # via `current_workspace.audit_logs` so even if a policy regression
    # slipped in we'd never serve another tenant's history.
    class AuditLogsController < ApplicationController
      # GET /api/v1/audit_logs?action=...&user_id=...&from=...&to=...&entity_type=...&entity_id=...
      def index
        scope = current_workspace.audit_logs.recent

        scope = scope.where(action: params[:action])      if params[:action].present?
        scope = scope.where(entity_type: params[:entity_type]) if params[:entity_type].present?
        scope = scope.where(entity_id:   params[:entity_id])   if params[:entity_id].present?
        scope = scope.where(user_id: params[:user_id])    if params[:user_id].present?

        if params[:from].present?
          scope = scope.where("created_at >= ?", Time.zone.parse(params[:from].to_s))
        end
        if params[:to].present?
          scope = scope.where("created_at <= ?", Time.zone.parse(params[:to].to_s))
        end

        pagy, logs = paginate(scope.includes(:user))

        render json: {
          data: logs.map { |row| serialize_log(row) },
          meta: pagination_meta(pagy),
        }
      end

      # GET /api/v1/audit_logs/actions — distinct list for the filter
      # dropdown UI. Keeps the admin from having to guess action names.
      def actions_list
        list = current_workspace.audit_logs
                                .select(:action)
                                .distinct
                                .order(:action)
                                .pluck(:action)
        render json: { data: list }
      end

      private

      def serialize_log(row)
        {
          id:          row.id,
          action:      row.action,
          entity_type: row.entity_type,
          entity_id:   row.entity_id,
          metadata:    row.metadata,
          actor:       row.user ? { id: row.user.id, email: row.user.email, name: row.user.name } : nil,
          ip_address:  row.ip_address,
          user_agent:  row.user_agent,
          created_at:  row.created_at&.iso8601,
        }
      end
    end
  end
end

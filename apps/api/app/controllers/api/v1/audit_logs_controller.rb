module Api
  module V1
    class AuditLogsController < ApplicationController
      def index
        scope = current_workspace.audit_logs

        scope = scope.where(action: params[:action])         if params[:action].present?
        scope = scope.where(entity_type: params[:entity])    if params[:entity].present?
        scope = scope.where(user_id: params[:user_id])       if params[:user_id].present?

        if params[:from].present?
          scope = scope.where("created_at >= ?", Time.zone.parse(params[:from]))
        end

        if params[:to].present?
          scope = scope.where("created_at <= ?", Time.zone.parse(params[:to]))
        end

        scope = scope.order(created_at: :desc)

        pagy, logs = paginate(scope)

        render json: {
          data: logs.as_json(only: %i[id action entity_type entity_id metadata ip_address created_at user_id]),
          meta: pagination_meta(pagy)
        }
      end
    end
  end
end

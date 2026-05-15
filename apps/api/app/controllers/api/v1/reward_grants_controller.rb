module Api
  module V1
    class RewardGrantsController < ApplicationController
      def index
        scope = current_workspace.reward_grants

        scope = scope.where(status: params[:status])          if params[:status].present?
        scope = scope.where(customer_email: params[:email])   if params[:email].present?
        scope = scope.where(rule_id: params[:rule_id])        if params[:rule_id].present?
        scope = scope.order(created_at: :desc)

        pagy, grants = paginate(scope)

        render json: {
          data: grants.as_json,
          meta: pagination_meta(pagy)
        }
      end

      def show
        grant = current_workspace.reward_grants.find(params[:id])
        render json: { data: grant.as_json }
      end
    end
  end
end

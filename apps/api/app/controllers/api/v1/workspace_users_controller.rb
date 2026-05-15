module Api
  module V1
    class WorkspaceUsersController < ApplicationController
      before_action :set_user, only: %i[update destroy]

      # GET /api/v1/workspace/users
      def index
        users = current_workspace.workspace_users.order(created_at: :asc)
        render json: { data: users.map { |u| serialize_user(u) } }
      end

      # POST /api/v1/workspace/users
      def create
        require_write!

        user = current_workspace.workspace_users.new(user_params)

        if user.save
          render json: { data: serialize_user(user) }, status: :created
        else
          render json: { error: "unprocessable_entity", issues: user.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/workspace/users/:id
      def update
        require_write!

        # Prevent removing last owner
        if @user.owner? && user_params[:role].present? && user_params[:role] != "owner"
          owners = current_workspace.workspace_users.where(role: "owner").count
          if owners <= 1
            render json: { error: "forbidden", message: "Cannot demote the last owner" }, status: :forbidden
            return
          end
        end

        if @user.update(user_params)
          render json: { data: serialize_user(@user) }
        else
          render json: { error: "unprocessable_entity", issues: @user.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/workspace/users/:id
      def destroy
        require_write!

        if @user.owner? && current_workspace.workspace_users.where(role: "owner").count <= 1
          render json: { error: "forbidden", message: "Cannot delete the last owner" }, status: :forbidden
          return
        end

        @user.destroy!
        head :no_content
      end

      private

      def set_user
        @user = current_workspace.workspace_users.find(params[:id])
      end

      def user_params
        params.require(:user).permit(:email, :name, :role)
      end

      def serialize_user(u)
        {
          id: u.id, email: u.email, name: u.name, role: u.role,
          last_login_at: u.last_login_at&.iso8601, created_at: u.created_at&.iso8601
        }
      end
    end
  end
end

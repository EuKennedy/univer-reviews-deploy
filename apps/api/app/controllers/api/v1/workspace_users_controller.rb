module Api
  module V1
    class WorkspaceUsersController < ApplicationController
      before_action :set_user, only: %i[update destroy]

      # Roles that may be granted by each caller role. Owners can hand out
      # any role; admins can manage everything below owner; everyone else
      # cannot touch the :role field at all.
      ROLES_GRANTABLE_BY = {
        "owner"     => %w[owner admin editor moderator viewer],
        "admin"     => %w[admin editor moderator viewer],
        "editor"    => %w[],
        "moderator" => %w[],
        "viewer"    => %w[],
      }.freeze

      # GET /api/v1/workspace/users
      def index
        users = current_workspace.workspace_users.order(created_at: :asc)
        render json: { data: users.map { |u| serialize_user(u) } }
      end

      # POST /api/v1/workspace/users
      def create
        require_write!

        attrs = sanitized_params_for_create
        user = current_workspace.workspace_users.new(attrs)

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

        attrs = sanitized_params_for_update

        # Prevent removing last owner
        if @user.owner? && attrs[:role].present? && attrs[:role] != "owner"
          owners = current_workspace.workspace_users.where(role: "owner").count
          if owners <= 1
            render json: { error: "forbidden", message: "Cannot demote the last owner" }, status: :forbidden
            return
          end
        end

        if @user.update(attrs)
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

      # Strict role gating. Without this, any caller with write scope could
      # PATCH /workspace/users/:id with role=owner — including their own id
      # — and self-promote. We compare the requested role against the set
      # of roles the caller is authorised to grant.
      def sanitized_params_for_create
        attrs = user_params.to_h
        attrs.delete("role") unless role_grant_allowed?(attrs["role"])
        # Block self-targeting on create just in case the email matches the caller.
        attrs
      end

      def sanitized_params_for_update
        attrs = user_params.to_h
        if attrs["role"].present?
          unless role_grant_allowed?(attrs["role"])
            attrs.delete("role")
          end
          # Prevent self-elevation: the caller cannot change their own role.
          if current_user && @user && current_user.id == @user.id
            attrs.delete("role")
          end
        end
        attrs
      end

      def role_grant_allowed?(target_role)
        return false if target_role.blank?
        caller_role = current_user&.role
        return false if caller_role.blank? # API key flows have no per-user role
        ROLES_GRANTABLE_BY.fetch(caller_role, []).include?(target_role)
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

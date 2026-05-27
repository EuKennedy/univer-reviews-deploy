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

      # SAFE attributes — anything the caller is always allowed to set.
      # `role` is deliberately NOT in this list: it's a privilege boundary
      # and must be granted through `requested_role_if_allowed` after an
      # authorization check (see ROLES_GRANTABLE_BY). Splitting the permit
      # call keeps mass-assignment static-analyzable: Brakeman can see that
      # role can never reach `update`/`new` without passing the grant gate.
      def user_safe_params
        params.require(:user).permit(:email, :name)
      end

      # Caller-supplied role, returned ONLY when:
      #   • the caller is allowed to grant that role, AND
      #   • (on update) the caller isn't trying to elevate themselves.
      # Returns nil otherwise. The result is merged into the create/update
      # hash by the public helpers below.
      def requested_role_if_allowed(target_user: nil)
        requested = params.dig(:user, :role).presence
        return nil if requested.blank?
        return nil unless role_grant_allowed?(requested)
        # Prevent self-elevation on update.
        return nil if target_user && current_user && current_user.id == target_user.id
        requested
      end

      # Strict role gating. Without this, any caller with write scope could
      # PATCH /workspace/users/:id with role=owner — including their own id
      # — and self-promote.
      def sanitized_params_for_create
        attrs = user_safe_params.to_h
        role = requested_role_if_allowed
        attrs["role"] = role if role
        attrs
      end

      def sanitized_params_for_update
        attrs = user_safe_params.to_h
        role = requested_role_if_allowed(target_user: @user)
        attrs["role"] = role if role
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

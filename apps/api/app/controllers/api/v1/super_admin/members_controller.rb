module Api
  module V1
    module SuperAdmin
      # Per-member ops on a tenant the founder is cross-cutting into. The
      # workspace-scoped TeamController already lets workspace owners
      # manage their own members; this namespace exists so the founder can
      # do it without setting app.workspace_id and without being a member.
      #
      # Every action records an audit row tagged `super_admin.member.*`.
      class MembersController < ApplicationController
        before_action :set_workspace
        before_action :set_member,  only: %i[update destroy]

        # GET /api/v1/super_admin/workspaces/:workspace_id/members
        def index
          rows = @workspace.workspace_users.order(created_at: :asc).map { |u| serialize_member(u) }
          render json: { data: rows, meta: { effective_seat_limit: @workspace.effective_seat_limit } }
        end

        # PATCH /api/v1/super_admin/workspaces/:workspace_id/members/:id
        # body: { role: 'owner'|'admin'|'editor'|'moderator'|'viewer' }
        def update
          requested = params[:role].to_s
          unless WorkspaceUser::ROLES.include?(requested)
            return render json: { error: "bad_request", message: "Unknown role #{requested.inspect}" },
                          status: :bad_request
          end

          # Owner-transfer guard: we never leave a workspace ownerless. If
          # the request demotes the sole owner, refuse — operator should
          # promote a second member first.
          if @member.role == "owner" && requested != "owner"
            owners = @workspace.workspace_users.where(role: "owner").count
            if owners <= 1
              return render json: { error: "last_owner",
                                    message: "Promote another member to owner before demoting this one" },
                            status: :unprocessable_entity
            end
          end

          previous = @member.role
          @member.update!(role: requested)
          record_audit("super_admin.member.role_changed",
                       metadata: {
                         member_id:     @member.id,
                         member_email:  @member.email,
                         previous_role: previous,
                         new_role:      requested,
                       })
          render json: { data: serialize_member(@member) }
        end

        # DELETE /api/v1/super_admin/workspaces/:workspace_id/members/:id
        def destroy
          if @member.role == "owner"
            owners = @workspace.workspace_users.where(role: "owner").count
            if owners <= 1
              return render json: { error: "last_owner",
                                    message: "Cannot remove the only owner; transfer ownership first" },
                            status: :unprocessable_entity
            end
          end

          # Self-target guard: don't let the founder remove themselves from
          # a workspace they sit in. The whole point of super_admin is to
          # act FROM OUTSIDE the tenant; self-removal here means the
          # actor was a member and is now losing access, which they
          # almost certainly meant to do through the regular team flow.
          if @current_ba_user && @member.better_auth_user_id == @current_ba_user.id
            return render json: { error: "self_target",
                                  message: "Refusing to remove yourself via super_admin — use the team page" },
                          status: :unprocessable_entity
          end

          snapshot = { member_id: @member.id, email: @member.email, role: @member.role }
          @member.destroy!
          record_audit("super_admin.member.removed", metadata: snapshot)
          head :no_content
        end

        # POST /api/v1/super_admin/workspaces/:workspace_id/members/bulk_destroy
        # body: { member_ids: ['<uuid>', '<uuid>', ...] }
        #
        # Used by the founder's Members tab when offboarding multiple
        # seats at once (e.g., the customer's team shrank from 30 → 10).
        # Idempotent — IDs that don't exist or don't belong to this
        # workspace are silently skipped and reported in the response.
        def bulk_destroy
          ids = Array(params[:member_ids]).map(&:to_s).reject(&:empty?).uniq
          if ids.empty?
            return render json: { error: "bad_request", message: "member_ids required" },
                          status: :bad_request
          end

          scope    = @workspace.workspace_users.where(id: ids)
          self_ba  = @current_ba_user&.id
          self_row = self_ba ? scope.find_by(better_auth_user_id: self_ba) : nil

          # Self-target guard — same reasoning as #destroy. We refuse the
          # whole batch instead of silently skipping the actor so the
          # operator notices the mistake.
          if self_row
            return render json: { error: "self_target",
                                  message: "Batch includes yourself — remove your own id first" },
                          status: :unprocessable_entity
          end

          # Last-owner guard. Even removing a non-owner is fine, but if
          # the batch happens to include every owner row, we'd brick the
          # workspace. Compute remaining owners after the delete.
          remaining_owners = @workspace.workspace_users
                                       .where(role: "owner")
                                       .where.not(id: ids)
                                       .count
          if remaining_owners.zero? && @workspace.workspace_users.where(role: "owner").exists?
            return render json: { error: "last_owner",
                                  message: "Batch would leave the workspace without an owner — transfer first" },
                          status: :unprocessable_entity
          end

          targeted = scope.pluck(:id, :email, :role)
          scope.delete_all

          record_audit("super_admin.member.bulk_removed",
                       metadata: {
                         removed_count: targeted.length,
                         removed:       targeted.map { |(id, email, role)| { id: id, email: email, role: role } },
                       })

          render json: {
            data: {
              removed_count: targeted.length,
              removed_ids:   targeted.map(&:first),
              skipped_ids:   ids - targeted.map(&:first),
              remaining_users_count: @workspace.workspace_users.count,
            },
          }
        end

        private

        def set_workspace
          @workspace = Workspace.find(params[:workspace_id])
        rescue ActiveRecord::RecordNotFound
          head :not_found
        end

        def set_member
          @member = @workspace.workspace_users.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          head :not_found
        end

        def record_audit(action, metadata: {})
          AuditLog.record(
            workspace: @workspace,
            action:    action,
            entity:    @workspace,
            user_id:   nil,
            metadata:  metadata.merge(actor_email: actor_email),
            request:   request,
          )
        end

        def serialize_member(u)
          {
            id:                   u.id,
            email:                u.email,
            name:                 u.name,
            role:                 u.role,
            better_auth_user_id:  u.better_auth_user_id,
            last_login_at:        u.last_login_at&.iso8601,
            created_at:           u.created_at&.iso8601,
          }
        end
      end
    end
  end
end

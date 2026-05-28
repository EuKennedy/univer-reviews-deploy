module Api
  module V1
    module SuperAdmin
      # Cross-tenant search of Better Auth users (the identity table that
      # owns role='admin'|'user'). Lets the founder promote/demote operators
      # and see which workspaces a given email belongs to.
      class UsersController < ApplicationController
        ALLOWED_ROLES = %w[admin user].freeze

        # GET /api/v1/super_admin/users?q=foo
        def index
          q = params[:q].to_s.strip.downcase
          scope = BetterAuth::User.order(created_at: :desc)
          if q.present?
            term = "%#{q}%"
            scope = scope.where("LOWER(email) LIKE ? OR LOWER(name) LIKE ?", term, term)
          end

          pagy, users = paginate(scope)

          render json: {
            data: users.map { |u| serialize_user(u) },
            meta: pagination_meta(pagy),
          }
        end

        # POST /api/v1/super_admin/users/:id/set_role
        # body: { role: 'admin' | 'user' }
        def set_role
          target = BetterAuth::User.find_by(id: params[:id])
          return head :not_found unless target

          requested = params[:role].to_s.downcase
          unless ALLOWED_ROLES.include?(requested)
            return render json: { error: "bad_request", message: "Unknown role #{requested.inspect}" },
                          status: :bad_request
          end

          # Self-demotion guard. If the acting founder accidentally clicks
          # "set role: user" on themselves we'd lock the entire super
          # admin panel out. Refuse unless force=1 is passed.
          if target.id == @current_ba_user&.id && requested != "admin" && params[:force] != "1"
            return render json: {
              error:   "self_demote",
              message: "Refusing to demote yourself — pass force=1 to confirm",
            }, status: :unprocessable_entity
          end

          previous = target.role.to_s
          # BetterAuth::User mirrors the auth.user table read-only by
          # default but the model has no explicit `attr_readonly` — direct
          # update_columns works. Bypass validations because the table is
          # owned by Drizzle and Rails doesn't know its constraints.
          target.update_columns(role: requested, updated_at: Time.current)

          # No workspace context to attach the audit to. We record the row
          # under EVERY workspace the target is in, so it shows up in each
          # affected workspace's audit timeline. If the target is in zero
          # workspaces we still want a trace — log to Rails.
          memberships = WorkspaceUser.where(better_auth_user_id: target.id).includes(:workspace).to_a
          if memberships.any?
            memberships.each do |m|
              AuditLog.record(
                workspace: m.workspace,
                action:    "super_admin.user.role_changed",
                entity:    nil,
                user_id:   nil,
                metadata:  {
                  actor_email: actor_email,
                  target_user_id: target.id,
                  target_email: target.email,
                  previous_role: previous,
                  new_role: requested,
                },
                request:   request,
              )
            end
          else
            Rails.logger.info(
              "[super_admin] role change w/o workspace: #{target.email} #{previous} → #{requested} by #{actor_email}"
            )
          end

          render json: { data: serialize_user(target.reload) }
        end

        private

        def serialize_user(u)
          # Each user can be a member of many workspace_users rows; expose
          # them so the founder can see who they're administrating.
          memberships = WorkspaceUser.where(better_auth_user_id: u.id).includes(:workspace).map do |m|
            {
              workspace_id:   m.workspace_id,
              workspace_slug: m.workspace&.slug,
              workspace_name: m.workspace&.name,
              role:           m.role,
              created_at:     m.created_at&.iso8601,
            }
          end

          {
            id:           u.id,
            email:        u.email,
            name:         u.name,
            role:         u.respond_to?(:role) ? u.role : nil,
            banned:       u.respond_to?(:banned) ? u.banned : false,
            created_at:   u.created_at&.iso8601,
            memberships:  memberships,
          }
        end
      end
    end
  end
end

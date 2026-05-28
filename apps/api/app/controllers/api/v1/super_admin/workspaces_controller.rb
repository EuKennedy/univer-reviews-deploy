module Api
  module V1
    module SuperAdmin
      # Cross-tenant workspace management for the founder. Inherits the
      # super-admin auth + RLS-bypass from SuperAdmin::ApplicationController.
      class WorkspacesController < ApplicationController
        before_action :set_workspace, only: %i[show suspend unsuspend switch_plan soft_destroy impersonate]

        # Canonical plan slugs as stored in the DB and the new product-facing
        # names agent C is shipping in parallel. The frontend uses the new
        # names; we accept either at the API boundary and translate.
        PLAN_ALIASES = {
          "entry"      => "starter",
          "medium"     => "pro",
          "ultra"      => "enterprise",
          # Pass-throughs for the legacy slugs.
          "free"       => "free",
          "starter"    => "starter",
          "pro"        => "pro",
          "enterprise" => "enterprise",
        }.freeze

        # Approximate MRR per plan in USD. Real billing values live in the
        # `billing_plans` table — when populated we prefer those, fall back
        # to this table when a workspace has no subscription row yet.
        PLAN_MRR_FALLBACK = {
          "free"       => 0,
          "starter"    => 29,
          "pro"        => 99,
          "enterprise" => 299,
        }.freeze

        # GET /api/v1/super_admin/workspaces
        #
        # Filters: ?plan=entry|medium|ultra|free  ?status=active|trial|suspended
        # Sort:    ?sort=mrr_desc|last_active_desc|signup_desc (default signup_desc)
        def index
          scope = all_workspaces_scope

          if params[:plan].present?
            db_plan = PLAN_ALIASES[params[:plan].to_s.downcase]
            scope = scope.where(plan: db_plan) if db_plan
          end

          scope = scope.where(status: params[:status]) if params[:status].present?

          if params[:q].present?
            term = "%#{params[:q].to_s.downcase}%"
            scope = scope.where("LOWER(slug) LIKE ? OR LOWER(name) LIKE ?", term, term)
          end

          rows = serialize_collection(scope)

          rows = case params[:sort].to_s
                 when "mrr_desc"
                   rows.sort_by { |r| -r[:mrr] }
                 when "last_active_desc"
                   rows.sort_by { |r| -(r[:last_active_at] ? Time.parse(r[:last_active_at]).to_i : 0) }
                 else
                   rows.sort_by { |r| -(r[:created_at] ? Time.parse(r[:created_at]).to_i : 0) }
                 end

          render json: {
            data: rows,
            meta: aggregate_stats(rows),
          }
        end

        # GET /api/v1/super_admin/workspaces/:id
        def show
          render json: { data: serialize_one(@workspace) }
        end

        # POST /api/v1/super_admin/workspaces/:id/suspend
        def suspend
          previous = @workspace.status
          if previous == "suspended"
            return render json: { data: serialize_one(@workspace), message: "already_suspended" }
          end

          @workspace.update!(status: "suspended")
          record_audit("super_admin.workspace.suspended", metadata: { previous_status: previous })
          render json: { data: serialize_one(@workspace) }
        end

        # POST /api/v1/super_admin/workspaces/:id/unsuspend
        def unsuspend
          previous = @workspace.status
          return render json: { data: serialize_one(@workspace) } if previous == "active"

          @workspace.update!(status: "active")
          record_audit("super_admin.workspace.unsuspended", metadata: { previous_status: previous })
          render json: { data: serialize_one(@workspace) }
        end

        # POST /api/v1/super_admin/workspaces/:id/switch_plan
        # body: { plan: 'entry'|'medium'|'ultra' } (legacy names also accepted)
        def switch_plan
          requested = params[:plan].to_s.downcase
          db_plan = PLAN_ALIASES[requested]
          unless db_plan
            return render json: { error: "bad_request", message: "Unknown plan #{requested.inspect}" },
                          status: :bad_request
          end

          previous = @workspace.plan
          if previous == db_plan
            return render json: { data: serialize_one(@workspace), message: "no_change" }
          end

          @workspace.update!(plan: db_plan)
          record_audit("super_admin.workspace.plan_switched",
                       metadata: { previous_plan: previous, new_plan: db_plan, requested: requested })
          render json: { data: serialize_one(@workspace) }
        end

        # POST /api/v1/super_admin/workspaces/:id/impersonate
        #
        # Hand back the URL the dash should redirect the operator to so
        # they can act *as* the workspace owner. We don't reinvent session
        # creation here — Better Auth's admin plugin exposes a
        # /api/auth/admin/impersonate-user endpoint that does it cleanly.
        # The dash already has the operator's session cookie, so it just
        # needs to POST to that endpoint with the target userId. We
        # return the userId + the URL the dash should POST to.
        def impersonate
          target_user = @workspace.workspace_users.where(role: "owner").first ||
                        @workspace.workspace_users.where.not(better_auth_user_id: nil).first

          unless target_user&.better_auth_user_id
            return render json: { error: "no_target", message: "Workspace has no Better Auth user to impersonate" },
                          status: :unprocessable_entity
          end

          record_audit("super_admin.workspace.impersonate_initiated",
                       metadata: { target_user_id: target_user.better_auth_user_id, target_email: target_user.email })

          render json: {
            data: {
              user_id: target_user.better_auth_user_id,
              email:   target_user.email,
              # Dash will POST { userId } to this path; Better Auth handles
              # the session swap. After success the dash redirects to "/".
              endpoint: "/api/auth/admin/impersonate-user",
              redirect_to: "/",
            },
          }
        end

        # DELETE /api/v1/super_admin/workspaces/:id/soft_destroy
        #
        # Marks the workspace as suspended and stamps a status note rather
        # than physically deleting rows. We have no deleted_at column on
        # workspaces today; soft-delete is implemented as "suspended +
        # audit row carrying the deletion marker". Adding deleted_at is
        # tracked as an open question in the summary.
        def soft_destroy
          # Safety: refuse if the workspace has live products with > 0
          # reviews — operator should manually offboard the merchant first.
          if @workspace.reviews.exists?
            unless params[:force] == "1"
              return render json: {
                error:   "has_data",
                message: "Workspace has reviews — pass force=1 to confirm soft-delete anyway",
              }, status: :unprocessable_entity
            end
          end

          # Self-destruction guard: refuse to soft-delete a workspace the
          # acting admin is themselves a member of. Prevents the founder
          # from accidentally tombstoning their own dashboard.
          if @current_ba_user
            membership = WorkspaceUser.where(better_auth_user_id: @current_ba_user.id,
                                             workspace_id: @workspace.id).exists?
            if membership
              return render json: {
                error:   "self_target",
                message: "Refusing to soft-delete a workspace you are a member of",
              }, status: :unprocessable_entity
            end
          end

          @workspace.update!(status: "suspended")
          record_audit("super_admin.workspace.soft_deleted",
                       metadata: { slug: @workspace.slug, force: params[:force] == "1" })

          render json: { data: serialize_one(@workspace) }
        end

        private

        def set_workspace
          @workspace = Workspace.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          head :not_found
        end

        # Audit rows for super admin actions live under the affected
        # workspace, but the `user_id` FK is nil — the actor isn't a
        # workspace_user. The actor email is preserved in metadata.
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

        # Single workspace → API row. Computes MRR + last_active inline so
        # the index can sort without round-trips per row.
        def serialize_one(ws)
          mrr = mrr_for(ws)
          {
            id:               ws.id,
            slug:             ws.slug,
            name:             ws.name,
            plan:             ws.plan,
            # New product-facing plan name (the founder's UI uses this).
            plan_label:       plan_label_for(ws.plan),
            status:           ws.status,
            brand_color:      ws.brand_color,
            mrr:              mrr,
            created_at:       ws.created_at&.iso8601,
            last_active_at:   last_active_at_for(ws),
            owner_email:      owner_email_for(ws),
            reviews_count:    ws.reviews.count,
            products_count:   ws.products.count,
            users_count:      ws.workspace_users.count,
            ai_cost_month:    ai_cost_for(ws, since: Time.current.beginning_of_month),
            ai_cost_lifetime: ai_cost_for(ws),
            workspace_users:  ws.workspace_users.order(created_at: :asc).map { |u| serialize_member(u) },
          }
        end

        # Bulk-friendly: for the index we still call serialize_one but
        # skip the per-row workspace_users array (heavy on list views).
        def serialize_collection(scope)
          # Eager-load membership rows used to compute owner email + last
          # active so we don't trigger N+1 on big tenant lists.
          scope = scope.includes(:workspace_users)
          scope.map do |ws|
            mrr = mrr_for(ws)
            {
              id:             ws.id,
              slug:           ws.slug,
              name:           ws.name,
              plan:           ws.plan,
              plan_label:     plan_label_for(ws.plan),
              status:         ws.status,
              brand_color:    ws.brand_color,
              mrr:            mrr,
              created_at:     ws.created_at&.iso8601,
              last_active_at: ws.workspace_users.map(&:last_login_at).compact.max&.iso8601,
              owner_email:    ws.workspace_users.find { |u| u.role == "owner" }&.email ||
                              ws.workspace_users.first&.email,
              users_count:    ws.workspace_users.length,
            }
          end
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

        def aggregate_stats(rows)
          {
            total_workspaces:  rows.size,
            active_workspaces: rows.count { |r| r[:status] == "active" },
            trial_workspaces:  rows.count { |r| r[:status] == "trial" },
            suspended_workspaces: rows.count { |r| r[:status] == "suspended" },
            mrr_estimate_usd:  rows.sum { |r| r[:mrr] },
            ai_cost_month_usd: total_ai_cost_month,
          }
        end

        def total_ai_cost_month
          # RLS is OFF for this request, so the bare AiJob query reads
          # across every workspace.
          AiJob.where("created_at >= ?", Time.current.beginning_of_month)
               .sum(:cost_usd)
               .to_f
               .round(4)
        rescue ActiveRecord::StatementInvalid
          0.0
        end

        def mrr_for(ws)
          # Subscription is the source of truth when set, falls back to
          # the workspace's plan slug.
          sub = ws.subscription
          if sub&.plan&.price_monthly_cents
            (sub.plan.price_monthly_cents / 100.0).round(2)
          else
            PLAN_MRR_FALLBACK.fetch(ws.plan, 0)
          end
        end

        def plan_label_for(plan)
          # Reverse map: db slug → product-facing name.
          case plan
          when "free"       then "free"
          when "starter"    then "entry"
          when "pro"        then "medium"
          when "enterprise" then "ultra"
          else plan
          end
        end

        def last_active_at_for(ws)
          ws.workspace_users.maximum(:last_login_at)&.iso8601
        end

        def owner_email_for(ws)
          ws.workspace_users.where(role: "owner").order(:created_at).pick(:email) ||
            ws.workspace_users.order(:created_at).pick(:email)
        end

        def ai_cost_for(ws, since: nil)
          scope = AiJob.where(workspace_id: ws.id)
          scope = scope.where("created_at >= ?", since) if since
          scope.sum(:cost_usd).to_f.round(4)
        rescue ActiveRecord::StatementInvalid
          0.0
        end
      end
    end
  end
end

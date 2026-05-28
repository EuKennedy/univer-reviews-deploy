module Api
  module V1
    module SuperAdmin
      # Cross-tenant workspace management for the founder. Inherits the
      # super-admin auth + RLS-bypass from SuperAdmin::ApplicationController.
      class WorkspacesController < ApplicationController
        before_action :set_workspace,
                      only: %i[show suspend unsuspend switch_plan soft_destroy impersonate
                               seat_limit cancel_plan]

        # After T1.3 the DB only stores entry/medium/ultra (see migration
        # 20260528142804_rename_plans_to_entry_medium_ultra). We accept the
        # canonical slugs and nothing else — the legacy alias map that lived
        # here during the parallel rollout is dead code now.
        VALID_PLANS = %w[entry medium ultra].freeze

        # Approximate MRR per plan in BRL. Real billing values live in
        # `billing_plans`; we use these as fallback when the workspace has
        # no subscription row yet (free trial, manual ops, etc).
        PLAN_MRR_FALLBACK = {
          "entry"  => 79,
          "medium" => 199,
          "ultra"  => 499,
        }.freeze

        # GET /api/v1/super_admin/workspaces
        #
        # Filters: ?plan=entry|medium|ultra|free  ?status=active|trial|suspended
        # Sort:    ?sort=mrr_desc|last_active_desc|signup_desc (default signup_desc)
        def index
          scope = all_workspaces_scope

          if params[:plan].present?
            requested = params[:plan].to_s.downcase
            scope = scope.where(plan: requested) if VALID_PLANS.include?(requested)
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
        # body: { plan: 'entry'|'medium'|'ultra' }
        def switch_plan
          requested = params[:plan].to_s.downcase
          unless VALID_PLANS.include?(requested)
            return render json: { error: "bad_request", message: "Unknown plan #{requested.inspect}" },
                          status: :bad_request
          end

          previous = @workspace.plan
          if previous == requested
            return render json: { data: serialize_one(@workspace), message: "no_change" }
          end

          @workspace.update!(plan: requested)
          record_audit("super_admin.workspace.plan_switched",
                       metadata: { previous_plan: previous, new_plan: requested })
          render json: { data: serialize_one(@workspace) }
        end

        # PATCH /api/v1/super_admin/workspaces/:id/seat_limit
        # body: { seat_limit: <int> | null }
        #
        # NULL means "use plan default" — the workspace inherits
        # PlanFeatures::LIMITS[plan][:max_team_members]. Any positive
        # integer becomes an explicit per-workspace override (e.g., a
        # Medium customer negotiates 10 seats instead of the default 5).
        def seat_limit
          requested = params.key?(:seat_limit) ? params[:seat_limit] : params.dig(:workspace, :seat_limit)
          new_limit =
            if requested.nil? || requested == "" || requested == "null"
              nil
            else
              Integer(requested) rescue nil
            end

          # Distinguish "explicit null clears override" from "malformed
          # value" by checking the raw param. A nil result from a non-blank
          # input means "couldn't parse" → 400.
          if new_limit.nil? && requested.present? && requested != "null"
            return render json: { error: "bad_request", message: "seat_limit must be a positive integer or null" },
                          status: :bad_request
          end

          previous = @workspace.seat_limit
          @workspace.update!(seat_limit: new_limit)
          record_audit("super_admin.workspace.seat_limit_updated",
                       metadata: { previous_seat_limit: previous, new_seat_limit: new_limit })
          render json: { data: serialize_one(@workspace) }
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: "unprocessable_entity", message: e.message },
                 status: :unprocessable_entity
        end

        # POST /api/v1/super_admin/workspaces/:id/cancel_plan
        #
        # Voluntary churn. Distinct from `suspend` (which implies
        # founder-initiated moderation). The workspace stays readable for
        # the merchant but PlanFeatures.require! starts blocking every
        # gated action — see ApplicationController's `cancelled?` rescue
        # path for the user-facing 402.
        def cancel_plan
          previous_status = @workspace.status
          if previous_status == "cancelled"
            return render json: { data: serialize_one(@workspace), message: "already_cancelled" }
          end

          @workspace.update!(status: "cancelled")
          record_audit("super_admin.workspace.plan_cancelled",
                       metadata: { previous_status: previous_status, reason: params[:reason].to_s.presence })
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
            id:                    ws.id,
            slug:                  ws.slug,
            name:                  ws.name,
            plan:                  ws.plan,
            # New product-facing plan name (the founder's UI uses this).
            plan_label:            plan_label_for(ws.plan),
            status:                ws.status,
            brand_color:           ws.brand_color,
            mrr_brl:               mrr,
            currency:              "BRL",
            seat_limit:            ws.seat_limit,
            effective_seat_limit:  ws.effective_seat_limit,
            seat_limit_reached:    ws.seat_limit_reached?,
            created_at:            ws.created_at&.iso8601,
            last_active_at:        last_active_at_for(ws),
            owner_email:           owner_email_for(ws),
            reviews_count:         ws.reviews.count,
            products_count:        ws.products.count,
            users_count:           ws.workspace_users.count,
            # AI cost stays in USD because that's how Anthropic bills us;
            # the dashboard shows it converted at display time.
            ai_cost_month_usd:     ai_cost_for(ws, since: Time.current.beginning_of_month),
            ai_cost_lifetime_usd:  ai_cost_for(ws),
            workspace_users:       ws.workspace_users.order(created_at: :asc).map { |u| serialize_member(u) },
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
              id:                    ws.id,
              slug:                  ws.slug,
              name:                  ws.name,
              plan:                  ws.plan,
              plan_label:            plan_label_for(ws.plan),
              status:                ws.status,
              brand_color:           ws.brand_color,
              mrr_brl:               mrr,
              currency:              "BRL",
              seat_limit:            ws.seat_limit,
              effective_seat_limit:  ws.effective_seat_limit,
              created_at:            ws.created_at&.iso8601,
              last_active_at:        ws.workspace_users.map(&:last_login_at).compact.max&.iso8601,
              owner_email:           ws.workspace_users.find { |u| u.role == "owner" }&.email ||
                                     ws.workspace_users.first&.email,
              users_count:           ws.workspace_users.length,
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
            total_workspaces:     rows.size,
            active_workspaces:    rows.count { |r| r[:status] == "active" },
            trial_workspaces:     rows.count { |r| r[:status] == "trial" },
            suspended_workspaces: rows.count { |r| r[:status] == "suspended" },
            cancelled_workspaces: rows.count { |r| r[:status] == "cancelled" },
            mrr_estimate_brl:     rows.sum { |r| r[:mrr_brl] || 0 },
            ai_cost_month_usd:    total_ai_cost_month,
            currency:             "BRL",
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
          # DB now stores the canonical product-facing slug after T1.3 — no
          # translation needed. Method kept so the serializer call site
          # doesn't have to change.
          plan
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

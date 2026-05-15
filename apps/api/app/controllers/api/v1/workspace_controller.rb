module Api
  module V1
    class WorkspaceController < ApplicationController
      # GET /api/v1/workspace
      def show
        ws = current_workspace

        render json: {
          data: {
            id:               ws.id,
            slug:             ws.slug,
            name:             ws.name,
            brand_logo:       ws.brand_logo,
            brand_color:      ws.brand_color,
            rating_icon_preset: ws.rating_icon_preset,
            rating_icon_filled: ws.rating_icon_filled,
            rating_icon_empty:  ws.rating_icon_empty,
            brand_voice_md:   ws.brand_voice_md,
            default_locale:   ws.default_locale,
            default_currency: ws.default_currency,
            plan:             ws.plan,
            status:           ws.status,
            created_at:       ws.created_at&.iso8601,
            domains: ws.workspace_domains.map { |d|
              { id: d.id, domain: d.domain, platform: d.platform, verified: d.verified? }
            },
            subscription: ws.subscription ? {
              status:              ws.subscription.status,
              plan_slug:           ws.subscription.plan&.slug,
              plan_name:           ws.subscription.plan&.name,
              current_period_end:  ws.subscription.current_period_end&.iso8601,
              trial_ends_at:       ws.subscription.trial_ends_at&.iso8601
            } : nil
          }
        }
      end

      # PATCH /api/v1/workspace
      def update
        require_write!

        if current_workspace.update(workspace_params)
          AuditLog.record(
            workspace: current_workspace,
            action: "workspace.updated",
            metadata: workspace_params.to_h,
            request: request
          )
          render json: { data: { id: current_workspace.id, updated: true } }
        else
          render json: {
            error: "unprocessable_entity",
            issues: current_workspace.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/workspace/stats
      def stats
        ws = current_workspace
        now = Time.current

        total_reviews = ws.reviews.count
        approved      = ws.reviews.where(status: "approved")
        avg_rating    = approved.average(:rating)&.round(2) || 0.0

        pending_count     = ws.reviews.where(status: "pending").count
        this_month        = ws.reviews.where("created_at >= ?", now.beginning_of_month).count
        last_month        = ws.reviews.where(created_at: (now - 1.month).beginning_of_month..(now - 1.month).end_of_month).count
        approval_rate     = total_reviews.positive? ? (approved.count.to_f / total_reviews * 100).round(2) : 0.0

        rating_dist = ws.reviews.where(status: "approved")
                        .group(:rating)
                        .order(:rating)
                        .count

        ai_cost_month = ws.ai_jobs
                          .where("created_at >= ?", now.beginning_of_month)
                          .sum(:cost_usd)
                          .to_f
                          .round(4)

        render json: {
          data: {
            total_reviews:     total_reviews,
            approved_reviews:  approved.count,
            pending_reviews:   pending_count,
            avg_rating:        avg_rating,
            approval_rate:     approval_rate,
            reviews_this_month: this_month,
            reviews_last_month: last_month,
            rating_distribution: (1..5).map { |r| { rating: r, count: rating_dist[r] || 0 } },
            total_products:    ws.products.count,
            total_campaigns:   ws.campaigns.count,
            ai_cost_month_usd: ai_cost_month
          }
        }
      end

      private

      def workspace_params
        params.require(:workspace).permit(
          :name, :brand_logo, :brand_color,
          :rating_icon_preset, :rating_icon_filled, :rating_icon_empty,
          :brand_voice_md, :default_locale, :default_currency
        )
      end
    end
  end
end

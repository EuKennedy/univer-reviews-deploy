module Api
  module V1
    class RewardRulesController < ApplicationController
      before_action :set_rule, only: %i[show update destroy]

      def index
        rules = current_workspace.reward_rules.order(created_at: :desc)
        render json: { data: rules.map { |r| r.as_json } }
      end

      def show
        render json: { data: @rule.as_json }
      end

      def create
        require_write!

        rule = current_workspace.reward_rules.new(rule_params)

        if rule.save
          render json: { data: rule.as_json }, status: :created
        else
          render json: { error: "unprocessable_entity", issues: rule.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      def update
        require_write!

        if @rule.update(rule_params)
          render json: { data: @rule.as_json }
        else
          render json: { error: "unprocessable_entity", issues: @rule.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      def destroy
        require_write!
        @rule.update!(active: false)
        head :no_content
      end

      private

      def set_rule
        @rule = current_workspace.reward_rules.find(params[:id])
      end

      def rule_params
        params.require(:reward_rule).permit(
          :name, :active, :trigger_event, :min_body_length,
          :require_purchase, :reward_type, :reward_amount,
          :reward_currency, :coupon_template,
          :bonus_with_photo_pct, :bonus_with_video_pct, :bonus_long_review_pct,
          :max_per_customer_per_product, :max_per_customer_per_month,
          :max_total_grants, :starts_at, :ends_at
        )
      end
    end
  end
end

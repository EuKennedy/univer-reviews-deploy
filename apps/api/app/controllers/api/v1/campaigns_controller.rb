module Api
  module V1
    class CampaignsController < ApplicationController
      before_action :set_campaign, only: %i[show update destroy send_now pause resume]

      # GET /api/v1/campaigns
      def index
        scope = current_workspace.campaigns

        scope = scope.where(status: params[:status]) if params[:status].present?
        scope = scope.where(type: params[:type])     if params[:type].present?
        scope = scope.order(created_at: :desc)

        pagy, campaigns = paginate(scope)

        render json: {
          data: campaigns.map { |c| serialize_campaign(c) },
          meta: pagination_meta(pagy)
        }
      end

      # GET /api/v1/campaigns/:id
      def show
        render json: { data: serialize_campaign(@campaign, full: true) }
      end

      # POST /api/v1/campaigns
      def create
        require_write!

        campaign = current_workspace.campaigns.new(campaign_params)

        if campaign.save
          AuditLog.record(workspace: current_workspace, action: "campaign.created", entity: campaign, request: request)
          render json: { data: serialize_campaign(campaign) }, status: :created
        else
          render json: { error: "unprocessable_entity", issues: campaign.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/campaigns/:id
      def update
        require_write!

        if @campaign.update(campaign_params)
          render json: { data: serialize_campaign(@campaign) }
        else
          render json: { error: "unprocessable_entity", issues: @campaign.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/campaigns/:id
      def destroy
        require_write!
        @campaign.archive!
        head :no_content
      end

      # POST /api/v1/campaigns/:id/send_now
      def send_now
        require_write!

        unless @campaign.active? || @campaign.draft?
          render json: { error: "invalid_state", message: "Campaign must be active or draft to send" }, status: :bad_request
          return
        end

        @campaign.activate! if @campaign.draft?
        CampaignSendJob.perform_later(@campaign.id, mode: "manual")

        AuditLog.record(workspace: current_workspace, action: "campaign.sent_now", entity: @campaign, request: request)
        render json: { message: "Campaign send queued", campaign_id: @campaign.id }
      end

      # POST /api/v1/campaigns/:id/pause
      def pause
        require_write!

        if @campaign.active?
          @campaign.pause!
          render json: { data: { id: @campaign.id, status: @campaign.status } }
        else
          render json: { error: "invalid_state", message: "Campaign is not active" }, status: :bad_request
        end
      end

      # POST /api/v1/campaigns/:id/resume
      def resume
        require_write!

        if @campaign.paused?
          @campaign.resume!
          render json: { data: { id: @campaign.id, status: @campaign.status } }
        else
          render json: { error: "invalid_state", message: "Campaign is not paused" }, status: :bad_request
        end
      end

      private

      def set_campaign
        @campaign = current_workspace.campaigns.find(params[:id])
      end

      def campaign_params
        params.require(:campaign).permit(
          :name, :type, :status, :trigger_type, :trigger_delay_hours,
          :template_subject, :template_body, :reward_rule_id
        )
      end

      def serialize_campaign(c, full: false)
        data = {
          id: c.id, name: c.name, type: c.type, status: c.status,
          trigger_type: c.trigger_type, trigger_delay_hours: c.trigger_delay_hours,
          sent_count: c.sent_count, open_count: c.open_count,
          click_count: c.click_count, review_count: c.review_count,
          conversion_rate: c.conversion_rate, open_rate: c.open_rate,
          created_at: c.created_at&.iso8601, updated_at: c.updated_at&.iso8601
        }

        if full
          data[:template_subject] = c.template_subject
          data[:template_body]    = c.template_body
          data[:reward_rule_id]   = c.reward_rule_id
        end

        data
      end
    end
  end
end

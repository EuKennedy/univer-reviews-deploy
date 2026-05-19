module Api
  module V1
    class CampaignsController < ApplicationController
      before_action :set_campaign, only: %i[show update destroy send_now pause resume test_send]

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
        render json: { data: serialize_campaign(@campaign, full: true, stats: true) }
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

      # POST /api/v1/campaigns/:id/test_send
      # body: { recipient_email: "me@example.com" }
      def test_send
        require_write!

        recipient = params[:recipient_email].to_s.strip
        if recipient.blank? || recipient !~ URI::MailTo::EMAIL_REGEXP
          render json: { error: "invalid_recipient", message: "recipient_email is required and must be valid" },
                 status: :bad_request
          return
        end

        sample = build_test_send(recipient)

        if sample.persisted?
          CampaignSendJob.perform_later(sample.id)
          render json: { data: { send_id: sample.id, recipient: recipient } }, status: :accepted
        else
          render json: { error: "unprocessable_entity", issues: sample.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      private

      def set_campaign
        @campaign = current_workspace.campaigns.find(params[:id])
      end

      def campaign_params
        permitted = params.require(:campaign).permit(
          :name, :type, :status, :trigger_type, :trigger_delay_hours,
          :trigger_after_minutes,
          :template_subject, :template_body, :reward_rule_id,
          :from_name, :from_email, :reply_to,
          :subject_template, :html_template,
          trigger_events: []
        )
        # Normalize trigger_events when passed as a comma-separated string.
        if permitted[:trigger_events].is_a?(String)
          permitted[:trigger_events] = permitted[:trigger_events].split(",").map(&:strip).reject(&:blank?)
        end
        permitted
      end

      def build_test_send(recipient_email)
        send = nil
        ActiveRecord::Base.transaction do
          ActiveRecord::Base.connection.execute(
            ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", current_workspace.id.to_s])
          )
          send = CampaignSend.create!(
            workspace_id:    current_workspace.id,
            campaign_id:     @campaign.id,
            recipient_email: recipient_email,
            recipient_name:  "Test",
            customer_email:  recipient_email,
            external_order_id: "TEST-#{SecureRandom.hex(4)}",
            status:          "queued",
            scheduled_at:    Time.current,
            product_ids:     []
          )
        end
        send
      end

      def serialize_campaign(c, full: false, stats: false)
        data = {
          id: c.id, name: c.name, type: c.type, status: c.status,
          trigger_type: c.trigger_type, trigger_delay_hours: c.trigger_delay_hours,
          trigger_after_minutes: c.trigger_after_minutes,
          trigger_events: c.trigger_events,
          from_name: c.from_name, from_email: c.from_email, reply_to: c.reply_to,
          sent_count: c.sent_count, open_count: c.open_count,
          click_count: c.click_count, review_count: c.review_count,
          conversion_rate: c.conversion_rate, open_rate: c.open_rate, click_rate: c.click_rate,
          created_at: c.created_at&.iso8601, updated_at: c.updated_at&.iso8601
        }

        if full
          data[:template_subject] = c.template_subject
          data[:template_body]    = c.template_body
          data[:subject_template] = c.subject_template
          data[:html_template]    = c.html_template
          data[:reward_rule_id]   = c.reward_rule_id
        end

        data[:stats] = campaign_stats(c) if stats
        data
      end

      def campaign_stats(c)
        scope = c.campaign_sends
        sent_count      = scope.where.not(sent_at: nil).count
        delivered_count = scope.delivered.count + scope.opened.count + scope.clicked.count + scope.converted.count
        opened_count    = scope.where("opened_count > 0").count
        clicked_count   = scope.where("clicked_count > 0").count
        converted_count = scope.converted.count
        bounced_count   = scope.bounced.count

        {
          sent:       sent_count,
          delivered:  delivered_count,
          opened:     opened_count,
          clicked:    clicked_count,
          converted:  converted_count,
          bounced:    bounced_count,
          open_rate:       rate(opened_count,    sent_count),
          click_rate:      rate(clicked_count,   sent_count),
          conversion_rate: rate(converted_count, sent_count)
        }
      end

      def rate(num, den)
        return 0.0 if den.to_i.zero?
        (num.to_f / den * 100).round(2)
      end
    end
  end
end

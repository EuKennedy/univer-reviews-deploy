module PlatformEvents
  # Given a persisted PlatformEvent, finds every active Campaign listening for
  # the event_type and creates (or finds) a CampaignSend per campaign. Idempotent:
  # re-running on the same event creates no extra sends — the unique partial
  # index on campaign_sends guarantees one send per
  # (workspace, campaign, external_order_id, recipient_email).
  class Processor
    def self.process(platform_event)
      new(platform_event).process
    end

    def initialize(platform_event)
      @event = platform_event
    end

    def process
      return [] unless @event.customer_email.present?

      campaigns = @event.workspace
                        .campaigns
                        .active
                        .email
                        .listening_for(@event.event_type)

      campaigns.map { |c| find_or_create_send!(c) }.compact
    end

    private

    def find_or_create_send!(campaign)
      send = CampaignSend.where(
        workspace_id:      @event.workspace_id,
        campaign_id:       campaign.id,
        external_order_id: @event.external_order_id,
        recipient_email:   @event.customer_email
      ).first

      if send
        # Already scheduled — link platform_event for traceability if missing.
        send.update!(platform_event_id: @event.id) if send.platform_event_id.blank?
        return send
      end

      scheduled_at = (@event.received_at || Time.current) + campaign.delay_seconds.seconds

      CampaignSend.create!(
        workspace_id:      @event.workspace_id,
        campaign_id:       campaign.id,
        platform_event_id: @event.id,
        external_order_id: @event.external_order_id,
        recipient_email:   @event.customer_email,
        recipient_name:    @event.customer_name,
        customer_email:    @event.customer_email,
        order_id:          @event.external_order_id,
        product_ids:       @event.product_handles,
        status:            "queued",
        scheduled_at:      scheduled_at
      )
    rescue ActiveRecord::RecordNotUnique
      # Two concurrent workers raced on the same (workspace, campaign, order, email).
      # The unique partial index won — fetch the winner and return it.
      CampaignSend.find_by(
        workspace_id:      @event.workspace_id,
        campaign_id:       campaign.id,
        external_order_id: @event.external_order_id,
        recipient_email:   @event.customer_email
      )
    end
  end
end

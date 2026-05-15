class CampaignTriggerJob < ApplicationJob
  queue_as :default

  def perform(workspace_id:, order_id:, customer_email:, order_status:, line_items: [])
    workspace = Workspace.find_by(id: workspace_id)
    return unless workspace

    set_workspace_rls(workspace_id)

    # Find active email campaigns triggered by order completion
    trigger = order_status.in?(%w[completed processing fulfilled]) ? "order_completed" : "order_delivered"

    active_campaigns = workspace.campaigns
                                .where(status: "active", type: "email", trigger_type: trigger)

    product_ids = extract_product_ids(workspace, line_items)

    active_campaigns.each do |campaign|
      next if already_sent?(campaign, order_id)

      send = campaign.campaign_sends.create!(
        workspace: workspace,
        customer_email: customer_email,
        order_id: order_id,
        product_ids: product_ids,
        status: "queued"
      )

      # Schedule send with the configured delay
      delay = campaign.trigger_delay_hours.to_i.hours
      CampaignSendJob.set(wait: delay).perform_later(send.id)
    end
  rescue => e
    Rails.logger.error("CampaignTriggerJob error: #{e.message}")
    raise
  end

  private

  def already_sent?(campaign, order_id)
    campaign.campaign_sends.where(order_id: order_id.to_s).exists?
  end

  def extract_product_ids(workspace, line_items)
    return [] unless line_items.is_a?(Array)

    platform_ids = line_items.map { |li| li["product_id"].to_s }
    workspace.products.where(platform_product_id: platform_ids).pluck(:id)
  end
end

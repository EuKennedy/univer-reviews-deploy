class CampaignSendJob < ApplicationJob
  queue_as :mailers

  FROM_EMAIL = ENV.fetch("FROM_EMAIL", "reviews@univerreviews.com")

  def perform(send_id, mode: "scheduled")
    campaign_send = CampaignSend.find_by(id: send_id)
    return unless campaign_send&.queued?

    campaign  = campaign_send.campaign
    workspace = campaign.workspace

    set_workspace_rls(workspace.id)

    body     = render_template(campaign, campaign_send, workspace)
    subject  = campaign.template_subject.presence || "Avalie sua compra"

    result = Resend::Emails.send({
      from: "#{workspace.name} <#{FROM_EMAIL}>",
      to:   campaign_send.customer_email,
      subject: subject,
      html: body
    })

    if result[:id].present?
      campaign_send.mark_sent!
      Rails.logger.info("CampaignSendJob: sent #{send_id} to #{campaign_send.customer_email}")
    else
      Rails.logger.error("CampaignSendJob: Resend returned no ID for #{send_id}")
      raise "Resend send failed"
    end
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("CampaignSendJob: send #{send_id} not found")
  rescue => e
    Rails.logger.error("CampaignSendJob failed for #{send_id}: #{e.message}")
    campaign_send&.update_columns(status: "bounced")
    raise
  end

  private

  def render_template(campaign, campaign_send, workspace)
    template = campaign.template_body.presence || default_template

    # Simple token replacement
    template
      .gsub("{{customer_name}}", campaign_send.customer_email.split("@").first.capitalize)
      .gsub("{{workspace_name}}", workspace.name)
      .gsub("{{order_id}}", campaign_send.order_id.to_s)
      .gsub("{{review_link}}", generate_review_link(campaign_send, workspace))
  end

  def generate_review_link(campaign_send, workspace)
    domain = workspace.workspace_domains.first&.domain || "#{workspace.slug}.univerreviews.com"
    "https://#{domain}/review?order=#{campaign_send.order_id}&email=#{CGI.escape(campaign_send.customer_email.to_s)}"
  end

  def default_template
    <<~HTML
      <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Olá, {{customer_name}}!</h2>
          <p>Esperamos que você esteja aproveitando sua compra do pedido #{{order_id}}.</p>
          <p>Sua opinião é muito importante para nós. Que tal deixar um review?</p>
          <a href="{{review_link}}" style="background:#d4a850;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
            Avaliar minha compra
          </a>
          <p style="color:#999;font-size:12px;">{{workspace_name}}</p>
        </body>
      </html>
    HTML
  end
end

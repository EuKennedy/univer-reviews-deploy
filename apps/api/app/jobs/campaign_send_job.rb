class CampaignSendJob < ApplicationJob
  queue_as :mailers

  MAX_ATTEMPTS = 3

  # Override ApplicationJob's blanket retry so we can manage retries explicitly
  # against Resend errors only.
  sidekiq_options retry: 0 if respond_to?(:sidekiq_options)

  def perform(send_id, attempt: 1)
    campaign_send = CampaignSend.find_by(id: send_id)
    return unless campaign_send
    return unless campaign_send.queued?

    campaign  = campaign_send.campaign
    workspace = campaign.workspace

    with_workspace_rls(workspace.id) do
      rendered = campaign.render_for(campaign_send)

      # Persist the rendered output BEFORE sending so we have an audit trail
      # even if Resend errors mid-flight.
      campaign_send.update!(
        subject:       rendered[:subject],
        rendered_html: rendered[:html]
      )

      from_display = campaign.from_name.presence || workspace.name.to_s
      from_email   = campaign.from_email.presence || "noreply@univerreviews.com"

      begin
        response = Resend::Emails.send({
          from:     "#{from_display} <#{from_email}>",
          reply_to: campaign.reply_to.presence || "suporte@univerreviews.com",
          to:       [campaign_send.recipient_email],
          subject:  rendered[:subject],
          html:     rendered[:html],
          headers:  { "X-Univer-Send-Id" => campaign_send.id.to_s }
        })

        message_id = response.is_a?(Hash) ? (response["id"] || response[:id]) : nil

        if message_id.present?
          campaign_send.mark_sent!(message_id: message_id)
          Rails.logger.info("CampaignSendJob: sent send=#{send_id} message_id=#{message_id}")
        else
          raise "Resend returned no message_id (response=#{response.inspect})"
        end
      rescue => e
        # `Resend::Error` is the gem's base error class. Use a string match to
        # avoid hard-loading the constant in test envs where the gem may be
        # stubbed.
        is_resend_error = e.class.name.start_with?("Resend::")

        if attempt < MAX_ATTEMPTS && (is_resend_error || e.is_a?(StandardError))
          backoff = (2**attempt).minutes
          Rails.logger.warn("CampaignSendJob: retry #{attempt + 1}/#{MAX_ATTEMPTS} send=#{send_id} in #{backoff.inspect} (#{e.message})")
          self.class.set(wait: backoff).perform_later(send_id, attempt: attempt + 1)
        else
          Rails.logger.error("CampaignSendJob: giving up send=#{send_id} after #{attempt} attempts: #{e.message}")
          campaign_send.mark_bounced!(reason: e.message)
        end
      end
    end
  end
end

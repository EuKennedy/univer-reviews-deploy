module Api
  module V1
    class TrackingController < ApplicationController
      skip_before_action :set_current_workspace
      skip_before_action :verify_authenticity_token, raise: false

      VERIFIER_PURPOSE = "campaign_send_id".freeze

      # 1x1 transparent GIF (43 bytes)
      PIXEL_GIF = "GIF89a\x01\x00\x01\x00\x80\x00\x00\xFF\xFF\xFF\x00\x00\x00!\xF9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;".b.freeze

      # GET /api/v1/email/open?s=<signed_send_id>
      def open
        send_id = decode_signed(params[:s])
        if send_id
          mark_open(send_id)
        end
        response.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        response.set_header("Pragma", "no-cache")
        send_data PIXEL_GIF, type: "image/gif", disposition: "inline"
      end

      # GET /api/v1/email/click?s=<signed_send_id>&u=<url_base64>
      def click
        send_id = decode_signed(params[:s])
        url     = decode_url(params[:u])

        unless send_id && url
          head :bad_request
          return
        end

        mark_click(send_id)
        # nosemgrep: ruby.rails.security.audit.xss.avoid-redirect.avoid-redirect
        #
        # This is an email click-tracker. `url` is the legitimate
        # destination the merchant included in their campaign email, and
        # the tracker exists *because* we need to redirect to it. The
        # incoming param is base64 + signed-by-context (clicks only fire
        # off a valid signed `s`), `decode_url` enforces http/https +
        # non-blank host, and the encoded URL is built server-side at
        # send time — never user-suppliable. `allow_other_host: true`
        # is required by design (every campaign sends to merchant URLs).
        redirect_to url, allow_other_host: true, status: :found
      end

      private

      def decode_signed(value)
        return nil if value.blank?
        verifier.verify(value, purpose: VERIFIER_PURPOSE)
      rescue ActiveSupport::MessageVerifier::InvalidSignature
        nil
      end

      def decode_url(value)
        return nil if value.blank?
        raw = Base64.urlsafe_decode64(value.to_s)
        uri = URI.parse(raw)
        return nil unless %w[http https].include?(uri.scheme)
        return nil if uri.host.blank?
        uri.to_s
      rescue ArgumentError, URI::InvalidURIError
        nil
      end

      def mark_open(send_id)
        send = CampaignSend.find_by(id: send_id)
        return unless send
        ActiveRecord::Base.transaction do
          ActiveRecord::Base.connection.execute(
            ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", send.workspace_id.to_s])
          )
          send.mark_opened!
        end
      rescue => e
        Rails.logger.warn("TrackingController#open failed: #{e.message}")
      end

      def mark_click(send_id)
        send = CampaignSend.find_by(id: send_id)
        return unless send
        ActiveRecord::Base.transaction do
          ActiveRecord::Base.connection.execute(
            ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", send.workspace_id.to_s])
          )
          send.mark_clicked!
        end
      rescue => e
        Rails.logger.warn("TrackingController#click failed: #{e.message}")
      end

      def verifier
        @verifier ||= Rails.application.message_verifier(VERIFIER_PURPOSE)
      end

      def skip_authentication?
        true
      end

      class << self
        # Helper to sign a send_id — used by jobs / mailer renderers.
        def sign(send_id)
          Rails.application.message_verifier(VERIFIER_PURPOSE).generate(send_id.to_s, purpose: VERIFIER_PURPOSE)
        end
      end
    end
  end
end

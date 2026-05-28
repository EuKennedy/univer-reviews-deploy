module Api
  module V1
    # Workspace webhook secret rotation.
    #
    # Each `workspace_domain` row stores a per-tenant HMAC secret in
    # `platform_meta.webhook_secret` (for WooCommerce + Shopify). This
    # controller exposes a rotate endpoint so the admin can:
    #   • Compromised? Rotate immediately — old signature stops working,
    #     attacker loses ability to deliver fake events.
    #   • Compliance? Rotate periodically.
    #
    # Security posture:
    #   • require_write! — workspace key must have write scope.
    #   • Audit log every rotate (old + new SHA fingerprints).
    #   • Never return the old secret in the response (rotate = burn it).
    #   • New secret is returned ONCE so the admin can paste into Woo
    #     "Secret" field. Subsequent GETs only reveal that a secret
    #     exists (boolean).
    class WorkspaceWebhooksController < ApplicationController
      # GET /workspace/webhooks
      # Returns a sanitised view of every workspace_domain's webhook
      # configuration. Never reveals the secret value.
      def index
        rows = current_workspace.workspace_domains.order(:domain).map do |d|
          meta = d.platform_meta.is_a?(Hash) ? d.platform_meta : {}
          secret = meta["webhook_secret"].to_s
          {
            id:        d.id,
            domain:    d.domain,
            platform:  d.platform,
            verified:  d.verified?,
            webhook_configured: secret.present?,
            webhook_fingerprint: secret.present? ? sha256_prefix(secret) : nil,
            webhooks_registered_at: meta["webhooks_registered_at"],
          }
        end
        render json: { data: rows }
      end

      # POST /workspace/webhooks/:domain_id/rotate
      def rotate
        require_write!
        domain = current_workspace.workspace_domains.find(params[:domain_id])

        old_secret = (domain.platform_meta || {})["webhook_secret"].to_s
        new_secret = SecureRandom.hex(32) # 256 bits

        meta = (domain.platform_meta || {}).merge(
          "webhook_secret" => new_secret,
          "webhook_secret_rotated_at" => Time.current.iso8601,
        )
        domain.update!(platform_meta: meta)

        AuditLog.record(
          workspace: current_workspace,
          action: "webhook.rotated",
          entity: domain,
          metadata: {
            domain: domain.domain,
            platform: domain.platform,
            old_fingerprint: old_secret.present? ? sha256_prefix(old_secret) : nil,
            new_fingerprint: sha256_prefix(new_secret),
          },
          request: request,
        )

        render json: {
          ok: true,
          domain_id: domain.id,
          domain:    domain.domain,
          new_secret: new_secret,
          message:   "Cole o novo secret no painel da plataforma (WooCommerce/Shopify) imediatamente. O secret antigo deixou de funcionar.",
        }
      end

      private

      # SHA-256 first-12-hex fingerprint — enough to confirm a secret
      # was rotated without revealing the secret itself. Used in audit
      # logs + GET listing.
      def sha256_prefix(secret)
        Digest::SHA256.hexdigest(secret)[0, 12]
      end
    end
  end
end

class WooCommerceSyncJob < ApplicationJob
  queue_as :imports

  def perform(workspace_id)
    workspace = Workspace.find_by(id: workspace_id)
    return unless workspace

    domain = workspace.woocommerce_domain
    unless domain&.woo_store_url.present?
      Rails.logger.warn("WooCommerceSyncJob: no WooCommerce config for workspace #{workspace_id}")
      return
    end

    # The service owns the RLS contract — each batch upsert runs inside a
    # transaction with SET LOCAL app.workspace_id. This is the same code
    # path the admin "Sincronizar agora" button hits inline, so the two
    # can never disagree on what "active" means or how price is parsed.
    result = ::Integrations::WooCommerceProductSyncer.run(
      workspace: workspace,
      domain:    domain
    )

    Rails.logger.info("[WC-SYNC] job-result workspace=#{workspace_id} #{result.except(:errors).inspect}")
  end
end

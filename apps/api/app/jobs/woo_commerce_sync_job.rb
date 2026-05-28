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

    # Pass an RLS-bound block so each batch upsert runs inside a transaction
    # with SET LOCAL app.workspace_id. The service is identical to the inline
    # path used by the admin "Sincronizar agora" button — keeps both paths
    # in lockstep.
    with_rls = ->(&block) { with_workspace_rls(workspace_id) { block.call } }

    result = ::Integrations::WooCommerceProductSyncer.run(
      workspace: workspace,
      domain:    domain,
      with_rls:  with_rls
    )

    Rails.logger.info("[WC-SYNC] job-result workspace=#{workspace_id} #{result.except(:errors).inspect}")
  end
end

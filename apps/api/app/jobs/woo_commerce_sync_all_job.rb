class WooCommerceSyncAllJob < ApplicationJob
  queue_as :imports

  # Daily scheduled job to sync all WooCommerce workspaces
  def perform
    WorkspaceDomain.where(platform: "woocommerce")
                   .joins(:workspace)
                   .where(workspaces: { status: "active" })
                   .each do |domain|
      WooCommerceSyncJob.perform_later(domain.workspace_id)
    end
  end
end

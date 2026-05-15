class WooCommerceSyncJob < ApplicationJob
  queue_as :imports

  def perform(workspace_id)
    workspace = Workspace.find_by(id: workspace_id)
    return unless workspace

    set_workspace_rls(workspace_id)

    domain = workspace.woocommerce_domain
    unless domain&.woo_store_url.present?
      Rails.logger.warn("WooCommerceSyncJob: no WooCommerce config for workspace #{workspace_id}")
      return
    end

    adapter = Integrations::WooCommerceAdapter.new(
      store_url:       domain.woo_store_url,
      consumer_key:    domain.woo_consumer_key,
      consumer_secret: domain.woo_consumer_secret
    )

    synced = 0
    adapter.all_products do |batch|
      batch.each do |woo_product|
        upsert_product(workspace, woo_product, domain.platform)
        synced += 1
      end
    end

    Rails.logger.info("WooCommerceSyncJob: synced #{synced} products for workspace #{workspace_id}")
  rescue Integrations::WooCommerceAdapter::AuthenticationError => e
    Rails.logger.error("WooCommerceSyncJob auth failed for #{workspace_id}: #{e.message}")
  end

  private

  def upsert_product(workspace, woo_product, platform)
    product = workspace.products.find_or_initialize_by(
      platform: platform,
      platform_product_id: woo_product["id"].to_s
    )

    product.assign_attributes(
      title:          woo_product["name"],
      handle:         woo_product["slug"],
      image_url:      woo_product.dig("images", 0, "src"),
      price:          woo_product["price"].to_f,
      currency:       "BRL",
      active:         woo_product["status"] == "publish",
      last_synced_at: Time.current
    )

    product.save!
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn("WooCommerceSyncJob product upsert failed: #{e.message}")
  end
end

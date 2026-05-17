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

    adapter = Integrations::WooCommerceAdapter.new(
      store_url:       domain.woo_store_url,
      consumer_key:    domain.woo_consumer_key,
      consumer_secret: domain.woo_consumer_secret
    )

    synced = 0
    failed = 0
    total  = 0

    # One transaction per batch keeps RLS active for every upsert in the batch
    # without holding a single huge transaction open while we wait on HTTP I/O.
    adapter.all_products do |batch|
      total += batch.length
      with_workspace_rls(workspace_id) do
        batch.each do |woo_product|
          begin
            upsert_product(workspace, woo_product, domain.platform)
            synced += 1
          rescue ActiveRecord::RecordInvalid => e
            failed += 1
            Rails.logger.warn("WooCommerceSyncJob upsert failed for product #{woo_product["id"]}: #{e.message}")
          end
        end
      end
    end

    Rails.logger.info("WooCommerceSyncJob done — workspace=#{workspace_id} synced=#{synced} failed=#{failed} total=#{total}")
  rescue Integrations::WooCommerceAdapter::AuthenticationError => e
    Rails.logger.error("WooCommerceSyncJob auth failed for workspace #{workspace_id}: #{e.message}")
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
      currency:       woo_product["currency"].presence || "BRL",
      active:         woo_product["status"] == "publish",
      last_synced_at: Time.current
    )

    product.save!
  end
end

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
    pages  = 0

    Rails.logger.info("[WC-SYNC] START workspace=#{workspace_id} store=#{domain.woo_store_url}")

    adapter.all_products do |batch|
      pages += 1
      total += batch.length
      Rails.logger.info("[WC-SYNC] page=#{pages} batch_size=#{batch.length} first_id=#{batch.first&.dig("id")} last_id=#{batch.last&.dig("id")}")

      with_workspace_rls(workspace_id) do
        batch.each do |woo_product|
          begin
            upsert_product(workspace, woo_product, domain.platform)
            synced += 1
          rescue ActiveRecord::RecordInvalid => e
            failed += 1
            Rails.logger.warn("[WC-SYNC] upsert FAILED id=#{woo_product["id"]} name=#{woo_product["name"].inspect} error=#{e.message}")
          rescue => e
            failed += 1
            Rails.logger.error("[WC-SYNC] upsert EXCEPTION id=#{woo_product["id"]} class=#{e.class} error=#{e.message}")
          end
        end
      end
    end

    Rails.logger.info("[WC-SYNC] DONE workspace=#{workspace_id} pages=#{pages} synced=#{synced} failed=#{failed} total_fetched=#{total}")
  rescue Integrations::WooCommerceAdapter::AuthenticationError => e
    Rails.logger.error("[WC-SYNC] AUTH FAILED workspace=#{workspace_id} error=#{e.message}")
  rescue Integrations::WooCommerceAdapter::ConnectionError => e
    Rails.logger.error("[WC-SYNC] CONNECTION FAILED workspace=#{workspace_id} error=#{e.message}")
  rescue => e
    Rails.logger.error("[WC-SYNC] FATAL workspace=#{workspace_id} class=#{e.class} error=#{e.message}\n#{e.backtrace.first(5).join("\n")}")
    raise
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

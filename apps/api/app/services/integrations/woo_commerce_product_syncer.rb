module Integrations
  # Pulls the full product catalog from a workspace's WooCommerce store and
  # upserts it into our `products` table. Single source of truth for the sync
  # — used by both the background job (WooCommerceSyncJob) and the inline
  # endpoint that powers the admin "Sincronizar agora" button so merchants
  # see a real count instead of "enqueued" with no further signal.
  #
  # The service owns the RLS contract: each batch upsert runs inside a
  # transaction with `SET LOCAL app.workspace_id = …` so RLS policies on
  # the products table see the correct tenant. Callers do NOT need to
  # provide their own transaction wrapper.
  class WooCommerceProductSyncer
    def self.run(workspace:, domain:)
      new(workspace: workspace, domain: domain).run
    end

    def initialize(workspace:, domain:)
      @workspace = workspace
      @domain    = domain
    end

    def run
      adapter = ::Integrations::WooCommerceAdapter.new(
        store_url:       @domain.woo_store_url,
        consumer_key:    @domain.woo_consumer_key,
        consumer_secret: @domain.woo_consumer_secret
      )

      pages   = 0
      total   = 0
      synced  = 0
      failed  = 0
      errors  = []

      Rails.logger.info("[WC-SYNC] START workspace=#{@workspace.id} store=#{@domain.woo_store_url}")

      adapter.all_products do |batch|
        pages += 1
        total += batch.length
        Rails.logger.info(
          "[WC-SYNC] page=#{pages} batch_size=#{batch.length} " \
          "first_id=#{batch.first&.dig('id')} last_id=#{batch.last&.dig('id')}"
        )

        ActiveRecord::Base.transaction do
          ActiveRecord::Base.connection.execute(
            ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", @workspace.id.to_s])
          )

          batch.each do |woo_product|
            begin
              upsert(woo_product, @domain.platform)
              synced += 1
            rescue => e
              failed += 1
              errors << {
                id:    woo_product["id"],
                name:  woo_product["name"],
                error: "#{e.class}: #{e.message}"
              }
              Rails.logger.warn(
                "[WC-SYNC] upsert FAILED id=#{woo_product['id']} " \
                "name=#{woo_product['name'].inspect} error=#{e.message}"
              )
            end
          end
        end
      end

      Rails.logger.info(
        "[WC-SYNC] DONE workspace=#{@workspace.id} pages=#{pages} " \
        "synced=#{synced} failed=#{failed} total_fetched=#{total}"
      )

      {
        ok:            failed.zero?,
        pages_fetched: pages,
        total_fetched: total,
        synced:        synced,
        failed:        failed,
        errors:        errors.first(20),
        sample_after:  sample_recent
      }
    rescue ::Integrations::WooCommerceAdapter::AuthenticationError => e
      Rails.logger.error("[WC-SYNC] AUTH FAILED workspace=#{@workspace.id} error=#{e.message}")
      { ok: false, stage: "auth",       error: e.message, synced: 0, failed: 0, pages_fetched: 0, total_fetched: 0 }
    rescue ::Integrations::WooCommerceAdapter::ConnectionError => e
      Rails.logger.error("[WC-SYNC] CONNECTION FAILED workspace=#{@workspace.id} error=#{e.message}")
      { ok: false, stage: "connection", error: e.message, synced: 0, failed: 0, pages_fetched: 0, total_fetched: 0 }
    end

    private

    def upsert(woo_product, platform)
      product = @workspace.products.find_or_initialize_by(
        platform:            platform,
        platform_product_id: woo_product["id"].to_s
      )

      product.assign_attributes(
        title:          woo_product["name"],
        handle:         woo_product["slug"],
        image_url:      woo_product.dig("images", 0, "src"),
        price:          woo_product["price"].to_f,
        currency:       woo_product["currency"].presence || "BRL",
        # WooCommerce statuses: publish (live), draft, pending, private.
        # Only `publish` is publicly visible on the merchant's storefront,
        # so that's the only state we mark active. Drafts/etc still land
        # in our DB (so the admin sees them) but get hidden from the
        # storefront widget via the active=true filter.
        active:         woo_product["status"] == "publish",
        last_synced_at: Time.current
      )

      product.save!
    end

    def sample_recent
      @workspace.products
                .where(platform: @domain.platform)
                .order(updated_at: :desc)
                .limit(3)
                .pluck(:platform_product_id, :title)
    end
  end
end

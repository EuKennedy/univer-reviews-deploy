module Integrations
  # Programmatically registers (and unregisters) WooCommerce webhooks on the
  # merchant's store. Goal: zero-touch setup — once the merchant pastes their
  # Consumer Key/Secret in the admin, we install the webhooks ourselves so they
  # never need to open WooCommerce → Settings → Advanced → Webhooks.
  #
  # Idempotent by design: if a webhook for our delivery URL already exists for
  # a topic, we skip it. Re-running register_all is therefore safe.
  class WooCommerceWebhookRegistrar
    # Topics we currently consume server-side. Keep in sync with
    # Api::V1::Webhooks::WoocommerceController#handle_event.
    TOPICS = %w[order.updated order.created].freeze

    DEFAULT_API_URL = "https://api.univerreviews.com".freeze

    Result = Struct.new(:ok, :registered, :skipped, :errors, keyword_init: true) do
      def to_h
        { ok: ok, registered: registered, skipped: skipped, errors: errors }
      end
    end

    class << self
      def register_all(workspace_domain)
        registered = []
        skipped    = []
        errors     = []

        adapter      = build_adapter(workspace_domain)
        delivery_url = build_delivery_url
        secret       = existing_secret(workspace_domain) || SecureRandom.hex(32)

        existing = safe_existing(adapter, delivery_url, errors)
        existing_topics = existing.each_with_object({}) { |w, h| h[w["topic"].to_s] = w }

        TOPICS.each do |topic|
          if existing_topics.key?(topic)
            wh = existing_topics[topic]
            skipped << { id: wh["id"], topic: topic }
            next
          end

          begin
            created = adapter.register_webhook(
              topic:        topic,
              delivery_url: delivery_url,
              secret:       secret
            )
            registered << { id: created["id"], topic: topic }
          rescue WooCommerceAdapter::Error => e
            errors << { topic: topic, error: e.message }
          end
        end

        # Merge metadata (preserve any existing keys including original creds).
        all_ids = (existing.map { |w| { id: w["id"], topic: w["topic"] } } + registered).uniq
        meta = (workspace_domain.platform_meta || {}).merge(
          "webhook_secret"         => secret,
          "webhook_ids"            => all_ids,
          "webhooks_registered_at" => Time.current.iso8601
        )
        workspace_domain.update_column(:platform_meta, meta) if workspace_domain.persisted?

        Result.new(
          ok:         errors.empty?,
          registered: registered,
          skipped:    skipped,
          errors:     errors
        )
      rescue WooCommerceAdapter::Error => e
        Rails.logger.error("[WC-WEBHOOK-REGISTRAR] register_all failed: #{e.message}")
        Result.new(ok: false, registered: registered, skipped: skipped, errors: errors + [{ error: e.message }])
      end

      def unregister_all(workspace_domain)
        registered = []
        skipped    = []
        errors     = []

        meta = workspace_domain.platform_meta || {}
        ids  = Array(meta["webhook_ids"]).map { |h| h.is_a?(Hash) ? h["id"] : h }.compact

        if ids.empty?
          return Result.new(ok: true, registered: registered, skipped: skipped, errors: errors)
        end

        adapter = build_adapter(workspace_domain)

        ids.each do |id|
          begin
            adapter.delete_webhook(id: id)
            registered << { id: id, deleted: true }
          rescue WooCommerceAdapter::Error => e
            errors << { id: id, error: e.message }
          end
        end

        # Clear stored state regardless — if WooCommerce is unreachable we
        # still don't want stale ids hanging around in our DB.
        if workspace_domain.persisted?
          cleared = meta.except("webhook_secret", "webhook_ids", "webhooks_registered_at")
          workspace_domain.update_column(:platform_meta, cleared)
        end

        Result.new(ok: errors.empty?, registered: registered, skipped: skipped, errors: errors)
      rescue WooCommerceAdapter::Error => e
        Rails.logger.error("[WC-WEBHOOK-REGISTRAR] unregister_all failed: #{e.message}")
        Result.new(ok: false, registered: registered, skipped: skipped, errors: errors + [{ error: e.message }])
      end

      private

      def build_adapter(workspace_domain)
        WooCommerceAdapter.new(
          store_url:       workspace_domain.woo_store_url,
          consumer_key:    workspace_domain.woo_consumer_key,
          consumer_secret: workspace_domain.woo_consumer_secret
        )
      end

      def build_delivery_url
        base = ENV["OUR_API_URL"].presence || DEFAULT_API_URL
        "#{base.to_s.chomp('/')}/api/v1/webhooks/woocommerce"
      end

      def existing_secret(workspace_domain)
        (workspace_domain.platform_meta || {})["webhook_secret"].presence
      end

      def safe_existing(adapter, delivery_url, errors)
        adapter.find_our_webhooks(delivery_url: delivery_url)
      rescue WooCommerceAdapter::Error => e
        errors << { stage: "list_webhooks", error: e.message }
        []
      end
    end
  end
end

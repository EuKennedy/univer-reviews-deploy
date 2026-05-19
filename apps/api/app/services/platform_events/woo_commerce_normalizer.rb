module PlatformEvents
  # Normalizes a raw WooCommerce webhook payload + topic into a PlatformEvent
  # attributes hash. Does NOT touch the database — pure mapping.
  class WooCommerceNormalizer
    # Map WC webhook topic + payload status → our internal event_type.
    # WooCommerce sends `order.created` / `order.updated` with the order status
    # in the payload (`completed`, `processing`, `refunded`, ...). Some shops
    # also have a custom `delivered` status driven by tracking plugins.
    STATUS_TO_EVENT = {
      "completed"   => "order_completed",
      "delivered"   => "order_delivered",
      "shipped"     => "order_delivered",
      "refunded"    => "order_refunded",
      "processing"  => "order_paid"
    }.freeze

    class << self
      def normalize(payload, topic)
        return nil if payload.blank?

        event_type = resolve_event_type(payload, topic)
        return nil unless event_type

        billing  = payload["billing"] || {}
        line_items = Array(payload["line_items"])

        {
          platform:          "woocommerce",
          event_type:        event_type,
          external_order_id: (payload["number"].presence || payload["id"]).to_s,
          customer_email:    billing["email"].presence || payload["customer_email"],
          customer_name:     full_name(billing),
          order_total:       payload["total"].presence,
          currency:          payload["currency"].presence,
          product_handles:   line_items.map { |li| product_handle(li) }.compact.uniq,
          raw_payload:       payload,
          received_at:       Time.current
        }
      end

      private

      def resolve_event_type(payload, topic)
        # Explicit topic mapping: `order.completed` always means completion.
        case topic.to_s
        when "order.completed"   then return "order_completed"
        when "order.delivered"   then return "order_delivered"
        when "order.refunded"    then return "order_refunded"
        when "order.paid"        then return "order_paid"
        end

        # order.created / order.updated → status-driven.
        status = payload["status"].to_s.downcase.sub(/\Awc-/, "")
        STATUS_TO_EVENT[status]
      end

      def full_name(billing)
        [billing["first_name"], billing["last_name"]].compact.map(&:to_s).map(&:strip).reject(&:empty?).join(" ").presence
      end

      def product_handle(line_item)
        raw = line_item["slug"].presence ||
              line_item["sku"].presence ||
              line_item["name"].presence
        return nil if raw.blank?
        raw.to_s.downcase.strip.gsub(/[^a-z0-9]+/, "-").gsub(/(^-|-$)/, "")
      end
    end
  end
end

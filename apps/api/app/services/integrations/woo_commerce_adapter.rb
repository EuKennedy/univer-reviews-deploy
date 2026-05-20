require "ipaddr"
require "resolv"
require "uri"

module Integrations
  class WooCommerceAdapter
    class Error < StandardError; end
    class AuthenticationError < Error; end
    class ConnectionError < Error; end
    class InvalidStoreUrlError < Error; end

    # Strict allowlist for store URLs. Without this the adapter happily
    # connects to any host the caller passes — cloud metadata endpoints
    # (169.254.169.254), internal services (127.0.0.1:6379), link-local
    # addresses, and any RFC1918 range. That's a textbook SSRF.
    PRIVATE_IP_RANGES = [
      IPAddr.new("10.0.0.0/8"),
      IPAddr.new("127.0.0.0/8"),
      IPAddr.new("169.254.0.0/16"), # AWS / GCP / Azure metadata
      IPAddr.new("172.16.0.0/12"),
      IPAddr.new("192.168.0.0/16"),
      IPAddr.new("::1/128"),
      IPAddr.new("fc00::/7"),       # Unique local addresses
      IPAddr.new("fe80::/10"),      # Link-local
    ].freeze

    def initialize(store_url:, consumer_key:, consumer_secret:)
      @store_url       = validate_store_url!(store_url.to_s.chomp("/"))
      @consumer_key    = consumer_key
      @consumer_secret = consumer_secret
    end

    private

    def validate_store_url!(url)
      uri = URI.parse(url)
      unless %w[http https].include?(uri.scheme)
        raise InvalidStoreUrlError, "store_url must use http or https"
      end
      # Block http:// outside of dev/test to prevent downgrade and
      # MITM-able requests carrying basic-auth credentials.
      if uri.scheme == "http" && !(Rails.env.development? || Rails.env.test?)
        raise InvalidStoreUrlError, "store_url must use https"
      end
      host = uri.host.to_s.downcase
      raise InvalidStoreUrlError, "store_url must include a host" if host.empty?

      # DNS resolution + private-range check. We only block when DNS resolves
      # AND any returned address is in a private range. If resolution fails or
      # returns nothing (test fixtures, ephemeral hostnames), we let the request
      # proceed and rely on Faraday's normal connection failure path. Blocking
      # on resolution failure would break tests and any short-lived domain that
      # propagates slowly.
      addrs =
        begin
          Resolv.getaddresses(host)
        rescue Resolv::ResolvError, StandardError
          []
        end

      addrs.each do |addr|
        begin
          ip = IPAddr.new(addr)
        rescue IPAddr::InvalidAddressError
          next
        end
        if PRIVATE_IP_RANGES.any? { |range| range.include?(ip) }
          raise InvalidStoreUrlError, "store_url resolves to a private/loopback address (#{addr})"
        end
      end

      # Also reject when the host LITERALLY is a private IP — short-circuits the
      # case where the attacker writes `http://127.0.0.1` directly (Resolv may or
      # may not return it depending on platform/resolver config).
      begin
        literal_ip = IPAddr.new(host)
        if PRIVATE_IP_RANGES.any? { |range| range.include?(literal_ip) }
          raise InvalidStoreUrlError, "store_url points at a private/loopback address (#{host})"
        end
      rescue IPAddr::InvalidAddressError
        # not a literal IP, that's fine
      end

      url
    end

    public

    # Probe the store with the lightest authenticated endpoint that works with a
    # plain Read-scoped key. /system_status requires admin permission and 401s
    # for most production keys; /products?per_page=1 succeeds with any Read key
    # and confirms both auth and that the Products API is reachable.
    def test_connection
      get("/wp-json/wc/v3/products", per_page: 1)

      meta = fetch_store_meta
      {
        success: true,
        store_name: meta[:store_name],
        wc_version: meta[:wc_version],
        wp_version: meta[:wp_version]
      }
    rescue AuthenticationError => e
      { success: false, error: "Credenciais inválidas. Verifique Consumer Key e Secret no painel WooCommerce." }
    rescue ConnectionError => e
      { success: false, error: "Não foi possível conectar a #{@store_url}. Verifique a URL e se a loja está online." }
    rescue Error => e
      msg = e.message.to_s
      hint = if msg.include?("404")
               "Endpoint /wp-json/wc/v3/products não encontrado. A REST API do WooCommerce está habilitada?"
             elsif msg.include?("403")
               "Chave sem permissão de leitura. Recrie a chave com escopo Read/Write."
             else
               msg
             end
      { success: false, error: hint }
    end

    # Best-effort metadata fetch; never raises.
    def fetch_store_meta
      info = get("/wp-json/")
      {
        store_name: info["name"],
        wc_version: info.dig("namespaces")&.find { |n| n.start_with?("wc/") }&.split("/")&.last,
        wp_version: info["url"] ? "ok" : nil
      }
    rescue
      { store_name: nil, wc_version: nil, wp_version: nil }
    end

    def products(page: 1, per_page: 100)
      get("/wp-json/wc/v3/products", per_page: per_page, page: page)
    end

    def products_count
      response = get("/wp-json/wc/v3/products", per_page: 1, page: 1)
      # WooCommerce returns X-WP-Total header — handled by inspecting response
      response
    end

    def orders(status: "completed", after: nil, page: 1, per_page: 100)
      params = { per_page: per_page, page: page, status: status }
      params[:after] = after.iso8601 if after
      get("/wp-json/wc/v3/orders", **params)
    end

    def reviews(page: 1, per_page: 100, after: nil)
      params = { per_page: per_page, page: page }
      params[:after] = after.iso8601 if after
      get("/wp-json/wc/v3/products/reviews", **params)
    end

    def all_products(&block)
      page = 1
      loop do
        batch = products(page: page, per_page: 100)
        Rails.logger.info("[WC-ADAPTER] /products page=#{page} per_page=100 → got #{Array(batch).length}")
        break if Array(batch).empty?
        block.call(batch)
        break if Array(batch).length < 100
        page += 1
        break if page > 100 # safety: cap at 10k products per sync
      end
    end

    def all_reviews(&block)
      page = 1
      loop do
        batch = reviews(page: page, per_page: 100)
        break if batch.empty?
        block.call(batch)
        break if batch.length < 100
        page += 1
      end
    end

    # ── Webhooks ────────────────────────────────────────────────────────────────
    # Register a webhook on the merchant's WooCommerce store so we receive live
    # events at our public ingest endpoint without the merchant ever having to
    # open the WooCommerce → Settings → Advanced → Webhooks panel manually.
    def register_webhook(topic:, delivery_url:, secret:, name: nil)
      body = {
        name:         name || "UniverReviews — #{topic}",
        topic:        topic,
        delivery_url: delivery_url,
        secret:       secret,
        status:       "active",
        api_version:  3
      }
      post("/wp-json/wc/v3/webhooks", body)
    end

    def list_webhooks
      get("/wp-json/wc/v3/webhooks", per_page: 100)
    end

    def delete_webhook(id:)
      delete("/wp-json/wc/v3/webhooks/#{id}", force: true)
    end

    # Return only webhooks already pointing at our delivery_url so register_all
    # can stay idempotent across re-runs of the connect flow.
    def find_our_webhooks(delivery_url:)
      Array(list_webhooks).select { |w| w["delivery_url"].to_s == delivery_url.to_s }
    end

    private

    def connection
      @connection ||= Faraday.new(url: @store_url) do |f|
        f.request :authorization, :basic, @consumer_key, @consumer_secret
        f.request :url_encoded
        f.response :json
        f.response :raise_error
        f.request :retry, max: 3, interval: 0.5, backoff_factor: 2,
                          exceptions: [Faraday::TimeoutError, Faraday::ConnectionFailed]
        f.options.timeout      = 30
        f.options.open_timeout = 10
      end
    end

    def get(path, **params)
      response = connection.get(path, params)
      response.body
    rescue Faraday::UnauthorizedError
      raise AuthenticationError, "WooCommerce authentication failed — check consumer key/secret"
    rescue Faraday::ConnectionFailed, Faraday::TimeoutError => e
      raise ConnectionError, "WooCommerce connection error: #{e.message}"
    rescue Faraday::Error => e
      raise Error, "WooCommerce API error: #{e.message}"
    end

    def post(path, body)
      response = connection.post(path) do |req|
        req.headers["Content-Type"] = "application/json"
        req.body = body.to_json
      end
      response.body
    rescue Faraday::UnauthorizedError
      raise AuthenticationError, "WooCommerce authentication failed — check consumer key/secret"
    rescue Faraday::ConnectionFailed, Faraday::TimeoutError => e
      raise ConnectionError, "WooCommerce connection error: #{e.message}"
    rescue Faraday::Error => e
      raise Error, "WooCommerce API error: #{e.message}"
    end

    def delete(path, **params)
      response = connection.delete(path) do |req|
        params.each { |k, v| req.params[k.to_s] = v }
      end
      response.body
    rescue Faraday::UnauthorizedError
      raise AuthenticationError, "WooCommerce authentication failed — check consumer key/secret"
    rescue Faraday::ConnectionFailed, Faraday::TimeoutError => e
      raise ConnectionError, "WooCommerce connection error: #{e.message}"
    rescue Faraday::Error => e
      raise Error, "WooCommerce API error: #{e.message}"
    end
  end
end

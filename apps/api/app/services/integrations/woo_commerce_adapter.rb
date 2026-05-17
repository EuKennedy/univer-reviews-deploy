module Integrations
  class WooCommerceAdapter
    class Error < StandardError; end
    class AuthenticationError < Error; end
    class ConnectionError < Error; end

    def initialize(store_url:, consumer_key:, consumer_secret:)
      @store_url       = store_url.to_s.chomp("/")
      @consumer_key    = consumer_key
      @consumer_secret = consumer_secret
    end

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
        break if batch.empty?
        block.call(batch)
        break if batch.length < 100
        page += 1
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
  end
end

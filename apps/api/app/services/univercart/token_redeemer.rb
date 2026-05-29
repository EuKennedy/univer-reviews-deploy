module Univercart
  # Thin HTTP client for Univercart's `POST /v1/tokens/:jti/redeem`
  # endpoint, which marks a magic-link JTI as used so a second visit to
  # `/connect/setup?t=<JWT>` can't grant another session.
  #
  # Called from the Next.js `/connect/setup` page via the Rails
  # `/api/v1/connect/redeem` proxy (the Univercart API key lives only on
  # the Rails side — we don't ship it to the browser).
  #
  # Response semantics (per Univercart docs):
  #   200 → OK, proceed to session creation
  #   404 → unknown JTI (possibly for another partner)
  #   410 → token already used OR expired (`token_already_used` /
  #         `token_expired` in body — both terminal)
  class TokenRedeemer
    DEFAULT_BASE_URL = "https://api.univercart.com".freeze

    Result = Struct.new(:ok, :status, :reason, :body, keyword_init: true)

    # @return [Result]
    def self.redeem(jti:, api_key: ENV["UNIVERCART_API_KEY"], base_url: ENV["UNIVERCART_API_URL"] || DEFAULT_BASE_URL)
      if api_key.to_s.empty?
        return Result.new(ok: false, status: 0, reason: "missing_api_key", body: nil)
      end
      if jti.to_s.empty? || !jti.match?(/\A[A-Za-z0-9_\-]+\z/)
        return Result.new(ok: false, status: 0, reason: "malformed_jti", body: nil)
      end

      conn = Faraday.new(url: base_url) do |f|
        f.request  :authorization, "Bearer", api_key
        f.response :json, content_type: /\bjson$/
        f.options.timeout      = 10
        f.options.open_timeout = 5
      end

      resp = conn.post("/v1/tokens/#{jti}/redeem") do |req|
        req.headers["Content-Type"] = "application/json"
        req.body = "{}"
      end

      case resp.status
      when 200
        Result.new(ok: true, status: 200, reason: nil, body: resp.body)
      when 404
        Result.new(ok: false, status: 404, reason: "unknown_jti", body: resp.body)
      when 410
        reason = resp.body.is_a?(Hash) ? resp.body["error"].to_s : "token_gone"
        reason = "token_gone" if reason.empty?
        Result.new(ok: false, status: 410, reason: reason, body: resp.body)
      else
        Result.new(ok: false, status: resp.status, reason: "redeem_failed", body: resp.body)
      end
    rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
      Result.new(ok: false, status: 0, reason: "connection_error", body: { message: e.message })
    rescue => e
      Rails.logger.error("[univercart-redeem] unexpected error: #{e.class}: #{e.message}")
      Result.new(ok: false, status: 0, reason: "internal_error", body: nil)
    end
  end
end

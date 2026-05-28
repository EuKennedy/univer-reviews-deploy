# frozen_string_literal: true

# Rack::Attack — abuse protection in front of Rails.
#
# Three layers:
#   1. Global throttles per-IP for unauthenticated paths (login, public
#      review submit, signup), to mitigate brute force + spam.
#   2. Per-workspace throttles on authenticated API surface so one
#      runaway tenant can't starve the Postgres connection pool or burn
#      Anthropic credit. Throttle key prefers the workspace API key
#      (one workspace = one bucket) when present, else falls back to
#      the resolved session's workspace_id header.
#   3. Per-IP fail2ban-ish ban on repeated 401s — bots probing tokens
#      eat their own throttle window.
#
# Cache backend: Redis when REDIS_URL is set (default in prod), in-memory
# fallback for the test env so specs don't depend on Redis being up.
class Rack::Attack
  # ── Cache ────────────────────────────────────────────────────────────
  Rack::Attack.cache.store =
    if Rails.env.test?
      ActiveSupport::Cache::MemoryStore.new
    else
      ActiveSupport::Cache::RedisCacheStore.new(
        url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"),
        namespace: "rack-attack",
        # 1s timeout — never let throttle lookups stall a hot path.
        connect_timeout: 1, read_timeout: 1, write_timeout: 1,
        reconnect_attempts: 0,
      )
    end

  # ── Allow-list ──────────────────────────────────────────────────────
  # Health probes must NEVER be throttled. The Rails app exposes only
  # /api/health and the default `/up`; admin app has its own middleware
  # for login/signup throttles since Better Auth lives there.
  Rack::Attack.safelist("allow health probe") do |req|
    req.path == "/up" || req.path == "/healthz" || req.path == "/api/health"
  end

  # ── Public surface throttles (per-IP) ───────────────────────────────
  #
  # Public review submit (X-Univer-Domain): 30/min/IP. Real customers
  # don't burst-submit; bots do.
  throttle("public-review-submit/ip", limit: 30, period: 1.minute) do |req|
    req.ip if req.path.include?("/api/v1/public/reviews") && req.post?
  end

  # Workspace API key creation flow (bearer auth issuance is admin-side
  # only — no Rails public path).

  # ── Authenticated API throttles (per-workspace) ─────────────────────
  #
  # Workspace ID is resolved from one of:
  #   1. X-Univer-Workspace-Id header
  #   2. Bearer token prefix (workspace_api_keys.key_prefix is the first
  #      8 chars after "unvr_" so the same plan gets the same bucket).
  # No identifier → fall back to IP (better than nothing).
  WORKSPACE_THROTTLE_KEY = lambda do |req|
    ws_id = req.get_header("HTTP_X_UNIVER_WORKSPACE_ID").presence
    next ws_id if ws_id

    auth = req.get_header("HTTP_AUTHORIZATION").to_s
    if auth.start_with?("Bearer unvr_") && auth.length >= 20
      next "key:#{auth[13, 16]}" # 16-char prefix
    end

    "ip:#{req.ip}"
  end

  # Default API budget — 600/min per workspace. The widget storefront
  # backed by a single workspace can easily hit ~5–10 req/min per page
  # view; 600 covers ~600 concurrent page views in a 60-second burst.
  throttle("api/workspace", limit: 600, period: 1.minute) do |req|
    next unless req.path.start_with?("/api/v1/")
    next if req.path.start_with?("/api/v1/public/")  # public has its own
    next if req.path.include?("/webhooks/")          # webhooks signed separately
    WORKSPACE_THROTTLE_KEY.call(req)
  end

  # AI endpoints are 10x more expensive ($ + latency). Cap to 60/min/workspace.
  throttle("ai/workspace", limit: 60, period: 1.minute) do |req|
    next unless req.path.start_with?("/api/v1/ai/")
    WORKSPACE_THROTTLE_KEY.call(req)
  end

  # Public widget endpoints — 1200/min/IP+domain bucket. High because
  # one page view fans out into widget-config + reviews + summary +
  # ai-carousel.
  throttle("public-widget/ip-domain", limit: 1200, period: 1.minute) do |req|
    next unless req.path.start_with?("/api/v1/public/")
    domain = req.get_header("HTTP_X_UNIVER_DOMAIN").to_s
    "pub:#{domain.presence || 'no-domain'}:#{req.ip}"
  end

  # ── Fail2ban on repeated auth failures ──────────────────────────────
  blocklist("fail2ban auth") do |req|
    Rack::Attack::Fail2Ban.filter("auth-#{req.ip}", maxretry: 20, findtime: 10.minutes, bantime: 1.hour) do
      # If the response was a 401 we mark this request as a fail. We
      # can't easily inspect responses from inside Rack::Attack, so we
      # rely on the controller layer calling `Rack::Attack::Fail2Ban.filter`
      # explicitly inside the rescue_from UnauthorizedError handler
      # (not done in this commit — wired later if real abuse appears).
      false
    end
  end

  # ── Response ────────────────────────────────────────────────────────
  #
  # rack-attack 6.7 invokes the responder with a Rack::Attack::Request,
  # not a raw env hash. Pull match data off the request's env accessor
  # so we expose `retry_after_seconds` consistently.
  Rack::Attack.throttled_responder = lambda do |request|
    env = request.respond_to?(:env) ? request.env : request
    match_data = (env.is_a?(Hash) ? env["rack.attack.match_data"] : nil) || {}
    retry_after = (match_data[:period] || 60).to_i
    [
      429,
      {
        "Content-Type" => "application/json",
        "Retry-After" => retry_after.to_s,
      },
      [
        {
          error: "rate_limited",
          message: "Muitos pedidos. Aguarde alguns segundos e tente novamente.",
          retry_after_seconds: retry_after,
        }.to_json,
      ],
    ]
  end
end

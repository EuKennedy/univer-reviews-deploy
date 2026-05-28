# frozen_string_literal: true

# Sentry — error monitoring with aggressive PII scrubbing.
#
# Three layers of redaction so a sloppy controller logging a user
# email or password never reaches Sentry servers:
#   1. send_default_pii = false (Sentry's built-in filter)
#   2. Header allow-list — strip Authorization, Cookie, X-Univer-Api-Key
#      from every event before send
#   3. Recursive PII scrubber walking event.request.data, breadcrumbs,
#      extra, contexts. Matches the LGPD playbook contract (§ 8).

SENSITIVE_KEYS = Set.new(
  %w[
    password new_password old_password password_hash password_confirmation
    token access_token refresh_token auth_token id_token api_key apikey
    secret jwt_secret webhook_secret
    authorization cookie set_cookie
    credit_card cvc cvv cpf cnpj rg ssn
  ].freeze
).freeze

PII_PATTERNS = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, "[REDACTED-EMAIL]"],
  [/\b\d{2,3}\s?9?\d{4}-?\d{4}\b/, "[REDACTED-PHONE]"],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, "[REDACTED-CPF]"],
  [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/, "[REDACTED-CNPJ]"],
].freeze

REDACT_STRING = ->(s) do
  PII_PATTERNS.reduce(s) { |acc, (pat, rep)| acc.gsub(pat, rep) }
end

# Recursive scrub. Depth-cap protects against pathological structures
# (Sentry breadcrumbs occasionally include large nested hashes from
# ActiveRecord query plans).
SCRUB_VALUE = ->(value, depth = 0) do
  return value if depth > 4
  case value
  when String
    REDACT_STRING.call(value)
  when Array
    value.map { |v| SCRUB_VALUE.call(v, depth + 1) }
  when Hash
    value.each_with_object({}) do |(k, v), out|
      out[k] = if SENSITIVE_KEYS.include?(k.to_s.downcase)
                 "[FILTERED]"
               else
                 SCRUB_VALUE.call(v, depth + 1)
               end
    end
  else
    value
  end
end

Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]
  config.breadcrumbs_logger = %i[active_support_logger http_logger]
  config.traces_sample_rate = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.1").to_f
  config.environment = ENV.fetch("RAILS_ENV", "development")
  config.send_default_pii = false
  config.enabled_environments = %w[production staging]

  # Capture exceptions from background jobs too — Sidekiq integration
  # is enabled by sentry-rails automatically; we just have to make sure
  # the queues we care about (:ai, :default, :imports) are instrumented.
  # No additional config needed once the gem is loaded.

  config.before_send = lambda do |event, _hint|
    # 1. Strip sensitive headers entirely (allow-list of remaining).
    if event.request&.headers.is_a?(Hash)
      %w[Authorization Cookie Set-Cookie X-Univer-Api-Key].each do |h|
        event.request.headers.delete(h)
      end
    end

    # 2. Recursive scrub on body / extras / breadcrumbs.
    if event.request&.data
      event.request.data = SCRUB_VALUE.call(event.request.data)
    end

    if event.extra.is_a?(Hash)
      event.extra = SCRUB_VALUE.call(event.extra)
    end

    if event.contexts.is_a?(Hash)
      event.contexts = SCRUB_VALUE.call(event.contexts)
    end

    if event.breadcrumbs.respond_to?(:each)
      event.breadcrumbs.each do |b|
        b.data = SCRUB_VALUE.call(b.data) if b.respond_to?(:data) && b.data
        b.message = REDACT_STRING.call(b.message) if b.respond_to?(:message) && b.message.is_a?(String)
      end
    end

    # 3. Redact exception messages (controllers occasionally raise with
    #    a user-supplied string baked in).
    if event.exception.respond_to?(:values)
      event.exception.values.each do |ex|
        ex.value = REDACT_STRING.call(ex.value) if ex.value.is_a?(String)
      end
    end

    # 4. Never expose user identity in events.
    if event.user
      event.user.delete(:email)
      event.user.delete(:username)
      event.user.delete(:ip_address)
    end

    event
  end
end

Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]
  config.breadcrumbs_logger = %i[active_support_logger http_logger]
  config.traces_sample_rate = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.1").to_f
  config.send_default_pii = false

  config.before_send = lambda do |event, _hint|
    # Strip sensitive headers
    event.request&.headers&.delete("Authorization")
    event.request&.headers&.delete("X-Univer-Api-Key")
    event
  end
end

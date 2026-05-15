require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info").to_sym
  config.log_tags = [:request_id]

  # Use a real logger in production
  config.logger = ActiveSupport::Logger.new($stdout)
                                       .tap { |logger| logger.formatter = ::Logger::Formatter.new }
                                       .then { |logger| ActiveSupport::TaggedLogging.new(logger) }

  # Force SSL
  config.force_ssl = ENV.fetch("FORCE_SSL", "true") == "true"

  # Cache
  config.cache_store = :redis_cache_store, {
    url: ENV.fetch("REDIS_URL", "redis://localhost:6379/1"),
    error_handler: ->(method:, returning:, exception:) {
      Sentry.capture_exception(exception, level: "warning", tags: { method: method })
    }
  }

  config.active_record.dump_schema_after_migration = false

  # Action Mailer
  config.action_mailer.perform_caching = false
  config.action_mailer.raise_delivery_errors = true
end

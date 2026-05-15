require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = true
  config.server_timing = true

  # Logging
  config.log_level = :debug
  config.log_tags = [:request_id]

  # Action Mailer (not used directly, using Resend SDK)
  config.action_mailer.raise_delivery_errors = false
  config.action_mailer.perform_caching = false

  # Active Record
  config.active_record.verbose_query_logs = true
  config.active_record.migration_error = :page_load

  # Bullet for N+1 detection
  config.after_initialize do
    Bullet.enable        = true
    Bullet.rails_logger  = true
    Bullet.add_footer    = false
  end
end

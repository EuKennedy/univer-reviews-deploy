require_relative "boot"
require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_mailer/railtie"

Bundler.require(*Rails.groups)

module UniverseReviewsApi
  class Application < Rails::Application
    config.load_defaults 8.0
    config.api_only = true
    config.time_zone = "UTC"
    config.i18n.default_locale = :"pt-BR"
    config.active_job.queue_adapter = :sidekiq
    config.active_record.schema_format = :sql

    # Autoload paths
    config.autoload_paths += %W[
      #{root}/app/errors
      #{root}/app/services
      #{root}/app/serializers
    ]

    # JSON serialization with Oj
    config.middleware.use ActionDispatch::RequestId, header: "X-Request-Id"

    # CORS
    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins "*"
        resource "/api/v1/public/*", headers: :any, methods: %i[get post options]
        resource "/widget.js", headers: :any, methods: %i[get]
        resource "/health", headers: :any, methods: %i[get]
      end

      allow do
        origins(
          ENV.fetch("FRONTEND_URL", "http://localhost:3001"),
          "http://localhost:3000",
          /\Ahttps?:\/\/[\w.-]+\.univerreviews\.com\z/
        )
        resource "/api/*", headers: :any, methods: %i[get post put patch delete options]
      end
    end

    # Security headers
    config.action_dispatch.default_headers = {
      "X-Frame-Options" => "SAMEORIGIN",
      "X-XSS-Protection" => "0",
      "X-Content-Type-Options" => "nosniff",
      "X-Permitted-Cross-Domain-Policies" => "none",
      "Referrer-Policy" => "strict-origin-when-cross-origin"
    }
  end
end

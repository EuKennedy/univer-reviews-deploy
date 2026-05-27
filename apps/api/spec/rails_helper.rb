ENV["RAILS_ENV"] ||= "test"

# Boot SimpleCov BEFORE application code so it can instrument every
# require'd file. Settings live in apps/api/.simplecov.
if ENV["COVERAGE"] != "false"
  begin
    require "simplecov"
    # `.simplecov` at the project root is auto-loaded by SimpleCov.start.
  rescue LoadError
    # Local devs without the gem yet — proceed without coverage. CI installs it.
  end
end

require_relative "../config/environment"
require "rspec/rails"
require "shoulda/matchers"
require "factory_bot_rails"
require "database_cleaner/active_record"

begin
  require "webmock/rspec"
  WebMock.disable_net_connect!(allow_localhost: true)
rescue LoadError
  # webmock not installed yet — tests that depend on it will be skipped.
end

# ActiveJob test adapter so we can assert enqueued jobs deterministically.
require "active_job/test_helper"

Dir[Rails.root.join("spec/support/**/*.rb")].sort.each { |f| require f }

# In CI we run `rails db:migrate` against the test DB directly before invoking
# rspec, so maintain_test_schema! is both redundant and harmful: with
# schema_format = :sql, Rails 8.1 dumps a structure.sql that starts with
# `CREATE SCHEMA public` (no IF NOT EXISTS), and reloading it against an
# already-bootstrapped database fails with "schema public already exists".
# Local devs still get the safety net.
unless ENV["CI"]
  begin
    ActiveRecord::Migration.maintain_test_schema!
  rescue ActiveRecord::PendingMigrationError => e
    abort e.to_s.strip
  end
end

RSpec.configure do |config|
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include ActiveJob::TestHelper

  config.before(:suite) do
    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.clean_with(:truncation)
  end

  config.around do |example|
    DatabaseCleaner.cleaning { example.run }
  end

  # Use the test adapter for ActiveJob so we can introspect enqueued jobs.
  config.before(:each) do
    ActiveJob::Base.queue_adapter = :test
  end
end

Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end

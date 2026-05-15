max_threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }
min_threads_count = ENV.fetch("RAILS_MIN_THREADS") { max_threads_count }
threads min_threads_count, max_threads_count

# Bind explicitly to 0.0.0.0 so Traefik (and any reverse proxy) can reach the
# container. The default in cluster mode behind docker can fail to listen
# on the right interface. Use only `bind` (not `port`) because puma applies
# both and ends up trying to bind the same socket twice → EADDRINUSE.
bind "tcp://0.0.0.0:#{ENV.fetch('PORT') { 3000 }}"

environment ENV.fetch("RAILS_ENV") { "development" }

# Run as a single process by default to make boot crashes visible in logs.
# Set WEB_CONCURRENCY=2 (or higher) to enable cluster mode in environments
# where the app is known to boot cleanly.
workers ENV.fetch("WEB_CONCURRENCY") { 0 }.to_i

if ENV.fetch("WEB_CONCURRENCY", "0").to_i > 0
  preload_app!

  on_worker_boot do
    ActiveSupport.on_load(:active_record) do
      ActiveRecord::Base.establish_connection
    end
  end
end

plugin :tmp_restart

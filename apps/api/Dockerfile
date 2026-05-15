FROM ruby:3.3-slim

RUN apt-get update -qq && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install gems first (layer caching)
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local without "development test" && \
    bundle install --jobs 4 --retry 3

COPY . .

# Precompile assets (no-op for API-only apps, safe to fail)
RUN bundle exec rails assets:precompile 2>/dev/null || true

# Set non-root user for security
RUN groupadd -r app && useradd -r -g app app && \
    chown -R app:app /app
USER app

EXPOSE 3000

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]

# ─── Stage 1: build widget bundle ────────────────────────────────────────────
FROM node:20-alpine AS widget-builder
WORKDIR /widget
COPY apps/widget/package.json apps/widget/tsconfig.json apps/widget/rollup.config.js ./
COPY apps/widget/src ./src
RUN npm install --no-audit --no-fund && npm run build

# ─── Stage 2: rails runtime ──────────────────────────────────────────────────
FROM ruby:3.3-slim

RUN apt-get update -qq && apt-get install -y \
    build-essential \
    libpq-dev \
    libyaml-dev \
    libffi-dev \
    libssl-dev \
    pkg-config \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install gems first (layer caching)
COPY apps/api/Gemfile apps/api/Gemfile.lock* ./
RUN bundle config set --local without "development test" && \
    bundle install --jobs 4 --retry 3

# Copy rails source
COPY apps/api/ ./

# Copy built widget bundle into rails public dir for /widget.js serving
COPY --from=widget-builder /widget/dist/widget.js ./public/widget.js

# Precompile (no-op for API-only)
RUN bundle exec rails assets:precompile 2>/dev/null || true

# Non-root user
RUN groupadd -r app && useradd -r -g app app && \
    chown -R app:app /app
USER app

EXPOSE 3000

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]

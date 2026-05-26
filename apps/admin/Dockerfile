FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# ─── Stage 1: deps ──────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# npm install (not ci) so lockfile drift caused by added deps gets resolved
# during the first deploy. CI builds will pick the regenerated lockfile.
RUN npm install --no-audit --no-fund --legacy-peer-deps

# ─── Stage 2: builder ───────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=https://api.univerreviews.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
# Cap the Node heap so `next build` + standalone tracing fits on the
# Coolify host. Default V8 limit on Node 20 grows unbounded toward host
# RAM, which on a 4 GB VPS gets the docker build SIGKILLed during the
# final "Collecting build traces" step (exit code 255). 2 GB is enough
# headroom for Next 15 + the dashboard's bundle.
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# ─── Stage 3: runner ────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]

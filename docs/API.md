# UniverReviews API Reference

Stable surface for programmatic clients. All requests are HTTPS only.
Bearer auth uses a workspace-scoped API key (`unvr_...`) issued from
`/<slug>/settings → API → Keys`. Each request runs inside a
PostgreSQL transaction with `app.workspace_id` pinned via RLS — wrong
key = wrong workspace = empty result set.

Base URL: `https://api.univerreviews.com/api/v1`

---

## Auth

```http
Authorization: Bearer unvr_<64-hex-chars>
Accept: application/json
Content-Type: application/json
```

Bearer tokens are tied to a single workspace. Calls from one workspace's
key to a different workspace's data return 404 (we never confirm
existence cross-tenant).

---

## Conventions

- Pagination: `?page=N&per_page=M` → `meta.{ current_page, total_pages, total_count, per_page }`.
- Timestamps: ISO 8601 UTC.
- IDs: UUID v4.
- Error envelope: `{ "error": "code", "message": "human", "issues": ["..."] }`.
- Rate limits: 600/min/workspace (API), 60/min/workspace (AI). 429 includes
  `Retry-After` header + `retry_after_seconds` in body.

---

## Reviews

```http
GET    /reviews?product_id=:id&status=approved&per_page=20&page=1
GET    /reviews/:id
POST   /reviews
PATCH  /reviews/:id/status     { "status": "approved" | "rejected" | "hidden" }
DELETE /reviews/:id
POST   /reviews/bulk           { "ids": ["uuid"...], "action": "approve" }
GET    /reviews/export.csv     CSV download
```

Review fields: `id, rating, title, body, author_name, author_email,
status (pending|approved|rejected|hidden|spam), is_verified_purchase,
helpful_count, media[], replies[], ai_analysis, created_at`.

---

## Products

```http
GET    /products?active=true&per_page=25
GET    /products/:id
POST   /products
PATCH  /products/:id
DELETE /products/:id
POST   /products/sync          (triggers WooCommerce/Shopify sync job)
```

---

## Q&A

```http
GET    /questions?product_id=:id
POST   /questions
PATCH  /questions/:id          { "answer": "...", "status": "published" }
DELETE /questions/:id
```

---

## AI Summary Topics

```http
GET    /ai_summary_topics?product_id=:id
GET    /ai_summary_topics/:id
POST   /ai_summary_topics      { product_id, title, ai_summary?, source?, review_ids? }
PATCH  /ai_summary_topics/:id  { ai_summary_topic: { title?, ai_summary?, position? } }
DELETE /ai_summary_topics/:id
POST   /ai_summary_topics/:id/attach_reviews   { review_ids: [...] }
POST   /ai_summary_topics/:id/detach_reviews   { review_ids: [...] }
```

`source` accepts `"manual"` (default) or `"ai"` (external authoring path —
sets `generated_at`).

---

## AI

```http
GET    /ai/health
GET    /ai/cost-report?days=30
POST   /ai/moderate                { review_id }
POST   /ai/moderate-pending
POST   /ai/generate-summary-topics { product_id, mode?: "replace" | "append" }
POST   /ai/generate-summary-topics-bulk { product_ids?: [...] }
POST   /ai/bulk-create-reviews     { product_id, count, tone?, status?, language?, date_spread_days? }
POST   /ai/bulk-create-questions   { product_id, count, status?, language? }
POST   /ai/reply                   { review_id }
POST   /ai/auto-reply              { review_id }
GET    /ai/duplicates
POST   /ai/dedup                   { review_id }
POST   /ai/cleanup-duplicates
POST   /ai/embed                   { review_id }
POST   /ai/find-similar            { review_id, limit?, threshold? }
```

AI endpoints are gated by `PlanFeatures`:
- `ai_moderation` — Starter+
- `ai_summary_topics` — Pro+
- `ai_bulk_generate_reviews` — Pro+
- `ai_bulk_generate_qa` — Pro+
- `ai_dedup` — Pro+

Locked endpoint returns **402 Payment Required**:
```json
{
  "error": "feature_locked",
  "message": "Esta funcionalidade exige plano Pro.",
  "feature": "ai_summary_topics",
  "current_plan": "free",
  "required_plan": "pro",
  "upgrade_url": "/billing"
}
```

---

## Campaigns

```http
GET    /campaigns
POST   /campaigns
PATCH  /campaigns/:id
DELETE /campaigns/:id
POST   /campaigns/:id/send_now
GET    /campaigns/:id/sends
```

---

## Workspace

```http
GET    /workspace                  (workspace settings + plan_features snapshot)
PATCH  /workspace                  (update brand_color, default_locale, etc)
GET    /workspace/stats
GET    /workspace/users
POST   /workspace/users            (invite)
PATCH  /workspace/users/:id
DELETE /workspace/users/:id
GET    /workspace/api_keys
POST   /workspace/api_keys         { name }
DELETE /workspace/api_keys/:id
GET    /workspace/domains
POST   /workspace/domains          { domain, platform? }
DELETE /workspace/domains/:id
POST   /workspace/brand-assets/rating-icon  (multipart, SVG/PNG ≤ 500KB)
DELETE /workspace/brand-assets/rating-icon
```

---

## Audit log

```http
GET    /audit_logs?action=...&user_id=...&from=ISO&to=ISO
GET    /audit_logs/actions          (distinct list for filter UI)
```

---

## Public surface (storefront)

No bearer auth. Validated via `X-Univer-Domain` header (must match a
registered workspace domain).

```http
GET  /public/widget-config
GET  /public/summary/:product_id
GET  /public/reviews?product_id=:id
GET  /public/ai-summary-topics?product_id=:id
GET  /public/ai-carousel/:product_id
GET  /public/qa?product_id=:id
GET  /public/videos?product_id=:id
POST /public/reviews   (anti-abuse: 30/min/IP rate limit + bot detection)
```

---

## Webhooks (inbound)

```http
POST /webhooks/stripe      (Stripe-signed)
POST /webhooks/shopify     (per-shop HMAC)
POST /webhooks/woocommerce (per-domain HMAC)
POST /webhooks/resend      (svix HMAC)
POST /webhooks/feedspace   (shared FEEDSPACE_WEBHOOK_SECRET + X-Workspace-Id)
```

All fail-closed in production: missing/invalid signature → 401.

# UniverReviews

[![CI](https://github.com/EuKennedy/univerreviews/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/EuKennedy/univerreviews/actions/workflows/ci.yml)

Plataforma multi-tenant de reviews para e-commerce com IA nativa.

Substitui Ryviu, Judge.me, Yotpo, Loox e similares com paridade de features + IA generativa (moderação, geração, anti-fraude, auto-resposta, tradução) + coleta multicanal (Email, WhatsApp, SMS) + UGC de vídeo via Feedspace.

**Custo operacional alvo:** < US$ 15/mês por loja.
**Loja-piloto:** lizzon.com.br (WooCommerce).

---

## Stack

- **Backend API:** Rails 8 (Ruby 3.3+) — `apps/api`
- **Admin dashboard:** Next.js 15 + React 19 + TypeScript + Tailwind v4 — `apps/admin`
- **Widget público:** Vanilla Web Component, Shadow DOM, < 20KB — `apps/widget`
- **Landing:** Next.js 15 estático — `apps/landing`
- **Plugin WordPress:** PHP 8.1+ — `plugins/wordpress`
- **Banco:** PostgreSQL 16 + pgvector
- **Cache/Jobs:** Redis + Sidekiq
- **Storage:** MinIO (S3-compatible)
- **IA:** Anthropic Claude Sonnet 4.6 (forte) + Haiku 4.5 (volume)
- **Deploy:** Docker Compose + Coolify (self-hosted VPS)

---

## Setup local

```bash
# 1. Copia env
cp .env.example .env
# edita .env com as suas chaves (ANTHROPIC_API_KEY, etc)

# 2. Sobe infra (Postgres, Redis, MinIO)
docker compose -f docker-compose.dev.yml up -d

# 3. Backend Rails
cd apps/api
bundle install
bin/rails db:create db:migrate db:seed
bin/rails s -p 3001

# 4. Frontend Admin
cd ../admin
pnpm install
pnpm dev   # http://localhost:3000

# 5. Widget (build em watch)
cd ../widget
pnpm install
pnpm dev
```

---

## Domínios em produção

| Subdomínio | Serviço |
|---|---|
| `univerreviews.com` | Landing |
| `dash.univerreviews.com` | Admin dashboard |
| `api.univerreviews.com` | Rails API + widget CDN |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  VPS via Coolify                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Landing  │  │  Admin   │  │ Rails 8  │               │
│  │ Next.js  │  │ Next.js  │  │   API    │               │
│  └──────────┘  └──────────┘  └─────┬────┘               │
│                                     │                    │
│       ┌─────────────────────────────┼────────────┐      │
│       ▼                             ▼            ▼      │
│  ┌──────────┐              ┌──────────┐  ┌──────────┐  │
│  │ Postgres │              │  Redis   │  │  MinIO   │  │
│  │+ pgvector│              │+ Sidekiq │  │ (mídia)  │  │
│  └──────────┘              └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

Multi-tenancy: toda tabela tem `workspace_id` + Row Level Security no Postgres.

---

## Documentação

- [`docs/architecture.md`](docs/architecture.md) — Decisões e diagramas
- [`docs/api-reference.md`](docs/api-reference.md) — Contratos REST
- [`docs/multi-tenant.md`](docs/multi-tenant.md) — Isolamento por workspace
- [`docs/plugin-install.md`](docs/plugin-install.md) — Setup do plugin WP

-- Better Auth schema bootstrap. Hand-written equivalent of drizzle-kit generate
-- output for the schema defined in apps/admin/src/lib/db/schema.ts.
--
-- Run order:
--   1. CREATE SCHEMA auth (Rails migration 20260516000001 does this)
--   2. This file (drizzle-kit migrate or psql -f)
--   3. Rails migrations (workspace bridge columns)
--   4. rails auth:migrate (backfill)
--
-- Idempotent: uses IF NOT EXISTS everywhere.

CREATE SCHEMA IF NOT EXISTS auth;

-- ─── user ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth."user" (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  email           text NOT NULL UNIQUE,
  email_verified  boolean NOT NULL DEFAULT false,
  image           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  role            text,
  banned          boolean DEFAULT false,
  ban_reason      text,
  ban_expires     timestamptz
);
CREATE INDEX IF NOT EXISTS user_email_idx ON auth."user" (email);

-- ─── session ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.session (
  id                       text PRIMARY KEY,
  user_id                  text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  token                    text NOT NULL UNIQUE,
  expires_at               timestamptz NOT NULL,
  ip_address               text,
  user_agent               text,
  active_organization_id   text,
  impersonated_by          text,
  created_at               timestamptz NOT NULL DEFAULT NOW(),
  updated_at               timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS session_token_idx ON auth.session (token);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON auth.session (user_id);
CREATE INDEX IF NOT EXISTS session_expires_at_idx ON auth.session (expires_at);

-- ─── account ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.account (
  id                            text PRIMARY KEY,
  user_id                       text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  provider_id                   text NOT NULL,
  account_id                    text NOT NULL,
  password                      text,
  access_token                  text,
  refresh_token                 text,
  id_token                      text,
  access_token_expires_at       timestamptz,
  refresh_token_expires_at      timestamptz,
  scope                         text,
  created_at                    timestamptz NOT NULL DEFAULT NOW(),
  updated_at                    timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, account_id)
);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON auth.account (user_id);

-- ─── verification ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.verification (
  id          text PRIMARY KEY,
  identifier  text NOT NULL,
  value       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON auth.verification (identifier);
CREATE INDEX IF NOT EXISTS verification_expires_at_idx ON auth.verification (expires_at);

-- ─── organization ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.organization (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  slug        text UNIQUE,
  logo        text,
  metadata    text,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- ─── member ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.member (
  id              text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
  user_id         text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member',
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- ─── invitation ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.invitation (
  id              text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'member',
  status          text NOT NULL DEFAULT 'pending',
  inviter_id      text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  expires_at      timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS invitation_email_idx ON auth.invitation (email);
CREATE INDEX IF NOT EXISTS invitation_org_idx   ON auth.invitation (organization_id);

-- ─── team ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.team (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  organization_id text NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz
);

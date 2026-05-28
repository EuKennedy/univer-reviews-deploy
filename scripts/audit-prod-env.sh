#!/usr/bin/env bash
# UniverReviews — production env audit
#
# Verifies that the deploy is configured for multi-tenant SaaS (every
# new Google/email signup creates its own workspace). The lethal failure
# mode is AUTOPROVISION_WORKSPACE_ID being set on the admin/dash deploy —
# that flag funnels every signup into a SINGLE workspace (the original
# lizzon-pilot path) as a low-privilege viewer.
#
# Run via Coolify SSH session or any host that can reach the admin
# container with kubectl/docker exec. Print results, exit non-zero on
# critical findings so the script can be wired to a deploy gate.
#
# Usage: bash scripts/audit-prod-env.sh
set -uo pipefail

FAILURES=0

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$*"; FAILURES=$((FAILURES+1)); }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; FAILURES=$((FAILURES+1)); }

bold "UniverReviews production env audit"
echo "──────────────────────────────────────────"

# 1. AUTOPROVISION_WORKSPACE_ID must be UNSET for public SaaS signup.
bold "1. Multi-tenant signup contract"
if [ -n "${AUTOPROVISION_WORKSPACE_ID:-}" ]; then
  fail "AUTOPROVISION_WORKSPACE_ID is SET (=${AUTOPROVISION_WORKSPACE_ID}). Every signup funnels into that workspace as ${AUTOPROVISION_ROLE:-viewer}. UNSET in Coolify env for the admin/dash container before opening public signup."
else
  ok "AUTOPROVISION_WORKSPACE_ID unset (new signups create own workspace)."
fi

# 2. Required secrets — must exist + look strong.
bold "2. Required secrets"
check_secret() {
  local name="$1"; local min_len="$2"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    fail "$name is empty/unset"
  elif [ "${#val}" -lt "$min_len" ]; then
    fail "$name is only ${#val} chars (need >= ${min_len})"
  else
    ok "$name set (${#val} chars)"
  fi
}
check_secret BETTER_AUTH_SECRET 32
check_secret SECRET_KEY_BASE   48
check_secret ANTHROPIC_API_KEY 20
check_secret RESEND_API_KEY    20
check_secret STRIPE_WEBHOOK_SECRET 20
check_secret FEEDSPACE_WEBHOOK_SECRET 20

# 3. Resend / Stripe / Google OAuth must be reachable in prod mode.
bold "3. OAuth providers"
if [ -n "${GOOGLE_CLIENT_ID:-}" ] && [ -n "${GOOGLE_CLIENT_SECRET:-}" ]; then
  ok "Google OAuth enabled"
else
  warn "Google OAuth disabled (no GOOGLE_CLIENT_ID/_SECRET)"
fi

# 4. Cross-subdomain cookie domain.
bold "4. Cookie domain"
case "${COOKIE_DOMAIN:-}" in
  .univerreviews.com) ok "COOKIE_DOMAIN=.univerreviews.com" ;;
  "")  warn "COOKIE_DOMAIN unset — Better Auth will fall back to .univerreviews.com default" ;;
  *)   warn "COOKIE_DOMAIN=${COOKIE_DOMAIN} (expected .univerreviews.com)" ;;
esac

# 5. Database BYPASSRLS — needed so Better Auth's databaseHook can
#    UPDATE workspace_users across tenants when linking an existing
#    pre-provisioned row to a new Better Auth user id.
bold "5. Database role"
if [ -n "${DATABASE_URL:-}" ]; then
  ok "DATABASE_URL set"
  # Best-effort: probe BYPASSRLS via psql if available.
  if command -v psql >/dev/null 2>&1; then
    bypass=$(psql "$DATABASE_URL" -tAc "SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user;" 2>/dev/null || echo "?")
    if [ "$bypass" = "t" ]; then
      ok "DB role has BYPASSRLS (auth hook can link cross-tenant)"
    elif [ "$bypass" = "f" ]; then
      warn "DB role lacks BYPASSRLS — backfilled signups won't be linked to existing workspace_user rows."
    else
      warn "Could not probe BYPASSRLS (psql exit code != 0)"
    fi
  fi
else
  fail "DATABASE_URL unset"
fi

# 6. ANTHROPIC API key must NOT be the placeholder.
bold "6. AI keys"
if [ "${ANTHROPIC_API_KEY:-}" = "SET_ME_LATER" ] || [ "${ANTHROPIC_API_KEY:-}" = "test" ]; then
  fail "ANTHROPIC_API_KEY is placeholder — AI features will 503 on generate-summary-topics."
else
  ok "ANTHROPIC_API_KEY looks real"
fi

echo "──────────────────────────────────────────"
if [ "$FAILURES" -eq 0 ]; then
  bold "ALL CHECKS PASSED — production env safe to open signup."
  exit 0
else
  bold "FAIL — ${FAILURES} check(s) need attention before public signup."
  exit 1
fi

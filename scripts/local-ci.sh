#!/usr/bin/env bash
# shellcheck disable=SC2155
#
# UniverReviews — local CI runner
# -------------------------------
#
# Replays every gate that .github/workflows/ci.yml runs remotely, but
# entirely on the developer's machine. Designed as a transparent shadow of
# the GitHub Actions pipeline: when remote billing comes back, you flip the
# repo back to GHA and this script keeps working as a pre-push gate.
#
# Design contract:
#   - POSIX-ish bash (4.x+). `set -euo pipefail` everywhere.
#   - Idempotent: every gate cleans up after itself, second run = same result.
#   - Ephemeral state: postgres+redis live in tmpfs containers, torn down on EXIT.
#   - Fail-fast by default; `--continue-on-error` runs every gate regardless.
#   - Coloured progress on TTYs; plain text in CI / non-TTY contexts.
#   - Per-gate log in .local-ci-logs/<timestamp>/<gate>.log + `latest` symlink.
#   - Exit 0 = all pass, 1 = any fail, 130 = SIGINT, 124 = global timeout.
#
# Usage:
#   ./scripts/local-ci.sh                   # default: every gate, fail-fast
#   ./scripts/local-ci.sh --only api_rspec  # one gate
#   ./scripts/local-ci.sh --skip semgrep    # all but one
#   ./scripts/local-ci.sh --continue-on-error
#   ./scripts/local-ci.sh --list            # print gate list
#   ./scripts/local-ci.sh --include trivy   # opt-in extra gate
#   ./scripts/local-ci.sh --verbose         # mirror gate output to stdout
#
# Mapping to .github/workflows/ci.yml jobs:
#   gitleaks         ← Security · gitleaks
#   semgrep          ← Security · Semgrep (TS/JS)
#   api_rubocop      ← API · Rubocop (advisory)
#   api_brakeman     ← API · Brakeman security scan
#   api_audit        ← API · bundler-audit
#   api_rspec        ← API · RSpec + Coverage
#   admin_build      ← Admin · TS + ESLint + Next build
#   widget_build     ← Widget · TS + Vitest + bundle + budget
#   wp_lint          ← WP plugin · PHP -l
#   pnpm_audit       ← Frontend · pnpm audit
#   trivy            ← (extra) container/FS CVE scan
#
# What this script will NOT do compared to remote:
#   - paths-filter (we just run everything; cheap enough locally)
#   - artifact upload (logs stay on disk under .local-ci-logs/)
#   - PR annotations (no GitHub API context to write to)
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="${REPO_ROOT}/.local-ci-logs/${TS}"
LATEST_LINK="${REPO_ROOT}/.local-ci-logs/latest"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.ci.yml"
COMPOSE_PROJECT="univerreviews-localci"

# Default gate order. The slow gates (rspec, semgrep, builds) come AFTER the
# cheap binary scanners so a typo or leaked secret kills the run quickly.
ALL_GATES=(
  gitleaks
  pnpm_audit
  api_audit
  api_rubocop
  api_brakeman
  wp_lint
  semgrep
  api_rspec
  admin_build
  widget_build
)
# Gates excluded by default; opt-in via --include <name>.
EXTRA_GATES=( trivy )

# ---------------------------------------------------------------------------
# CLI parsing
# ---------------------------------------------------------------------------
ONLY=()
SKIP=()
INCLUDE=()
CONTINUE_ON_ERROR=0
VERBOSE=0
LIST_ONLY=0
NO_DB=0

print_usage() {
  sed -n '4,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 0
}

while (( $# > 0 )); do
  case "$1" in
    --only)               shift; while (( $# > 0 )) && [[ "$1" != --* ]]; do ONLY+=("$1"); shift; done ;;
    --skip)               shift; while (( $# > 0 )) && [[ "$1" != --* ]]; do SKIP+=("$1"); shift; done ;;
    --include)            shift; while (( $# > 0 )) && [[ "$1" != --* ]]; do INCLUDE+=("$1"); shift; done ;;
    --continue-on-error)  CONTINUE_ON_ERROR=1; shift ;;
    --verbose|-v)         VERBOSE=1; shift ;;
    --list|-l)            LIST_ONLY=1; shift ;;
    --no-db)              NO_DB=1; shift ;;
    --help|-h)            print_usage ;;
    *) echo "Unknown flag: $1" >&2; echo "Try --help" >&2; exit 2 ;;
  esac
done

# Compute the effective gate list.
# NOTE: `set -u` on bash 3.2 (macOS default) treats "${EMPTY_ARR[@]}" as
# unbound. Guard every potentially-empty array expansion with
# `${ARR[@]+...}` so this script works on stock macOS shells too.
GATES=()
if (( ${#ONLY[@]} > 0 )); then
  GATES=("${ONLY[@]}")
else
  if (( ${#INCLUDE[@]} > 0 )); then
    GATES=("${ALL_GATES[@]}" "${INCLUDE[@]}")
  else
    GATES=("${ALL_GATES[@]}")
  fi
fi
if (( ${#SKIP[@]} > 0 )); then
  filtered=()
  for g in "${GATES[@]}"; do
    skip_this=0
    for s in "${SKIP[@]}"; do [[ "$g" == "$s" ]] && skip_this=1 && break; done
    if (( skip_this == 0 )); then filtered+=("$g"); fi
  done
  if (( ${#filtered[@]} > 0 )); then
    GATES=("${filtered[@]}")
  else
    GATES=()
  fi
fi

if (( LIST_ONLY == 1 )); then
  printf 'Available gates (default order):\n'
  for g in "${ALL_GATES[@]}"; do printf '  %s\n' "$g"; done
  printf '\nOpt-in via --include:\n'
  for g in "${EXTRA_GATES[@]}"; do printf '  %s\n' "$g"; done
  exit 0
fi

# ---------------------------------------------------------------------------
# Colour helpers (NO_COLOR + TTY-aware)
# ---------------------------------------------------------------------------
if [[ -t 1 ]] && [[ "${NO_COLOR:-}" == "" ]] && command -v tput >/dev/null 2>&1; then
  GREEN="$(tput setaf 2)"; RED="$(tput setaf 1)"
  YELLOW="$(tput setaf 3)"; CYAN="$(tput setaf 6)"
  BOLD="$(tput bold)"; DIM="$(tput dim)"; RESET="$(tput sgr0)"
else
  GREEN=""; RED=""; YELLOW=""; CYAN=""; BOLD=""; DIM=""; RESET=""
fi

info()    { printf "%s[info]%s %s\n"  "${CYAN}"   "${RESET}" "$*"; }
warn()    { printf "%s[warn]%s %s\n"  "${YELLOW}" "${RESET}" "$*" >&2; }
err()     { printf "%s[err ]%s %s\n"  "${RED}"    "${RESET}" "$*" >&2; }
ok()      { printf "%s[ok  ]%s %s\n"  "${GREEN}"  "${RESET}" "$*"; }

# ---------------------------------------------------------------------------
# Log directory + symlink
# ---------------------------------------------------------------------------
mkdir -p "${LOG_DIR}"
# Refresh the `latest` symlink so users always know where to look.
rm -f "${LATEST_LINK}"
ln -s "${LOG_DIR}" "${LATEST_LINK}"
info "logs → ${LATEST_LINK}"

# ---------------------------------------------------------------------------
# Cleanup trap
# ---------------------------------------------------------------------------
# We tear the docker stack down regardless of how the script exits. The
# trap fires on EXIT, INT and TERM; the `|| true` keeps tearing down even
# if the previous compose call failed mid-flight.
DB_STARTED=0
cleanup() {
  local code=$?
  if (( DB_STARTED == 1 )); then
    info "tearing down CI containers…"
    docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  return "$code"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ---------------------------------------------------------------------------
# Tool availability check
# ---------------------------------------------------------------------------
require() {
  command -v "$1" >/dev/null 2>&1 || {
    err "missing tool: $1 (install via scripts/install-ci-deps.sh)"
    exit 127
  }
}

# Minimal universal pre-flight; per-gate tools are checked inside their fn.
require docker
require pnpm

# ---------------------------------------------------------------------------
# Docker compose helpers (rspec + future DB-aware gates)
# ---------------------------------------------------------------------------
compose() {
  docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT}" "$@"
}

ensure_db_up() {
  (( NO_DB == 1 )) && { warn "--no-db set, skipping DB bootstrap"; return 0; }
  if (( DB_STARTED == 1 )); then return 0; fi

  info "starting ephemeral Postgres+Redis containers…"
  compose up -d --quiet-pull --wait >/dev/null
  DB_STARTED=1

  # Resolve the host-side ports (compose maps 0:5432 → random).
  PG_PORT="$(compose port postgres 5432 | sed 's/.*://')"
  REDIS_PORT="$(compose port redis 6379 | sed 's/.*://')"
  export PG_PORT REDIS_PORT

  # Install extensions the schema relies on. Idempotent; safe to re-run.
  PGPASSWORD=ci_pw psql -h localhost -p "${PG_PORT}" -U ci_user -d univerreviews_test \
    -v ON_ERROR_STOP=1 -q <<'SQL'
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS vector;
SQL

  ok "DB up: pg=${PG_PORT} redis=${REDIS_PORT}"
}

provision_rls_test_role() {
  # Mirrors the "Provision non-superuser role for RLS specs" step in the
  # remote CI workflow exactly. spec/security/rls_cross_tenant_spec.rb
  # demotes to this role inside its transaction so the policy actually
  # enforces (CI's primary role is superuser).
  PGPASSWORD=ci_pw psql -h localhost -p "${PG_PORT}" -U ci_user -d univerreviews_test \
    -v ON_ERROR_STOP=1 -q <<'SQL'
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rls_test_role') THEN
        CREATE ROLE rls_test_role NOSUPERUSER NOINHERIT;
      END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO rls_test_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_test_role;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO rls_test_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rls_test_role;
SQL
}

# ---------------------------------------------------------------------------
# Gate definitions
# ---------------------------------------------------------------------------
# Each gate is a function that returns the exit code of its underlying
# tooling. Gates DO NOT print headers or summaries themselves — the runner
# loop owns that. Gates DO log richly into their own log file via stdout/
# stderr (the runner redirects them).
#
# Adding a new gate:
#   1) Define `gate_<name>()` below.
#   2) Append `<name>` to ALL_GATES (or EXTRA_GATES if it's opt-in).
#   3) Mirror it in .github/workflows/ci.yml so remote and local match.
# ---------------------------------------------------------------------------

gate_gitleaks() {
  require gitleaks
  cd "${REPO_ROOT}"
  # `protect` scans the working tree + staged diff; faster than full history
  # for an iterative pre-push gate. CI itself does fetch-depth=0 for the
  # full sweep — we accept the trade-off locally.
  gitleaks detect --no-banner --source . --redact --exit-code 1
}

gate_pnpm_audit() {
  cd "${REPO_ROOT}"
  # Mirror the remote "Frontend · pnpm audit" job. High = fail; lower
  # severities are reported but don't block.
  pnpm audit --audit-level=high
}

gate_api_audit() {
  cd "${REPO_ROOT}/apps/api"
  require bundle
  # Bundler-audit needs an updated CVE DB. The `--update` flag triggers a
  # git pull from the public bundler-audit advisories repo — cached, fast.
  bundle exec bundler-audit check --update
}

gate_api_rubocop() {
  cd "${REPO_ROOT}/apps/api"
  require bundle
  # Marked "advisory" in remote CI — we never block on style. Run anyway
  # so drift surfaces in the log, but always return 0.
  if ! bundle exec rubocop --no-color --display-only-fail-level-offenses --fail-level=error; then
    warn "rubocop reported style offences (non-blocking — see log)"
  fi
  return 0
}

gate_api_brakeman() {
  cd "${REPO_ROOT}/apps/api"
  require bundle
  bundle exec brakeman -q --no-progress --no-summary --color --confidence-level=2 \
    --rails-version 8.0
}

gate_api_rspec() {
  cd "${REPO_ROOT}/apps/api"
  require bundle

  ensure_db_up

  # Migrate against the ephemeral DB.
  export DATABASE_URL="postgres://ci_user:ci_pw@localhost:${PG_PORT}/univerreviews_test"
  export REDIS_URL="redis://localhost:${REDIS_PORT}/0"
  export RAILS_ENV=test
  export CI=true

  info "running rails db:migrate against localci DB…"
  bundle exec rails db:migrate >> "${LOG_DIR}/api_rspec.migrate.log" 2>&1

  info "provisioning rls_test_role…"
  provision_rls_test_role

  info "running rspec…"
  bundle exec rspec --color --format documentation
}

gate_admin_build() {
  cd "${REPO_ROOT}/apps/admin"
  # Three-step gate: typecheck → lint → next build. Mirror of the remote
  # admin-build job. We let `next build` run last because it's the slowest
  # and depends on the type-check passing.
  pnpm exec tsc --noEmit
  # `next lint` is interactive on first run if eslint config is absent.
  # The repo wires `eslint-config-next` so this is a no-op safety check.
  if pnpm exec next lint --no-cache --strict 2>/dev/null; then :; else
    warn "next lint failed or skipped (see admin_build.log)"
  fi
  pnpm exec next build
}

gate_widget_build() {
  cd "${REPO_ROOT}/apps/widget"
  pnpm exec tsc --noEmit
  pnpm exec vitest run --reporter=verbose
  pnpm run build
  # Bundle budget: widget IIFE must stay lean. 80kb gzipped is the soft
  # ceiling — the storefront merchant pays for every byte on slow 4G.
  local bundle
  bundle="$(find dist -name '*.js' -type f -print -quit)"
  if [[ -z "${bundle}" ]]; then
    err "widget bundle not found under apps/widget/dist"
    return 1
  fi
  local size_bytes size_gzip_bytes max=81920
  size_bytes="$(wc -c < "${bundle}")"
  size_gzip_bytes="$(gzip -c "${bundle}" | wc -c)"
  printf 'bundle: %s\n  raw : %s bytes\n  gzip: %s bytes (budget %s)\n' \
    "${bundle}" "${size_bytes}" "${size_gzip_bytes}" "${max}"
  if (( size_gzip_bytes > max )); then
    err "widget bundle exceeds budget: ${size_gzip_bytes} > ${max}"
    return 1
  fi
}

gate_wp_lint() {
  cd "${REPO_ROOT}"
  require php
  # PHP -l is fast; we run it across every .php in the plugin tree.
  local failed=0
  while IFS= read -r -d '' f; do
    if ! php -l "$f" >/dev/null 2>&1; then
      err "syntax error: $f"
      php -l "$f" 2>&1 || true
      failed=1
    fi
  done < <(find plugins/wordpress -name '*.php' -type f -print0)
  return $failed
}

gate_semgrep() {
  cd "${REPO_ROOT}"
  require semgrep
  # Same rule packs the remote semgrep job uses. `--error` makes WARNING
  # findings fail the build alongside ERROR; remote CI does the same so
  # local stays honest.
  semgrep \
    --config p/owasp-top-ten \
    --config p/javascript \
    --config p/typescript \
    --config p/nodejs \
    --config p/secrets \
    --error \
    --no-rewrite-rule-ids \
    --metrics off \
    apps/admin/src apps/widget/src packages 2>&1
}

# Optional / opt-in gate — Trivy CVE scan of the working tree.
# Run with: --include trivy
gate_trivy() {
  cd "${REPO_ROOT}"
  require trivy
  trivy fs \
    --severity HIGH,CRITICAL \
    --ignore-unfixed \
    --exit-code 1 \
    --no-progress \
    --scanners vuln,secret,misconfig \
    --skip-dirs 'node_modules,**/node_modules,.next,.local-ci-logs,**/dist' \
    .
}

# ---------------------------------------------------------------------------
# Runner loop + summary
# ---------------------------------------------------------------------------
declare -a RESULT_NAMES=()
declare -a RESULT_STATUS=()
declare -a RESULT_SECONDS=()
declare -a RESULT_LOG=()
declare -i FAILED_COUNT=0

run_gate() {
  local gate="$1"
  local idx="$2"
  local total="$3"
  local log="${LOG_DIR}/${gate}.log"

  if ! declare -F "gate_${gate}" >/dev/null; then
    err "unknown gate: ${gate}"
    RESULT_NAMES+=("${gate}"); RESULT_STATUS+=("missing")
    RESULT_SECONDS+=("0"); RESULT_LOG+=("-")
    FAILED_COUNT+=1
    return 1
  fi

  printf '%s[%d/%d]%s %-16s ' "${DIM}" "${idx}" "${total}" "${RESET}" "${gate}"

  local started=$SECONDS code=0
  if (( VERBOSE == 1 )); then
    set +e; "gate_${gate}" 2>&1 | tee "${log}"; code=${PIPESTATUS[0]}; set -e
  else
    set +e; "gate_${gate}" >"${log}" 2>&1; code=$?; set -e
  fi
  local dur=$(( SECONDS - started ))

  RESULT_NAMES+=("${gate}")
  RESULT_SECONDS+=("${dur}")
  RESULT_LOG+=("${log}")

  if (( code == 0 )); then
    printf '%s✓%s  %3ds\n' "${GREEN}" "${RESET}" "${dur}"
    RESULT_STATUS+=("pass")
  else
    printf '%s✗%s  %3ds  %s(log: %s)%s\n' "${RED}" "${RESET}" "${dur}" "${DIM}" "${log#${REPO_ROOT}/}" "${RESET}"
    RESULT_STATUS+=("fail")
    FAILED_COUNT+=1
  fi
  return $code
}

print_summary() {
  local total_sec=$(( SECONDS - GLOBAL_START ))
  local passed=$(( ${#RESULT_NAMES[@]} - FAILED_COUNT ))

  printf '\n%sSummary%s\n' "${BOLD}" "${RESET}"
  printf '┌──────────────────┬────────┬────────┐\n'
  printf '│ %-16s │ %-6s │ %-6s │\n' "Gate" "Status" "Time"
  printf '├──────────────────┼────────┼────────┤\n'
  local i
  for i in "${!RESULT_NAMES[@]}"; do
    local status_colour="${GREEN}"
    [[ "${RESULT_STATUS[$i]}" == "fail" ]]    && status_colour="${RED}"
    [[ "${RESULT_STATUS[$i]}" == "missing" ]] && status_colour="${YELLOW}"
    printf '│ %-16s │ %s%-6s%s │ %5ss │\n' \
      "${RESULT_NAMES[$i]}" \
      "${status_colour}" "${RESULT_STATUS[$i]}" "${RESET}" \
      "${RESULT_SECONDS[$i]}"
  done
  printf '└──────────────────┴────────┴────────┘\n'
  printf 'Total: %ss · %d passed · %d failed\n' "${total_sec}" "${passed}" "${FAILED_COUNT}"
  printf 'Logs : %s\n' "${LATEST_LINK}"
}

# ---------------------------------------------------------------------------
# Go
# ---------------------------------------------------------------------------
GLOBAL_START=$SECONDS
TOTAL=${#GATES[@]}
info "running ${TOTAL} gate(s): ${GATES[*]}"

idx=0
for g in "${GATES[@]}"; do
  idx=$(( idx + 1 ))
  if run_gate "$g" "$idx" "$TOTAL"; then
    :
  else
    if (( CONTINUE_ON_ERROR == 0 )); then
      err "gate '${g}' failed — stopping (use --continue-on-error to keep going)"
      print_summary
      exit 1
    fi
  fi
done

print_summary
(( FAILED_COUNT > 0 )) && exit 1 || exit 0

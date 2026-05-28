# Local CI

`scripts/local-ci.sh` reproduces every gate that `.github/workflows/ci.yml`
runs remotely, but entirely on your machine. We use it while remote CI
billing is paused, and as a pre-push gate even when remote is healthy.

When the GitHub plan is reactivated the workflow file is untouched —
flip nothing, just push and the remote pipeline picks up.

---

## Pre-requisites

Install the tooling once:

```bash
./scripts/install-ci-deps.sh
```

The script is idempotent — re-running it is a no-op once tools are
present. It detects macOS (Homebrew) and Debian/Ubuntu (apt) and exits
loudly if the host is something else.

You also need:

- Docker + Docker Compose v2 (the runner spins up ephemeral Postgres and Redis)
- `pnpm@9` (Corepack does it: `corepack enable && corepack prepare pnpm@9 --activate`)
- Ruby 3.3 + bundler (the API app)
- Node 20+

---

## Run it

Full sweep (default — every gate, fail-fast):

```bash
./scripts/local-ci.sh
```

One gate:

```bash
./scripts/local-ci.sh --only api_rspec
./scripts/local-ci.sh --only admin_build widget_build
```

Skip a gate:

```bash
./scripts/local-ci.sh --skip semgrep
```

Opt into the Trivy CVE scan (off by default — it's slow):

```bash
./scripts/local-ci.sh --include trivy
```

Keep going after a failure (see every gate's result in one pass):

```bash
./scripts/local-ci.sh --continue-on-error
```

Mirror gate output to stdout instead of just the log file:

```bash
./scripts/local-ci.sh --verbose
```

List every available gate:

```bash
./scripts/local-ci.sh --list
```

Skip the DB-bootstrap altogether (when you know your DB is already up
and you just want spec to point at it):

```bash
DATABASE_URL=... REDIS_URL=... ./scripts/local-ci.sh --only api_rspec --no-db
```

---

## What each gate covers

| Local gate | Mirrors remote job | What it actually does |
|---|---|---|
| `gitleaks` | Security · gitleaks | Scans working tree for accidentally-committed secrets (.env-style keys, AWS, Stripe, etc). |
| `pnpm_audit` | Frontend · pnpm audit | Fails on a `high` CVE in any frontend dependency. |
| `api_audit` | API · bundler-audit | Refreshes the bundler-audit CVE DB and scans `apps/api/Gemfile.lock`. |
| `api_rubocop` | API · Rubocop (advisory) | Style scan. Non-blocking — logs offences but always exits 0. |
| `api_brakeman` | API · Brakeman security scan | SAST for Rails. Flags injection, SSRF, mass assignment, etc. |
| `wp_lint` | WP plugin · PHP -l | Parses every `.php` in `plugins/wordpress/` with `php -l`. |
| `semgrep` | Security · Semgrep (TS/JS) | Same rule packs the remote uses: owasp-top-ten + js + ts + nodejs + secrets. |
| `api_rspec` | API · RSpec + Coverage | Boots ephemeral Postgres + Redis, runs migrations, provisions `rls_test_role` (NOSUPERUSER for the RLS cross-tenant spec), runs the full RSpec suite with SimpleCov gating. |
| `admin_build` | Admin · TS + ESLint + Next build | `tsc --noEmit` → `next lint` → `next build`. |
| `widget_build` | Widget · TS + Vitest + bundle + budget | `tsc --noEmit` → Vitest run → Rollup build → gzip size budget (80 KB). |
| `trivy` *(opt-in)* | — | Filesystem CVE scan, severity HIGH/CRITICAL fails. |

---

## Layout

```
.
├── scripts/
│   ├── local-ci.sh           ← runner
│   └── install-ci-deps.sh    ← host bootstrap
├── docker-compose.ci.yml     ← ephemeral pg + redis
├── .semgrepignore            ← scan exclusions
└── .local-ci-logs/
    ├── 20260528-181337/      ← timestamped per run
    │   ├── api_rspec.log
    │   ├── semgrep.log
    │   └── …
    └── latest                ← symlink to most recent run
```

`.local-ci-logs/` is gitignored. Logs accumulate forever — clean with
`rm -rf .local-ci-logs/` whenever it bothers you.

---

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Every gate passed. |
| 1 | At least one gate failed. |
| 127 | A required CLI tool is missing — re-run `scripts/install-ci-deps.sh`. |
| 130 | SIGINT (Ctrl-C); cleanup ran, DB containers torn down. |

---

## Differences vs the remote GitHub Actions pipeline

These are intentional. They keep the local runner fast and developer-
friendly without sacrificing the real signal:

- **No path filtering.** Remote uses `dorny/paths-filter` to skip jobs
  when their area isn't touched. Locally we just run everything — cheap
  enough on a dev machine, and "did I forget to invalidate a shared
  package" is exactly the class of bug filtering hides.
- **No artifact upload.** Remote uploads `coverage/` and bundle reports.
  Locally everything lives under `.local-ci-logs/`.
- **No PR annotations.** Obviously — there's no PR.
- **gitleaks `detect`, not full-history.** Remote does
  `fetch-depth: 0` so gitleaks can walk every commit. Locally we scan
  the working tree + staged diff. Run `gitleaks detect --log-opts="--all"`
  manually before you re-enable remote if you want full coverage.
- **Single-machine concurrency.** Remote runs jobs in parallel across
  multiple GHA runners. Locally we run serial. A clean full run is
  ~10-15 min depending on the API spec count.
- **Cache.** `pnpm` and Turbo caches are reused from your dev workspace
  (no `--no-cache`). If you need a hermetic re-run, blow them away:
  `pnpm store prune && rm -rf .turbo apps/*/.turbo apps/*/.next`.

---

## When remote billing comes back

Nothing to flip. The workflow file (`.github/workflows/ci.yml`) is
unchanged by any of this; remote will pick up where it left off on the
next push. Keep using `local-ci.sh` as the pre-push gate.

To verify the local-and-remote sets stay aligned, treat the gate table
in this doc as the contract. Adding a job in `ci.yml`? Add the matching
function in `scripts/local-ci.sh` and update the table here.

---

## Validation checklist (run after first install)

Confirm each gate fires correctly:

```bash
# 1. Tooling present
./scripts/local-ci.sh --list
# expect: 10 gates listed (default order) + trivy (opt-in)

# 2. Cheap gates only — full sweep takes ~5 min and exercises every binary tool
./scripts/local-ci.sh --only gitleaks pnpm_audit wp_lint
# expect: 3 ✓ pass, total ~30s

# 3. Spec gate — boots the ephemeral DB, runs migrations, full RSpec
./scripts/local-ci.sh --only api_rspec --verbose
# expect: pg containers spin up, migrations run, rspec output streams,
#         containers torn down on exit, no leftover containers in `docker ps -a`

# 4. Frontend build gates — slowest
./scripts/local-ci.sh --only admin_build widget_build
# expect: next build artifacts in apps/admin/.next; widget bundle size
#         logged + within 80 KB gzip budget

# 5. Full default sweep (everything except trivy)
./scripts/local-ci.sh
# expect: all 10 default gates ✓, summary table at the end, exit 0
```

If any of these surprise you, open the log file printed beside the failing
gate and diff against the remote run on the same commit.

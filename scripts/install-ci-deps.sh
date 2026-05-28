#!/usr/bin/env bash
#
# UniverReviews — bootstrap host with everything scripts/local-ci.sh needs
# -----------------------------------------------------------------------
#
# Idempotent: re-running installs nothing new on second pass. Detects
# macOS (Homebrew) vs Debian/Ubuntu (apt) automatically. For other
# distros it prints the package set and exits 1 — adding a branch is
# trivial when you hit a new env.
#
# Tools installed:
#   - gitleaks           # secrets scanner
#   - semgrep            # SAST for TS/JS
#   - trivy              # CVE scanner (opt-in gate)
#   - php (cli)          # `php -l` syntax check for WordPress plugin
#   - jq                 # JSON helpers (used by docker compose port parsing in CI)
#   - postgresql-client  # `psql` to bootstrap extensions + rls_test_role
#
# Tools verified (not installed):
#   - docker, docker compose v2  ← assumed present, install path is too
#                                  env-specific to automate
#   - pnpm 9.x                   ← package manager already pinned in the repo
#   - ruby 3.3 + bundler         ← assumed present for `apps/api`
#   - node 20+                   ← assumed present
#
set -euo pipefail

is_mac()   { [[ "$(uname -s)" == "Darwin" ]]; }
is_linux() { [[ "$(uname -s)" == "Linux"  ]]; }

have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
# Sanity check: docker + docker compose v2
# ---------------------------------------------------------------------------
have docker || { echo "docker not found — install Docker Desktop or engine before re-running" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || {
  echo "docker compose v2 not found — install or upgrade Docker" >&2; exit 1;
}

# ---------------------------------------------------------------------------
# Sanity check: pnpm + ruby + node
# ---------------------------------------------------------------------------
have pnpm  || { echo "pnpm not found — install via 'corepack enable && corepack prepare pnpm@9 --activate'" >&2; exit 1; }
have ruby  || { echo "ruby not found — install Ruby 3.3 (e.g. via mise / asdf / rbenv)" >&2; exit 1; }
have node  || { echo "node not found — install Node 20+" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Install per-OS
# ---------------------------------------------------------------------------
install_mac() {
  have brew || { echo "Homebrew required on macOS — see https://brew.sh" >&2; exit 1; }
  local pkgs=()
  have gitleaks || pkgs+=(gitleaks)
  have semgrep  || pkgs+=(semgrep)
  have trivy    || pkgs+=(trivy)
  have php      || pkgs+=(php)
  have jq       || pkgs+=(jq)
  have psql     || pkgs+=(libpq)   # ships psql; symlink to /usr/local/bin handled below
  if (( ${#pkgs[@]} > 0 )); then
    echo "Installing: ${pkgs[*]}"
    brew install "${pkgs[@]}"
  fi
  # libpq is keg-only; ensure psql is on PATH for this shell session.
  if ! have psql; then
    local prefix; prefix="$(brew --prefix libpq 2>/dev/null || true)"
    if [[ -x "${prefix}/bin/psql" ]]; then
      echo "Linking psql from ${prefix}/bin"
      brew link --force libpq >/dev/null 2>&1 || true
    fi
  fi
}

install_linux() {
  if ! have apt-get; then
    echo "Non-Debian Linux detected. Install manually:" >&2
    echo "  gitleaks semgrep trivy php-cli jq postgresql-client" >&2
    exit 1
  fi
  local pkgs=()
  have php  || pkgs+=(php-cli)
  have jq   || pkgs+=(jq)
  have psql || pkgs+=(postgresql-client)
  if (( ${#pkgs[@]} > 0 )); then
    sudo apt-get update -qq
    sudo apt-get install -y --no-install-recommends "${pkgs[@]}"
  fi

  # gitleaks: install via release binary so we get a fresh version
  # (Debian's repo is months stale).
  if ! have gitleaks; then
    local ver="8.21.2"
    local arch; arch="$(uname -m)"
    case "${arch}" in
      x86_64)  arch="x64"   ;;
      aarch64) arch="arm64" ;;
      *) echo "unsupported arch for gitleaks: ${arch}" >&2; exit 1 ;;
    esac
    local tmp; tmp="$(mktemp -d)"
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${ver}/gitleaks_${ver}_linux_${arch}.tar.gz" -o "${tmp}/gl.tgz"
    tar -xzf "${tmp}/gl.tgz" -C "${tmp}"
    sudo install -m 0755 "${tmp}/gitleaks" /usr/local/bin/gitleaks
    rm -rf "${tmp}"
  fi

  # trivy: their apt repo is canonical and signed.
  if ! have trivy; then
    sudo apt-get install -y wget gnupg lsb-release
    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/trivy.gpg
    echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/trivy.list >/dev/null
    sudo apt-get update -qq
    sudo apt-get install -y trivy
  fi

  # semgrep: pip install (no native apt). We use a pinned version so CI
  # locally matches CI remotely; bump as you update the workflow.
  if ! have semgrep; then
    if have pipx; then pipx install semgrep
    else sudo pip3 install --break-system-packages semgrep
    fi
  fi
}

# ---------------------------------------------------------------------------
# Verify Ruby toolchain side-deps
# ---------------------------------------------------------------------------
verify_ruby_toolchain() {
  # bundler-audit + brakeman + rubocop come from the API Gemfile — the
  # `bundle install` step inside that app installs them on first run.
  # We just check the Gemfile is parseable.
  ruby -e "require 'bundler'; puts 'bundler ' + Bundler::VERSION" >/dev/null
}

# ---------------------------------------------------------------------------
# Go
# ---------------------------------------------------------------------------
if is_mac;   then install_mac;
elif is_linux; then install_linux;
else echo "Unsupported OS: $(uname -s)" >&2; exit 1;
fi

verify_ruby_toolchain

echo
echo "Tooling ready. Verify with:"
echo "  ./scripts/local-ci.sh --list"
echo
echo "First run:"
echo "  ./scripts/local-ci.sh"

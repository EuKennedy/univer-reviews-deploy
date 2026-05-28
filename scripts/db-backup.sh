#!/usr/bin/env bash
# UniverReviews — encrypted Postgres backup with offsite upload.
#
# Designed for Coolify cron (recommended cadence: every 6h). Writes
# pg_dump + gzip to /backups, optionally uploads to S3-compatible
# storage, and prunes local copies older than 30 days.
#
# Required env:
#   DATABASE_URL       Postgres connection string (read access)
#   BACKUP_DIR         Where local dumps live (default /backups)
#
# Optional env (offsite upload):
#   BACKUP_S3_BUCKET   S3 bucket name
#   BACKUP_S3_PREFIX   Prefix inside the bucket (e.g. "univerreviews/prod")
#   AWS_ACCESS_KEY_ID  / AWS_SECRET_ACCESS_KEY / AWS_REGION / AWS_S3_ENDPOINT
#
# Optional env (encryption):
#   BACKUP_GPG_RECIPIENT  When set, dumps are gpg-encrypted with this key
#                          before upload. Strongly recommended for prod.
#
# Exit codes:
#   0   success
#   1   missing required env
#   2   pg_dump failed
#   3   upload failed
#
# Crontab line (Coolify scheduled command):
#   0 */6 * * *  /app/scripts/db-backup.sh

set -uo pipefail

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
log()   { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
fail()  { printf '[\033[31mFAIL\033[0m] %s\n' "$*" >&2; exit "$2"; }

bold "UniverReviews — backup run"
log "Starting at $(date -u --iso-8601=seconds)"

# ── Pre-flight ──────────────────────────────────────────────────────────
: "${DATABASE_URL:?DATABASE_URL must be set}" || fail "missing DATABASE_URL" 1
BACKUP_DIR="${BACKUP_DIR:-/backups}"
mkdir -p "$BACKUP_DIR"

TS=$(date -u +%Y%m%dT%H%M%S)
RAW_FILE="$BACKUP_DIR/univerreviews-${TS}.sql.gz"
GPG_FILE="${RAW_FILE}.gpg"

# ── Dump + compress ─────────────────────────────────────────────────────
log "pg_dump → $RAW_FILE"
# --format=plain (default) + gzip pipe. Plain dump is easier to inspect /
# selective-restore than custom; for very large DBs swap to --format=c.
if ! pg_dump --no-owner --no-acl --clean --if-exists "$DATABASE_URL" | gzip -c > "$RAW_FILE"; then
  fail "pg_dump failed" 2
fi
SIZE=$(du -h "$RAW_FILE" | cut -f1)
log "Wrote $RAW_FILE ($SIZE)"

# ── Optional GPG encrypt ────────────────────────────────────────────────
UPLOAD_FILE="$RAW_FILE"
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  log "gpg encrypt → $GPG_FILE (recipient $BACKUP_GPG_RECIPIENT)"
  if gpg --batch --yes --trust-model always \
        --output "$GPG_FILE" --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
        "$RAW_FILE"; then
    UPLOAD_FILE="$GPG_FILE"
    rm "$RAW_FILE"  # only keep the encrypted copy on disk
  else
    log "WARN: gpg encrypt failed, keeping plaintext dump locally"
  fi
fi

# ── Optional offsite upload ─────────────────────────────────────────────
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    DEST="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-univerreviews}/$(basename "$UPLOAD_FILE")"
    log "aws s3 cp → $DEST"
    AWS_FLAGS=()
    [ -n "${AWS_S3_ENDPOINT:-}" ] && AWS_FLAGS+=("--endpoint-url" "$AWS_S3_ENDPOINT")
    if ! aws s3 cp "${AWS_FLAGS[@]}" "$UPLOAD_FILE" "$DEST"; then
      fail "s3 upload failed" 3
    fi
  else
    log "WARN: BACKUP_S3_BUCKET set but aws-cli unavailable — skipping upload"
  fi
fi

# ── Prune local copies > 30 days ────────────────────────────────────────
log "Pruning local backups older than 30 days"
find "$BACKUP_DIR" -name 'univerreviews-*.sql.gz*' -mtime +30 -delete 2>/dev/null || true

log "Backup OK"
bold "Done."

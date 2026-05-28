-- LGPD compliance: track which version of terms/privacy a user accepted,
-- and flag accounts pending erasure (Art. 18 VI). The dashboard layout
-- compares accepted_*_version against the constants in lib/legal.ts and
-- forces a re-aceite when they differ. deletion_requested_at gates
-- middleware so a user that requested account erasure can't continue
-- using the product during the retention window before the hard-delete
-- job runs.
ALTER TABLE auth.user
  ADD COLUMN IF NOT EXISTS accepted_terms_version    text,
  ADD COLUMN IF NOT EXISTS accepted_privacy_version  text,
  ADD COLUMN IF NOT EXISTS accepted_at               timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_requested_at     timestamptz;

CREATE INDEX IF NOT EXISTS user_deletion_requested_idx
  ON auth.user (deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

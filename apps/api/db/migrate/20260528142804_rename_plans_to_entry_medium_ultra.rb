# frozen_string_literal: true

# Renames the workspaces.plan tier set from the legacy
# free/starter/pro/enterprise tuple into the new entry/medium/ultra trio.
#
# Why we collapsed four tiers into three:
#   - Freemium was never live. We never billed via the platform and we
#     never built a free-tier retention flow. The "free" plan was
#     effectively an extended trial that we couldn't end gracefully.
#   - The external payment platform we use (T1.1 introduces it) does not
#     support trials or free entitlements, so any plan needs to be paid
#     up front. That made the free/starter split redundant.
#   - The new ladder maps capability -> price more cleanly:
#       entry  = the floor (1 user, 100 products, basic widget + ai_generate)
#       medium = the working merchant (multi_user, ai_dedup, webhook, 1k products)
#       ultra  = the scale plan (bulk AI ops, unlimited products + users)
#
# Data mapping (one-shot, idempotent):
#   free       -> entry
#   starter    -> entry      (consolidated; price overlap was minimal in our base)
#   pro        -> medium
#   enterprise -> ultra
#
# Rollback path (#down) restores plausible legacy values so we can revert
# the release without losing every workspace's billing state, but it is
# necessarily lossy — free and starter both became "entry" and we can no
# longer distinguish them, so #down picks "starter" (the conservative
# choice — assumes payment had started). Document the loss in the audit
# log of any rollback.
class RenamePlansToEntryMediumUltra < ActiveRecord::Migration[8.0]
  PLAN_FORWARD = {
    "free"       => "entry",
    "starter"    => "entry",
    "pro"        => "medium",
    "enterprise" => "ultra",
  }.freeze

  PLAN_REVERSE = {
    "entry"  => "starter",
    "medium" => "pro",
    "ultra"  => "enterprise",
  }.freeze

  def up
    # Transaction wraps drop-constraint + UPDATE + add-constraint so a
    # crash mid-flight never leaves the table in a state where the CHECK
    # constraint contradicts the data.
    ActiveRecord::Base.transaction do
      # 1. Drop the legacy CHECK so UPDATE can write the new values.
      execute "ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check"

      # 2. Remap data. CASE WHEN ... ELSE plan END is intentional: rows
      # that already hold a new value (re-running this migration on a
      # half-migrated DB) are left alone, making the migration idempotent.
      execute <<~SQL
        UPDATE workspaces
        SET plan = CASE plan
          WHEN 'free'       THEN 'entry'
          WHEN 'starter'    THEN 'entry'
          WHEN 'pro'        THEN 'medium'
          WHEN 'enterprise' THEN 'ultra'
          ELSE plan
        END
        WHERE plan IN ('free', 'starter', 'pro', 'enterprise')
      SQL

      # 3. Change the column default so newly-INSERTed workspaces start
      # on entry. Without this, the legacy default 'free' would still be
      # written by any code path that omits :plan and immediately fail
      # the new CHECK below.
      change_column_default :workspaces, :plan, from: "free", to: "entry"

      # 4. Re-add the CHECK with the new tier set.
      execute "ALTER TABLE workspaces ADD CONSTRAINT workspaces_plan_check CHECK (plan IN ('entry','medium','ultra'))"
    end
  end

  def down
    ActiveRecord::Base.transaction do
      execute "ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check"

      # Best-effort reverse. free+starter collapsed into entry — we cannot
      # split them back. We pick "starter" as the lossy choice because
      # any workspace migrated under #up was at least eligible for paid
      # billing; calling them "free" would erroneously remove paid status.
      execute <<~SQL
        UPDATE workspaces
        SET plan = CASE plan
          WHEN 'entry'  THEN 'starter'
          WHEN 'medium' THEN 'pro'
          WHEN 'ultra'  THEN 'enterprise'
          ELSE plan
        END
        WHERE plan IN ('entry', 'medium', 'ultra')
      SQL

      change_column_default :workspaces, :plan, from: "entry", to: "free"

      execute "ALTER TABLE workspaces ADD CONSTRAINT workspaces_plan_check CHECK (plan IN ('free','starter','pro','enterprise'))"
    end
  end
end

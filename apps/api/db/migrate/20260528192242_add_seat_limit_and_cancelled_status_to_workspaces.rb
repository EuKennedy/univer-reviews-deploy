class AddSeatLimitAndCancelledStatusToWorkspaces < ActiveRecord::Migration[8.0]
  # Two changes the super-admin panel needs to actually manage SaaS state:
  #
  # 1. `seat_limit` — per-workspace override of the plan's default
  #    membership cap. PlanFeatures already encodes a default (entry: 1,
  #    medium: 5, ultra: nil/unlimited). The override exists so the founder
  #    can grant a one-off larger seat pool to a strategic customer (e.g.,
  #    Lizzon negotiates 10 seats on the medium plan) without bumping their
  #    plan or rewriting PlanFeatures. NULL = "use plan default".
  #
  # 2. `'cancelled'` status — today the workspaces.status check constraint
  #    accepts only %w[active suspended trial], so cancelling a paying
  #    customer's plan has nowhere to land. Adding it as a distinct state
  #    (vs reusing 'suspended', which implies abuse) lets the UI distinguish
  #    voluntary churn from forced moderation and tags it correctly in MRR
  #    aggregations.
  def up
    add_column :workspaces, :seat_limit, :integer
    change_column_comment :workspaces, :seat_limit,
      "Per-workspace seat cap override. NULL = use plan default from PlanFeatures."

    # Workspaces table is locked tight by RLS; safer to do the ALTER as a
    # DROP+RECREATE pair rather than a single ALTER TABLE ... ADD VALUE
    # (which Postgres doesn't support on CHECK constraints anyway).
    execute "ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_status_check"
    execute <<~SQL.squish
      ALTER TABLE workspaces ADD CONSTRAINT workspaces_status_check
      CHECK (status IN ('active','suspended','trial','cancelled'))
    SQL
  end

  def down
    # Reverse order: tighten the check first (refusing to roll back if any
    # row is already in the new state — better to surface the inconsistency
    # than silently overwrite it), then drop the column.
    if exec_query("SELECT 1 FROM workspaces WHERE status = 'cancelled' LIMIT 1").rows.any?
      raise ActiveRecord::IrreversibleMigration,
            "Cannot roll back: at least one workspace has status='cancelled'. " \
            "Reassign those rows manually first."
    end
    execute "ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_status_check"
    execute <<~SQL.squish
      ALTER TABLE workspaces ADD CONSTRAINT workspaces_status_check
      CHECK (status IN ('active','suspended','trial'))
    SQL
    remove_column :workspaces, :seat_limit
  end
end

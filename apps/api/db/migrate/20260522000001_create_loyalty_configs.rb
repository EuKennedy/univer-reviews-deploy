class CreateLoyaltyConfigs < ActiveRecord::Migration[8.0]
  # Per-workspace mirror of the Univer Loyalty WordPress plugin "Review"
  # campaign(s). The plugin owns the source of truth — saving a campaign in
  # WP pushes the rule here so the SaaS dashboard can render a read-only
  # snapshot of "what earns points and how much" without giving merchants a
  # second place to edit (avoids drift).
  #
  # One row per (workspace_id, source_campaign_id). Replacing the row on every
  # push gives us a deterministic last-write-wins sync without needing audit
  # trails or sequence numbers — the plugin's admin UI is authoritative.
  def up
    create_table :loyalty_configs, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :workspace,
                   type: :uuid,
                   null: false,
                   foreign_key: { on_delete: :cascade }
      t.integer  :source_campaign_id, null: false
      t.string   :name,               null: false, default: ""
      t.text     :description
      t.boolean  :is_active,          null: false, default: true
      t.integer  :base_points,        null: false, default: 0
      t.integer  :min_chars,          null: false, default: 50
      t.boolean  :only_logged_in,     null: false, default: true
      t.integer  :bonus_photo,        null: false, default: 0
      t.integer  :bonus_video,        null: false, default: 0
      t.integer  :bonus_verified,     null: false, default: 0
      t.integer  :priority,           null: false, default: 0
      t.datetime :synced_at,          null: false, default: -> { "NOW()" }
      t.timestamps
    end

    add_index :loyalty_configs,
              %i[workspace_id source_campaign_id],
              unique: true,
              name: "idx_loyalty_configs_workspace_campaign"

    # All loyalty_config values are non-negative integers. Defensive checks at
    # the DB level so a buggy plugin push can't insert negative rewards.
    execute <<~SQL
      ALTER TABLE loyalty_configs
        ADD CONSTRAINT loyalty_configs_non_negative_check
        CHECK (
          base_points    >= 0 AND
          min_chars      >= 0 AND
          bonus_photo    >= 0 AND
          bonus_video    >= 0 AND
          bonus_verified >= 0 AND
          priority       >= 0
        )
    SQL

    # Multitenant isolation — every authenticated request must SET LOCAL
    # app.workspace_id, mirroring the policy used by every other tenant table
    # (workspaces, reviews, products, question_groups). Without this a key
    # leak from workspace A could read or overwrite workspace B's loyalty
    # rules.
    execute "ALTER TABLE loyalty_configs ENABLE ROW LEVEL SECURITY"
    execute <<~SQL
      CREATE POLICY loyalty_configs_workspace_isolation ON loyalty_configs
        USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
    SQL
    execute "ALTER TABLE loyalty_configs FORCE ROW LEVEL SECURITY"
  end

  def down
    execute "DROP POLICY IF EXISTS loyalty_configs_workspace_isolation ON loyalty_configs"
    execute "ALTER TABLE loyalty_configs DROP CONSTRAINT IF EXISTS loyalty_configs_non_negative_check"
    drop_table :loyalty_configs
  end
end

class AddTierColumnsToLoyaltyConfigs < ActiveRecord::Migration[8.0]
  # Adds categorical-tier columns alongside the legacy additive schema.
  #
  # The original loyalty_configs columns (base_points, bonus_photo, bonus_video)
  # model an additive rule: base + photo bonus + video bonus. The plugin's
  # campaign UI moved to a categorical model where each media bracket has a
  # single total — video > photo > text precedence, NOT additive. We keep the
  # legacy columns so existing rows remain readable and the WP plugin can
  # backfill (text=base, photo=base+bonus_photo, video=base+bonus_video) when
  # syncing old campaigns.
  def up
    add_column :loyalty_configs, :rule_type,    :string, null: false, default: "review_tiers"
    add_column :loyalty_configs, :points_text,  :integer, null: false, default: 0
    add_column :loyalty_configs, :points_photo, :integer, null: false, default: 0
    add_column :loyalty_configs, :points_video, :integer, null: false, default: 0

    execute <<~SQL
      ALTER TABLE loyalty_configs
        ADD CONSTRAINT loyalty_configs_tier_non_negative_check
        CHECK (
          points_text  >= 0 AND
          points_photo >= 0 AND
          points_video >= 0
        )
    SQL

    # Backfill from legacy columns so existing rows render correctly in the
    # dashboard immediately after deploy — text=base, photo=base+bonus_photo,
    # video=base+bonus_video. Matches the migration helper in the WP campaign
    # edit view.
    execute <<~SQL
      UPDATE loyalty_configs
      SET points_text  = COALESCE(base_points, 0),
          points_photo = COALESCE(base_points, 0) + COALESCE(bonus_photo, 0),
          points_video = COALESCE(base_points, 0) + COALESCE(bonus_video, 0)
    SQL
  end

  def down
    execute "ALTER TABLE loyalty_configs DROP CONSTRAINT IF EXISTS loyalty_configs_tier_non_negative_check"
    remove_column :loyalty_configs, :points_video, if_exists: true
    remove_column :loyalty_configs, :points_photo, if_exists: true
    remove_column :loyalty_configs, :points_text,  if_exists: true
    remove_column :loyalty_configs, :rule_type,    if_exists: true
  end
end

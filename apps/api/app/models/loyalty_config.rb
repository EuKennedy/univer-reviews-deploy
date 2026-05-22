# Per-workspace mirror of a single "review" campaign managed inside the
# Univer Loyalty WordPress plugin. The plugin pushes its config here on
# every campaign save; the SaaS dashboard renders this read-only so the
# merchant has a single source of truth (the plugin's own UI).
class LoyaltyConfig < ApplicationRecord
  belongs_to :workspace

  validates :source_campaign_id,
            presence: true,
            uniqueness: { scope: :workspace_id }

  validates :base_points, :min_chars,
            :bonus_photo, :bonus_video, :bonus_verified,
            :points_text, :points_photo, :points_video,
            :priority,
            numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :active,             -> { where(is_active: true) }
  scope :ordered_by_priority, -> { order(priority: :desc, id: :asc) }

  def self.upsert_from_wp!(workspace:, attrs:)
    config = find_or_initialize_by(
      workspace_id:       workspace.id,
      source_campaign_id: attrs.fetch(:source_campaign_id),
    )
    config.assign_attributes(attrs.merge(workspace_id: workspace.id, synced_at: Time.current))
    config.save!
    config
  end
end

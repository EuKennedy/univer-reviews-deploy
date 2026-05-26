# One topical grouping within a product's "Sumário de IA". The merchant
# either creates these manually (source=manual) or asks Claude to extract
# them (source=ai via AiGenerateSummaryTopicsJob).
#
# Counts (review_count, stars_avg) are denormalised and refreshed on every
# attach/detach so the storefront public endpoint serves topic cards
# without a join cost on every render.
class AiSummaryTopic < ApplicationRecord
  belongs_to :workspace
  belongs_to :product

  has_many :ai_summary_topic_reviews, dependent: :destroy
  has_many :reviews, through: :ai_summary_topic_reviews

  SOURCES = %w[manual ai].freeze

  validates :title,        presence: true, length: { maximum: 140 }
  validates :workspace_id, presence: true
  validates :product_id,   presence: true
  validates :position,
            numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :source, inclusion: { in: SOURCES }

  scope :ordered, -> { order(position: :asc, created_at: :asc) }

  # ─── Membership helpers ──────────────────────────────────────────────────
  # Attach/detach are idempotent on (topic_id, review_id) so re-running the
  # AI job (or re-saving from the admin UI) never produces duplicate cards.

  def attach_reviews!(review_ids)
    ids = Array(review_ids).compact_blank.uniq
    return 0 if ids.empty?
    # Workspace-scoped — silently ignore review_ids that belong to another tenant.
    valid_ids = workspace.reviews.where(id: ids).pluck(:id)
    existing  = ai_summary_topic_reviews.where(review_id: valid_ids).pluck(:review_id)
    to_create = valid_ids - existing
    rows = to_create.map do |rid|
      { workspace_id: workspace_id, ai_summary_topic_id: id, review_id: rid }
    end
    AiSummaryTopicReview.insert_all(rows) if rows.any?
    refresh_counts!
    to_create.length
  end

  def detach_reviews!(review_ids = nil)
    rel = ai_summary_topic_reviews
    rel = rel.where(review_id: Array(review_ids).compact_blank.uniq) if review_ids
    n = rel.destroy_all.length
    refresh_counts!
    n
  end

  # Recompute review_count + stars_avg from the join table. Always called
  # after attach/detach so the dashboard + public endpoint show fresh data.
  def refresh_counts!
    counts = reviews.where(status: "approved")
    n   = counts.count
    avg = n.positive? ? counts.average(:rating)&.round(2) : nil
    update_columns(review_count: n, stars_avg: avg, updated_at: Time.current)
  end
end

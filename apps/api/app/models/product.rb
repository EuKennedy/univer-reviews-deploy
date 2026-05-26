class Product < ApplicationRecord
  belongs_to :workspace
  belongs_to :product_group, optional: true
  has_many :reviews,   dependent: :nullify
  has_many :questions, dependent: :nullify

  has_many :question_group_products, dependent: :destroy
  has_many :question_groups, through: :question_group_products

  # AI Summary topics (3-6 topical groupings of reviews for the storefront
  # carousel preset). Managed by AiSummaryTopicsController + AiGenerate-
  # SummaryTopicsJob.
  has_many :ai_summary_topics, dependent: :destroy

  # Union of questions linked directly to this product OR via any group it belongs to.
  # Returns an ActiveRecord::Relation scoped to the workspace, deduped.
  def all_questions
    direct_ids   = questions.pluck(:id)
    group_qids   = Question.where(question_group_id: question_groups.select(:id)).pluck(:id)
    ids          = (direct_ids + group_qids).uniq
    workspace.questions.where(id: ids)
  end

  validates :title,        presence: true
  validates :workspace_id, presence: true
  validates :platform_product_id,
            uniqueness: { scope: %i[workspace_id platform] },
            allow_blank: true

  scope :active,       -> { where(active: true) }
  scope :by_platform,  ->(p) { where(platform: p) }
  scope :recently_synced, -> { order(last_synced_at: :desc) }

  # Pool of product ids to aggregate reviews over. If the product belongs to
  # a ProductGroup, every member shares the same pool; otherwise it's just
  # this product. Centralises the "grouped products share reviews" rule so
  # controllers don't branch.
  def review_scope_product_ids
    return [id] unless product_group_id.present?
    workspace.products.where(product_group_id: product_group_id).pluck(:id)
  end

  # Approved reviews across the group (or this product alone if ungrouped).
  def aggregated_reviews
    workspace.reviews.where(product_id: review_scope_product_ids, status: "approved")
  end

  def avg_rating
    aggregated_reviews.average(:rating)&.round(2)
  end

  def reviews_count
    aggregated_reviews.count
  end

  def stale_sync?(threshold: 24.hours)
    last_synced_at.nil? || last_synced_at < threshold.ago
  end
end

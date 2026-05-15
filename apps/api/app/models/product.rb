class Product < ApplicationRecord
  belongs_to :workspace
  has_many :reviews,   dependent: :nullify
  has_many :questions, dependent: :nullify

  validates :title,        presence: true
  validates :workspace_id, presence: true
  validates :platform_product_id,
            uniqueness: { scope: %i[workspace_id platform] },
            allow_blank: true

  scope :active,       -> { where(active: true) }
  scope :by_platform,  ->(p) { where(platform: p) }
  scope :recently_synced, -> { order(last_synced_at: :desc) }

  def avg_rating
    reviews.where(status: "approved").average(:rating)&.round(2)
  end

  def reviews_count
    reviews.where(status: "approved").count
  end

  def stale_sync?(threshold: 24.hours)
    last_synced_at.nil? || last_synced_at < threshold.ago
  end
end

class Review < ApplicationRecord
  belongs_to :workspace
  belongs_to :product, optional: true
  has_many   :review_media,  dependent: :destroy
  has_many   :replies,       dependent: :destroy
  has_one    :reward_grant,  dependent: :nullify

  has_neighbors :embedding

  SOURCES    = %w[manual csv woo shopify ryviu_import email whatsapp widget].freeze
  STATUSES   = %w[pending approved rejected hidden spam].freeze
  SENTIMENTS = %w[positive negative neutral mixed].freeze

  validates :rating,       presence: true, inclusion: { in: 1..5 }
  validates :workspace_id, presence: true
  validates :source,       inclusion: { in: SOURCES }
  validates :status,       inclusion: { in: STATUSES }
  validates :ai_sentiment, inclusion: { in: SENTIMENTS }, allow_nil: true

  before_save :set_approved_at

  scope :approved,     -> { where(status: "approved") }
  scope :pending,      -> { where(status: "pending") }
  scope :for_product,  ->(product_id) { where(product_id: product_id) }
  scope :recent,       -> { order(created_at: :desc) }
  scope :featured,     -> { where(is_featured: true) }
  scope :with_media,   -> { joins(:review_media).distinct }
  scope :by_rating,    ->(r) { where(rating: r) }
  scope :by_source,    ->(s) { where(source: s) }
  scope :date_range,   ->(from, to) { where(created_at: from..to) }
  scope :search_body,  ->(q) { where("body ILIKE ?", "%#{q}%") }

  def approved?  = status == "approved"
  def pending?   = status == "pending"
  def rejected?  = status == "rejected"
  def hidden?    = status == "hidden"
  def spam?      = status == "spam"

  def approve!(user_id: nil)
    update!(status: "approved", approved_at: Time.current)
  end

  def reject!
    update!(status: "rejected")
  end

  def mark_spam!
    update!(status: "spam")
  end

  def hide!
    update!(status: "hidden")
  end

  def has_media?
    review_media.any?
  end

  def has_photo?
    review_media.where(type: "image").any?
  end

  def has_video?
    review_media.where(type: "video").any?
  end

  private

  def set_approved_at
    if status_changed?(to: "approved") && approved_at.nil?
      self.approved_at = Time.current
    end
  end
end

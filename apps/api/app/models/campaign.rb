class Campaign < ApplicationRecord
  belongs_to :workspace
  belongs_to :reward_rule, optional: true
  has_many   :campaign_sends, dependent: :destroy

  TYPES         = %w[email whatsapp push nps].freeze
  STATUSES      = %w[draft active paused archived].freeze
  TRIGGER_TYPES = %w[order_completed order_delivered manual].freeze

  validates :name,         presence: true
  validates :type,         inclusion: { in: TYPES }
  validates :status,       inclusion: { in: STATUSES }
  validates :trigger_type, inclusion: { in: TRIGGER_TYPES }

  scope :active,    -> { where(status: "active") }
  scope :by_type,   ->(t) { where(type: t) }
  scope :email,     -> { where(type: "email") }
  scope :whatsapp,  -> { where(type: "whatsapp") }

  def draft?    = status == "draft"
  def active?   = status == "active"
  def paused?   = status == "paused"
  def archived? = status == "archived"

  def pause!
    update!(status: "paused")
  end

  def resume!
    update!(status: "active")
  end

  def archive!
    update!(status: "archived")
  end

  def activate!
    update!(status: "active")
  end

  def conversion_rate
    return 0.0 if sent_count.zero?
    (review_count.to_f / sent_count * 100).round(2)
  end

  def open_rate
    return 0.0 if sent_count.zero?
    (open_count.to_f / sent_count * 100).round(2)
  end
end

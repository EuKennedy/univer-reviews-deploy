class PlatformEvent < ApplicationRecord
  belongs_to :workspace
  has_many   :campaign_sends, dependent: :nullify

  EVENT_TYPES = %w[order_completed order_delivered order_paid order_refunded].freeze
  PLATFORMS   = %w[woocommerce shopify generic].freeze

  validates :platform,          presence: true, inclusion: { in: PLATFORMS }
  validates :event_type,        presence: true, inclusion: { in: EVENT_TYPES }
  validates :external_order_id, presence: true

  scope :unprocessed, -> { where(processed_at: nil) }
  scope :processed,   -> { where.not(processed_at: nil) }

  def processed? = processed_at.present?

  def mark_processed!
    update!(processed_at: Time.current)
  end
end

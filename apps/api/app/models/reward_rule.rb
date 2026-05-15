class RewardRule < ApplicationRecord
  belongs_to :workspace
  has_many   :reward_grants
  has_many   :campaigns

  TRIGGER_EVENTS = %w[review_submitted review_approved].freeze
  REWARD_TYPES   = %w[points coupon cashback gift].freeze

  validates :name,          presence: true
  validates :trigger_event, inclusion: { in: TRIGGER_EVENTS }
  validates :reward_type,   inclusion: { in: REWARD_TYPES }
  validates :reward_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :bonus_with_photo_pct,  numericality: { in: 0..500 }
  validates :bonus_with_video_pct,  numericality: { in: 0..500 }
  validates :bonus_long_review_pct, numericality: { in: 0..500 }

  scope :active,   -> { where(active: true) }
  scope :inactive, -> { where(active: false) }

  def active? = active && (ends_at.nil? || ends_at > Time.current) &&
                          (starts_at.nil? || starts_at <= Time.current)

  def cap_reached?
    return false if max_total_grants.nil?
    total_grants_count >= max_total_grants
  end

  def calculate_reward(review:)
    base = reward_amount.to_f
    bonus = 0.0

    bonus += base * bonus_with_photo_pct / 100.0 if review.has_photo?
    bonus += base * bonus_with_video_pct / 100.0 if review.has_video?

    if review.body.to_s.length > 150
      bonus += base * bonus_long_review_pct / 100.0
    end

    {
      base: base,
      bonus: bonus,
      total: base + bonus,
      bonuses: {
        photo: review.has_photo? ? bonus_with_photo_pct : 0,
        video: review.has_video? ? bonus_with_video_pct : 0,
        long_review: review.body.to_s.length > 150 ? bonus_long_review_pct : 0
      }
    }
  end
end

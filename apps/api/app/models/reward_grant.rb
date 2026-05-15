class RewardGrant < ApplicationRecord
  belongs_to :workspace
  belongs_to :rule,   class_name: "RewardRule", optional: true
  belongs_to :review, optional: true

  STATUSES = %w[pending granted consumed expired reverted].freeze

  validates :reward_type, presence: true
  validates :status,      inclusion: { in: STATUSES }

  scope :pending,  -> { where(status: "pending") }
  scope :granted,  -> { where(status: "granted") }
  scope :consumed, -> { where(status: "consumed") }
  scope :expired,  -> { where(status: "expired") }

  def grant!
    update!(status: "granted", granted_at: Time.current)
    rule&.increment!(:total_grants_count)
  end

  def consume!
    update!(status: "consumed", consumed_at: Time.current)
  end

  def revert!
    update!(status: "reverted")
    rule&.decrement!(:total_grants_count) if granted?
  end

  def granted?  = status == "granted"
  def consumed? = status == "consumed"
end

class Subscription < ApplicationRecord
  belongs_to :workspace
  belongs_to :plan, class_name: "BillingPlan"

  STATUSES = %w[trialing active past_due canceled].freeze

  validates :status, inclusion: { in: STATUSES }

  scope :active,   -> { where(status: %w[trialing active]) }
  scope :canceled, -> { where(status: "canceled") }

  def trialing?  = status == "trialing"
  def active?    = status == "active"
  def past_due?  = status == "past_due"
  def canceled?  = status == "canceled"

  def in_trial?
    trialing? && trial_ends_at.present? && trial_ends_at > Time.current
  end

  def active_or_trialing?
    active? || (trialing? && in_trial?)
  end
end

class BillingPlan < ApplicationRecord
  has_many :subscriptions

  validates :slug, presence: true, uniqueness: true
  validates :name, presence: true
  validates :price_monthly_cents, numericality: { greater_than_or_equal_to: 0 }
  validates :price_yearly_cents,  numericality: { greater_than_or_equal_to: 0 }

  scope :active, -> { where(active: true) }

  def price_monthly
    price_monthly_cents / 100.0
  end

  def price_yearly
    price_yearly_cents / 100.0
  end

  def feature?(key)
    features[key.to_s] == true
  end
end

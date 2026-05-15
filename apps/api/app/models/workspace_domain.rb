class WorkspaceDomain < ApplicationRecord
  belongs_to :workspace

  PLATFORMS = %w[woocommerce shopify generic].freeze

  validates :domain,   presence: true, uniqueness: true
  validates :platform, inclusion: { in: PLATFORMS }

  before_validation { domain&.downcase!&.strip }

  scope :verified, -> { where.not(verified_at: nil) }
  scope :by_platform, ->(p) { where(platform: p) }

  def verified? = verified_at.present?

  def verify!
    update!(verified_at: Time.current)
  end

  def woo_consumer_key
    platform_meta&.dig("consumer_key")
  end

  def woo_consumer_secret
    platform_meta&.dig("consumer_secret")
  end

  def woo_store_url
    platform_meta&.dig("store_url")
  end
end

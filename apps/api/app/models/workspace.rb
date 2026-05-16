class Workspace < ApplicationRecord
  belongs_to :better_auth_organization,
             class_name: "BetterAuth::Organization",
             foreign_key: :better_auth_org_id,
             optional: true

  has_many :workspace_users,    dependent: :destroy
  has_many :workspace_api_keys, dependent: :destroy
  has_many :workspace_domains,  dependent: :destroy
  has_many :products,           dependent: :destroy
  has_many :reviews,            dependent: :destroy
  has_many :campaigns,          dependent: :destroy
  has_many :reward_rules,       dependent: :destroy
  has_many :reward_grants,      dependent: :destroy
  has_many :imports,            dependent: :destroy
  has_many :ai_jobs,            dependent: :destroy
  has_many :audit_logs,         dependent: :destroy
  has_many :questions,          dependent: :destroy
  has_one  :subscription,       dependent: :destroy

  PLANS   = %w[free starter pro enterprise].freeze
  STATUSES = %w[active suspended trial].freeze

  validates :slug,   presence: true, uniqueness: true,
                     format: { with: /\A[a-z0-9-]+\z/, message: "only lowercase letters, numbers and hyphens" }
  validates :name,   presence: true
  validates :plan,   inclusion: { in: PLANS }
  validates :status, inclusion: { in: STATUSES }
  validates :brand_color, format: { with: /\A#[0-9a-fA-F]{6}\z/, allow_blank: true }

  scope :active,    -> { where(status: "active") }
  scope :suspended, -> { where(status: "suspended") }

  def active?   = status == "active"
  def suspended? = status == "suspended"
  def trial?     = status == "trial"

  def plan_free?       = plan == "free"
  def plan_starter?    = plan == "starter"
  def plan_pro?        = plan == "pro"
  def plan_enterprise? = plan == "enterprise"

  def woocommerce_domain
    workspace_domains.find_by(platform: "woocommerce")
  end

  def woocommerce_config
    woocommerce_domain&.platform_meta
  end
end

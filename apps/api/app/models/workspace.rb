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
  has_many :question_groups,    dependent: :destroy
  has_many :loyalty_configs,    dependent: :destroy
  has_many :platform_events,    dependent: :destroy
  has_one  :subscription,       dependent: :destroy

  PLANS   = %w[free starter pro enterprise].freeze
  STATUSES = %w[active suspended trial].freeze
  WIDGET_LAYOUTS = %w[default compact grid carousel].freeze
  WIDGET_STAR_SHAPES = %w[star heart flame thumb diamond].freeze
  WIDGET_LOCALES = %w[pt-BR en-US es-AR].freeze

  validates :slug,   presence: true, uniqueness: true,
                     format: { with: /\A[a-z0-9-]+\z/, message: "only lowercase letters, numbers and hyphens" }
  validates :name,   presence: true
  validates :plan,   inclusion: { in: PLANS }
  validates :status, inclusion: { in: STATUSES }
  validates :brand_color,      format: { with: /\A#[0-9a-fA-F]{6}\z/, allow_blank: true }
  validates :widget_star_color, format: { with: /\A#[0-9a-fA-F]{6}\z/, allow_blank: false }
  validates :widget_default_layout, inclusion: { in: WIDGET_LAYOUTS }
  validates :widget_per_page, numericality: {
    only_integer: true, greater_than_or_equal_to: 1, less_than_or_equal_to: 100,
  }
  validates :rating_icon_preset,
            inclusion: { in: WIDGET_STAR_SHAPES, allow_blank: true }

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

  # Public widget config exposed at GET /api/v1/public/widget-config. The
  # storefront `<univer-reviews>` element calls this on connect to pick up
  # workspace-level defaults, with the rule that an explicit HTML attribute
  # always wins (attribute > workspace setting > built-in default).
  def widget_config
    {
      layout:            widget_default_layout.presence || "default",
      locale:            default_locale.presence || "pt-BR",
      theme_color:       brand_color.presence || "#d4a850",
      star_color:        widget_star_color.presence || "#fbbf24",
      star_shape:        rating_icon_preset.presence || "star",
      show_qa:           widget_show_qa.nil? ? true : widget_show_qa,
      show_write_review: widget_show_write_review.nil? ? true : widget_show_write_review,
      per_page:          widget_per_page.presence || 10,
      custom_css:        widget_custom_css.to_s,
    }
  end
end

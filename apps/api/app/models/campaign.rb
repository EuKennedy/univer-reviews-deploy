require "cgi"

class Campaign < ApplicationRecord
  belongs_to :workspace
  belongs_to :reward_rule, optional: true
  has_many   :campaign_sends, dependent: :destroy

  TYPES         = %w[email whatsapp push nps].freeze
  STATUSES      = %w[draft active paused archived].freeze
  TRIGGER_TYPES = %w[order_completed order_delivered manual].freeze

  # Mirror of PlatformEvent::EVENT_TYPES for the new trigger_events array column.
  ALLOWED_TRIGGER_EVENTS = %w[order_completed order_delivered order_paid order_refunded].freeze

  validates :name,           presence: true
  validates :type,           inclusion: { in: TYPES }
  validates :status,         inclusion: { in: STATUSES }
  validates :trigger_type,   inclusion: { in: TRIGGER_TYPES }
  validates :trigger_events, presence: true
  validate  :trigger_events_values_are_known

  scope :active,    -> { where(status: "active") }
  scope :by_type,   ->(t) { where(type: t) }
  scope :email,     -> { where(type: "email") }
  scope :whatsapp,  -> { where(type: "whatsapp") }

  # Postgres `?` operator on an array column with bound parameter requires `= ANY(...)`.
  scope :listening_for, ->(event_type) {
    where("? = ANY(trigger_events)", event_type.to_s)
  }

  def draft?    = status == "draft"
  def active?   = status == "active"
  def paused?   = status == "paused"
  def archived? = status == "archived"

  def pause!    = update!(status: "paused")
  def resume!   = update!(status: "active")
  def archive!  = update!(status: "archived")
  def activate! = update!(status: "active")

  def delay_seconds
    trigger_after_minutes.to_i * 60
  end

  # Render the email subject + html for a given CampaignSend.
  # Variables are HTML-escaped except {{review_link}} which is a URL we generate.
  def render_for(send)
    vars      = build_vars(send)
    subject   = interpolate(subject_template.presence || "Avalie sua compra", vars, escape: false)
    body      = html_template.presence || default_template
    rendered  = interpolate(body, vars, escape: true)

    { subject: subject, html: rendered }
  end

  def conversion_rate
    return 0.0 if sent_count.zero?
    (review_count.to_f / sent_count * 100).round(2)
  end

  def open_rate
    return 0.0 if sent_count.zero?
    (open_count.to_f / sent_count * 100).round(2)
  end

  def click_rate
    return 0.0 if sent_count.zero?
    (click_count.to_f / sent_count * 100).round(2)
  end

  private

  def build_vars(send)
    product_name  = (send.product_ids.is_a?(Array) ? send.product_ids.first : nil) ||
                    (send.respond_to?(:platform_event) && send.platform_event&.product_handles&.first)
    {
      "customer_name"  => send.recipient_name.presence || send.customer_email.to_s.split("@").first.to_s.capitalize,
      "customer_email" => send.recipient_email.presence || send.customer_email.to_s,
      "product_name"   => product_name.to_s,
      "order_total"    => format_amount(send),
      "store_name"     => workspace.name.to_s,
      "review_link"    => review_link_for(send)
    }
  end

  def interpolate(template, vars, escape:)
    template.to_s.gsub(/\{\{\s*([a-z_]+)\s*\}\}/) do
      key = Regexp.last_match(1)
      value = vars[key].to_s
      # review_link is a URL we control — never escape so the href stays valid.
      escape && key != "review_link" ? CGI.escapeHTML(value) : value
    end
  end

  def format_amount(send)
    event = send.respond_to?(:platform_event) ? send.platform_event : nil
    total = event&.order_total
    return "" if total.blank?
    format("%.2f", total.to_f)
  end

  def review_link_for(send)
    domain = workspace.workspace_domains.first&.domain
    base   = domain.presence || "#{workspace.slug}.univerreviews.com"
    "https://#{base}/avaliacoes"
  end

  def default_template
    <<~'HTML'
      <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2>Olá, {{customer_name}}!</h2>
          <p>Obrigado pela sua compra em {{store_name}}.</p>
          <p>Sua opinião é muito importante. Que tal deixar uma avaliação?</p>
          <p>
            <a href="{{review_link}}" style="background:#d4a850;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
              Avaliar minha compra
            </a>
          </p>
          <p style="color:#999;font-size:12px;">{{store_name}}</p>
        </body>
      </html>
    HTML
  end

  def trigger_events_values_are_known
    return if trigger_events.blank?
    bad = Array(trigger_events).reject { |e| ALLOWED_TRIGGER_EVENTS.include?(e.to_s) }
    errors.add(:trigger_events, "contains unknown values: #{bad.join(', ')}") if bad.any?
  end
end

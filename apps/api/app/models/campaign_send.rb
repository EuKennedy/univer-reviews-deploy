class CampaignSend < ApplicationRecord
  belongs_to :campaign
  belongs_to :workspace
  belongs_to :platform_event, optional: true

  STATUSES = %w[queued sent delivered opened clicked bounced complained converted].freeze

  validates :status, inclusion: { in: STATUSES }

  scope :by_status, ->(s) { where(status: s) }
  scope :queued,    ->     { where(status: "queued") }
  scope :sent,      ->     { where(status: "sent") }
  scope :delivered, ->     { where(status: "delivered") }
  scope :opened,    ->     { where(status: "opened") }
  scope :clicked,   ->     { where(status: "clicked") }
  scope :bounced,   ->     { where(status: "bounced") }
  scope :complained,->     { where(status: "complained") }
  scope :converted, ->     { where(status: "converted") }

  scope :due, -> { where(status: "queued").where("scheduled_at IS NULL OR scheduled_at <= ?", Time.current) }

  def queued?     = status == "queued"
  def sent?       = status == "sent"
  def delivered?  = status == "delivered"
  def opened?     = status == "opened"
  def clicked?    = status == "clicked"
  def bounced?    = status == "bounced"
  def complained? = status == "complained"
  def converted?  = status == "converted"

  # Marked when Resend POST returns success.
  def mark_sent!(message_id: nil)
    updates = { status: "sent", sent_at: Time.current, last_event_at: Time.current }
    updates[:resend_message_id] = message_id if message_id.present?
    update!(updates)
    campaign.increment!(:sent_count)
  end

  # Resend webhook: email.delivered
  def mark_delivered!
    return if delivered? || opened? || clicked? || converted?
    update!(status: "delivered", last_event_at: Time.current)
  end

  # Resend webhook: email.bounced
  def mark_bounced!(reason: nil)
    update!(status: "bounced", bounced_at: Time.current, last_event_at: Time.current)
  end

  # Resend webhook: email.complained
  def mark_complained!
    update!(status: "complained", complained_at: Time.current, last_event_at: Time.current)
  end

  # Tracking pixel / Resend webhook email.opened
  def mark_opened!
    now = Time.current
    self.opened_count = opened_count.to_i + 1
    self.opened_at  ||= now
    self.last_event_at = now
    # Only advance status forward (don't downgrade from clicked/converted)
    self.status = "opened" if %w[queued sent delivered].include?(status)
    save!
    campaign.increment!(:open_count) if opened_count == 1
  end

  # Click endpoint / Resend webhook email.clicked
  def mark_clicked!
    now = Time.current
    self.clicked_count = clicked_count.to_i + 1
    self.clicked_at  ||= now
    self.last_event_at = now
    self.status = "clicked" if %w[queued sent delivered opened].include?(status)
    save!
    campaign.increment!(:click_count) if clicked_count == 1
  end

  def mark_converted!(review_id:)
    update!(status: "converted", converted_review_id: review_id, last_event_at: Time.current)
    campaign.increment!(:review_count)
  end
end

class CampaignSend < ApplicationRecord
  belongs_to :campaign
  belongs_to :workspace

  STATUSES = %w[queued sent opened clicked converted bounced].freeze

  validates :status, inclusion: { in: STATUSES }

  scope :by_status, ->(s)  { where(status: s) }
  scope :queued,    ->      { where(status: "queued") }
  scope :sent,      ->      { where(status: "sent") }
  scope :converted, ->      { where(status: "converted") }

  def mark_sent!
    update!(status: "sent", sent_at: Time.current)
    campaign.increment!(:sent_count)
  end

  def mark_opened!
    return if opened_at.present?
    update!(status: "opened", opened_at: Time.current)
    campaign.increment!(:open_count)
  end

  def mark_clicked!
    return if clicked_at.present?
    update!(status: "clicked", clicked_at: Time.current)
    campaign.increment!(:click_count)
  end

  def mark_converted!(review_id:)
    update!(status: "converted", converted_review_id: review_id)
    campaign.increment!(:review_count)
  end
end

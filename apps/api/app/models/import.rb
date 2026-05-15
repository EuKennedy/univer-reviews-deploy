class Import < ApplicationRecord
  belongs_to :workspace

  SOURCES  = %w[ryviu yotpo trustvox csv api woocommerce judge_me loox stamped reviews_io].freeze
  STATUSES = %w[queued processing done failed].freeze

  validates :source, inclusion: { in: SOURCES }
  validates :status, inclusion: { in: STATUSES }

  scope :recent,    -> { order(created_at: :desc) }
  scope :completed, -> { where(status: "done") }
  scope :failed,    -> { where(status: "failed") }

  def start!
    update!(status: "processing", started_at: Time.current)
  end

  def finish!(ok:, errors:)
    update!(
      status: "done",
      ok_rows: ok,
      error_rows: errors,
      finished_at: Time.current
    )
  end

  def fail!(error_msg)
    append_log("error", error_msg)
    update!(status: "failed", finished_at: Time.current)
  end

  def append_log(level, message)
    entry = { ts: Time.current.iso8601, level: level, message: message }
    update_column(:log, (log || []) + [entry])
  end
end

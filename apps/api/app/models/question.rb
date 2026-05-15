class Question < ApplicationRecord
  belongs_to :workspace
  belongs_to :product, optional: true
  belongs_to :answered_by, class_name: "WorkspaceUser",
             foreign_key: :answered_by_user_id, optional: true

  STATUSES = %w[pending published rejected].freeze

  validates :body,   presence: true
  validates :status, inclusion: { in: STATUSES }

  before_validation { author_email&.downcase! }

  scope :pending,   -> { where(status: "pending") }
  scope :published, -> { where(status: "published") }
  scope :recent,    -> { order(created_at: :desc) }

  def answer!(body:, user:)
    update!(
      answer: body,
      answered_by_user_id: user.id,
      answered_at: Time.current,
      status: "published"
    )
  end

  def increment_helpful!
    increment!(:helpful_count)
  end

  def published? = status == "published"
  def pending?   = status == "pending"
end

class Question < ApplicationRecord
  belongs_to :workspace
  belongs_to :product, optional: true
  belongs_to :answered_by, class_name: "WorkspaceUser",
             foreign_key: :answered_by_user_id, optional: true
  belongs_to :question_group, optional: true

  # "draft" = AI-generated, awaiting operator review in the bulk-draft editor.
  # Hidden from the storefront and the pending queue until "Publicar".
  STATUSES = %w[draft pending published rejected].freeze

  validates :body,         presence: true, length: { maximum: 1_000 }
  validates :answer,       length: { maximum: 5_000 }, allow_nil: true
  validates :author_name,  length: { maximum: 120 },   allow_nil: true
  validates :author_email, length: { maximum: 254 },   allow_nil: true
  validates :status,       inclusion: { in: STATUSES }

  before_validation { author_email&.downcase! }
  # When a draft is published with an answer already written, stamp the
  # answered timestamp so the storefront Q&A panel shows it correctly even
  # though it skipped the answer!() convenience path.
  before_save :stamp_answered_at

  def stamp_answered_at
    if status == "published" && answer.present? && answered_at.nil?
      self.answered_at = Time.current
    end
  end

  scope :pending,   -> { where(status: "pending") }
  scope :published, -> { where(status: "published") }
  scope :draft,     -> { where(status: "draft") }
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

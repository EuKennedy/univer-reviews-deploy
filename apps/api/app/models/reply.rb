class Reply < ApplicationRecord
  belongs_to :review
  belongs_to :workspace
  belongs_to :author, class_name: "WorkspaceUser", foreign_key: :author_user_id, optional: true

  validates :body, presence: true

  scope :published,     -> { where(is_published: true) }
  scope :ai_generated,  -> { where(is_ai_generated: true) }
  scope :recent,        -> { order(created_at: :desc) }

  def publish!
    update!(is_published: true)
  end

  def unpublish!
    update!(is_published: false)
  end
end

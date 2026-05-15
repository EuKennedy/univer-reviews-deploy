class ReviewMedium < ApplicationRecord
  self.table_name = "review_media"

  belongs_to :review
  belongs_to :workspace

  TYPES = %w[image video].freeze

  validates :storage_key, presence: true
  validates :type,        inclusion: { in: TYPES }

  scope :images, -> { where(type: "image") }
  scope :videos, -> { where(type: "video") }

  def image? = type == "image"
  def video? = type == "video"
end

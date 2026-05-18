class QuestionGroupProduct < ApplicationRecord
  belongs_to :workspace
  belongs_to :question_group
  belongs_to :product

  validates :question_group_id, uniqueness: { scope: :product_id }
end

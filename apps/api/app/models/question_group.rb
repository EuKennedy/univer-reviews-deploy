class QuestionGroup < ApplicationRecord
  belongs_to :workspace

  has_many :question_group_products, dependent: :destroy
  has_many :products,  through: :question_group_products
  has_many :questions, dependent: :nullify

  validates :name, presence: true, length: { maximum: 120 }

  scope :recent, -> { order(created_at: :desc) }

  # Attach a list of product_ids to this group (idempotent — duplicates ignored).
  # Returns the count of newly attached rows.
  def attach_products!(product_ids)
    ids = Array(product_ids).map(&:to_s).uniq.reject(&:blank?)
    return 0 if ids.empty?

    existing = question_group_products.where(product_id: ids).pluck(:product_id).map(&:to_s)
    new_ids  = ids - existing
    return 0 if new_ids.empty?

    valid_ids = workspace.products.where(id: new_ids).pluck(:id).map(&:to_s)
    rows = valid_ids.map { |pid| { workspace_id: workspace_id, question_group_id: id, product_id: pid } }
    question_group_products.insert_all(rows) if rows.any?
    rows.size
  end

  def detach_products!(product_ids)
    ids = Array(product_ids).map(&:to_s).uniq.reject(&:blank?)
    return 0 if ids.empty?

    question_group_products.where(product_id: ids).delete_all
  end
end

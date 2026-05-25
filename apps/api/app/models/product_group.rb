class ProductGroup < ApplicationRecord
  belongs_to :workspace
  has_many :products, dependent: :nullify

  scope :recent, -> { order(created_at: :desc) }

  validates :name,         presence: true
  validates :workspace_id, presence: true
  validates :slug,
            presence: true,
            uniqueness: { scope: :workspace_id },
            format: { with: /\A[a-z0-9-]+\z/, message: "only lowercase letters, numbers and hyphens" }

  before_validation :ensure_slug

  # All product ids that belong to this group, scoped to the workspace via
  # the FK + RLS. Used by review/video/summary endpoints to fan a single
  # product lookup into the group's aggregate pool.
  def member_product_ids
    products.pluck(:id)
  end

  # Aggregate review scope across every member product. Defaults to approved
  # so the public endpoints can build summary / list / videos on top of it.
  def reviews(status: "approved")
    rel = workspace.reviews.where(product_id: member_product_ids)
    status ? rel.where(status: status) : rel
  end

  def reviews_count
    reviews.count
  end

  def avg_rating
    reviews.average(:rating)&.round(2)
  end

  # The "canonical" product for the group — first the explicitly set
  # primary, otherwise the first member. Returns nil if the group is empty.
  def primary_product
    explicit = workspace.products.find_by(id: primary_product_id) if primary_product_id.present?
    explicit || products.order(:created_at).first
  end

  # Add products to the group (workspace-scoped). Returns the count attached.
  def attach_products!(product_ids)
    ids = Array(product_ids).compact_blank.uniq
    return 0 if ids.empty?
    workspace.products.where(id: ids).update_all(product_group_id: id)
  end

  # Remove products from the group. Pass nil to detach ALL members.
  def detach_products!(product_ids = nil)
    rel = products
    rel = rel.where(id: Array(product_ids).compact_blank.uniq) if product_ids
    rel.update_all(product_group_id: nil)
  end

  private

  def ensure_slug
    return if slug.present?
    base = name.to_s.parameterize
    return if base.blank?

    candidate = base
    n = 1
    while workspace&.product_groups&.where.not(id: id)&.exists?(slug: candidate)
      n += 1
      candidate = "#{base}-#{n}"
    end
    self.slug = candidate
  end
end

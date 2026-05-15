class WorkspaceUser < ApplicationRecord
  belongs_to :workspace
  has_many :magic_link_tokens, dependent: :destroy

  ROLES = %w[owner admin editor moderator viewer].freeze

  validates :email, presence: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP },
                    uniqueness: { scope: :workspace_id, case_sensitive: false }
  validates :name, presence: true
  validates :role, inclusion: { in: ROLES }

  before_validation { email&.downcase! }

  scope :by_role, ->(role) { where(role: role) }
  scope :owners,  -> { where(role: "owner") }
  scope :admins,  -> { where(role: %w[owner admin]) }

  def owner?     = role == "owner"
  def admin?     = %w[owner admin].include?(role)
  def can_write? = %w[owner admin editor].include?(role)
  def moderator? = %w[owner admin editor moderator].include?(role)
end

class WorkspaceUser < ApplicationRecord
  # password column in db is `password_hash` (Rails default would be `password_digest`)
  attribute :password, :string
  attribute :password_confirmation, :string

  belongs_to :workspace
  belongs_to :better_auth_user,
             class_name: "BetterAuth::User",
             foreign_key: :better_auth_user_id,
             optional: true
  has_many :magic_link_tokens, dependent: :destroy

  ROLES = %w[owner admin editor moderator viewer].freeze

  validates :email, presence: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP },
                    uniqueness: { scope: :workspace_id, case_sensitive: false }
  validates :name, presence: true
  validates :role, inclusion: { in: ROLES }

  before_validation { email&.downcase! }
  before_save :hash_password_if_present

  scope :by_role, ->(role) { where(role: role) }
  scope :owners,  -> { where(role: "owner") }
  scope :admins,  -> { where(role: %w[owner admin]) }

  def owner?     = role == "owner"
  def admin?     = %w[owner admin].include?(role)
  def can_write? = %w[owner admin editor].include?(role)
  def moderator? = %w[owner admin editor moderator].include?(role)

  def password=(raw)
    @password_raw = raw
    super(raw)
  end

  def authenticate(raw)
    return false if password_hash.blank? || raw.blank?
    BCrypt::Password.new(password_hash) == raw ? self : false
  rescue BCrypt::Errors::InvalidHash
    false
  end

  private

  def hash_password_if_present
    return if @password_raw.blank?
    self.password_hash = BCrypt::Password.create(@password_raw)
  end
end

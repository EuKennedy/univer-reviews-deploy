class MagicLinkToken < ApplicationRecord
  belongs_to :workspace_user

  validates :token_hash, presence: true, uniqueness: true
  validates :expires_at, presence: true

  scope :valid,   -> { where(used_at: nil).where("expires_at > ?", Time.current) }
  scope :expired, -> { where("expires_at <= ?", Time.current) }

  def self.generate_for(workspace_user, ttl: 15.minutes)
    raw_token = SecureRandom.urlsafe_base64(32)
    token_hash = Digest::SHA256.hexdigest(raw_token)

    record = create!(
      workspace_user: workspace_user,
      token_hash: token_hash,
      expires_at: ttl.from_now
    )

    [record, raw_token]
  end

  def self.find_valid(raw_token)
    token_hash = Digest::SHA256.hexdigest(raw_token)
    valid.find_by(token_hash: token_hash)
  end

  def use!
    update!(used_at: Time.current)
  end

  def expired?  = expires_at <= Time.current
  def used?     = used_at.present?
  def valid?    = !expired? && !used?
end

class WorkspaceApiKey < ApplicationRecord
  belongs_to :workspace

  validates :key_hash,   presence: true, uniqueness: true
  validates :key_prefix, presence: true, length: { maximum: 8 }

  scope :active, -> {
    where(revoked_at: nil)
      .where("expires_at IS NULL OR expires_at > ?", Time.current)
  }

  def revoked?  = revoked_at.present?
  def expired?  = expires_at.present? && expires_at <= Time.current
  def active?   = !revoked? && !expired?

  def revoke!
    update!(revoked_at: Time.current)
  end

  def has_scope?(scope_name)
    scopes.to_s.split(",").map(&:strip).include?(scope_name.to_s)
  end

  def read?  = has_scope?("read")
  def write? = has_scope?("write")

  # Generate a new raw key and return [record_attrs, raw_key]
  def self.generate(workspace:, label: nil, scopes: "read,write", expires_in: nil)
    raw_key = "unvr_#{SecureRandom.hex(32)}"
    key_hash = Digest::SHA256.hexdigest(raw_key)
    key_prefix = raw_key[0, 8]

    record = new(
      workspace: workspace,
      key_hash: key_hash,
      key_prefix: key_prefix,
      label: label,
      scopes: scopes,
      expires_at: expires_in ? Time.current + expires_in : nil
    )

    [record, raw_key]
  end
end

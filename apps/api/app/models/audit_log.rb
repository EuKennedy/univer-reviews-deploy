class AuditLog < ApplicationRecord
  belongs_to :workspace
  belongs_to :user, class_name: "WorkspaceUser", foreign_key: :user_id, optional: true

  validates :action, presence: true

  scope :recent,         -> { order(created_at: :desc) }
  scope :by_entity,      ->(type, id) { where(entity_type: type, entity_id: id) }
  scope :by_action,      ->(a) { where(action: a) }
  scope :by_user,        ->(uid) { where(user_id: uid) }

  def self.record(workspace:, action:, entity: nil, user_id: nil, metadata: {}, request: nil)
    create!(
      workspace: workspace,
      user_id: user_id,
      action: action.to_s,
      entity_type: entity&.class&.name,
      entity_id: entity&.id&.to_s,
      metadata: metadata,
      ip_address: request&.remote_ip,
      user_agent: request&.user_agent
    )
  rescue => e
    Rails.logger.error("AuditLog.record failed: #{e.message}")
  end
end

class CleanupExpiredTokensJob < ApplicationJob
  queue_as :default

  def perform
    deleted = MagicLinkToken.where("expires_at < ?", 7.days.ago).delete_all
    Rails.logger.info("CleanupExpiredTokensJob: deleted #{deleted} expired tokens")
  end
end

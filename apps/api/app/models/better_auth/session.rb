module BetterAuth
  # Read-only mirror of Better Auth's `auth.session` table.
  # Drizzle (apps/admin) owns schema migrations for this table.
  class Session < ApplicationRecord
    self.table_name = "auth.session"
    self.primary_key = "id"

    belongs_to :user, class_name: "BetterAuth::User", foreign_key: :user_id

    def expired?
      expires_at.nil? || expires_at < Time.current
    end
  end
end

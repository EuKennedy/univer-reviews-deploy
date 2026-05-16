module BetterAuth
  class Member < ApplicationRecord
    self.table_name = "auth.member"
    self.primary_key = "id"

    belongs_to :user, class_name: "BetterAuth::User", foreign_key: :user_id
    belongs_to :organization, class_name: "BetterAuth::Organization", foreign_key: :organization_id
  end
end

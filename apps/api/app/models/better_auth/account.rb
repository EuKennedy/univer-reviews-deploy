module BetterAuth
  class Account < ApplicationRecord
    self.table_name = "auth.account"
    self.primary_key = "id"

    belongs_to :user, class_name: "BetterAuth::User", foreign_key: :user_id
  end
end

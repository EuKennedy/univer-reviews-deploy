module BetterAuth
  # Read-only mirror of Better Auth's `auth.user` table.
  class User < ApplicationRecord
    self.table_name = "auth.user"
    self.primary_key = "id"

    has_many :sessions, class_name: "BetterAuth::Session", foreign_key: :user_id, dependent: :destroy
    has_many :accounts, class_name: "BetterAuth::Account", foreign_key: :user_id, dependent: :destroy
    has_many :memberships, class_name: "BetterAuth::Member", foreign_key: :user_id, dependent: :destroy

    # Bridge to Rails-owned WorkspaceUser by FK column we added.
    has_many :workspace_users, foreign_key: :better_auth_user_id, primary_key: :id
  end
end

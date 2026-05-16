module BetterAuth
  class Organization < ApplicationRecord
    self.table_name = "auth.organization"
    self.primary_key = "id"

    has_many :members, class_name: "BetterAuth::Member", foreign_key: :organization_id, dependent: :destroy

    # Bridge to Rails-owned Workspace.
    has_one :workspace, foreign_key: :better_auth_org_id, primary_key: :id
  end
end

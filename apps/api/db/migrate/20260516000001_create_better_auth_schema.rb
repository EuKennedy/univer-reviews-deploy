class CreateBetterAuthSchema < ActiveRecord::Migration[8.0]
  # Creates the `auth` Postgres schema that Better Auth owns.
  # Tables are managed by Drizzle (apps/admin) via drizzle-kit migrations.
  # Rails only owns the namespace creation + linking column on workspace_users.
  def up
    execute "CREATE SCHEMA IF NOT EXISTS auth"

    add_column :workspace_users, :better_auth_user_id, :text
    add_index  :workspace_users, :better_auth_user_id, unique: true

    add_column :workspaces, :better_auth_org_id, :text
    add_index  :workspaces, :better_auth_org_id, unique: true
  end

  def down
    remove_index :workspaces, :better_auth_org_id
    remove_column :workspaces, :better_auth_org_id
    remove_index :workspace_users, :better_auth_user_id
    remove_column :workspace_users, :better_auth_user_id
    # NOTE: do not drop `auth` schema — Drizzle migrations live there.
  end
end

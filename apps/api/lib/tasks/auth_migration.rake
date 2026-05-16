# Rake tasks for migrating from legacy JWT/MagicLink auth to Better Auth.
#
# Usage:
#   bundle exec rails auth:migrate            # idempotent: runs all steps
#   bundle exec rails auth:status             # report progress
#   bundle exec rails auth:reset_session_for[email@x.com]  # force re-login
#
# Order of operations:
#   1. Ensure Better Auth tables exist (Drizzle migration must have run first).
#   2. For each Workspace without better_auth_org_id, INSERT into auth.organization
#      and update workspaces.better_auth_org_id.
#   3. For each WorkspaceUser without better_auth_user_id:
#        a. Find or create auth.user by email (Better Auth user is global).
#        b. INSERT auth.account (provider_id='credential', accountId=user.id,
#           password=workspace_users.password_hash) — bcrypt hash is preserved
#           and Better Auth's bcrypt verify works against it.
#        c. INSERT auth.member linking user → organization with mapped role.
#        d. Update workspace_users.better_auth_user_id.

namespace :auth do
  desc "Migrate all workspaces + workspace_users to Better Auth (idempotent)"
  task migrate: :environment do
    require "securerandom"

    abort_if_tables_missing!

    migrated_orgs = 0
    migrated_users = 0
    skipped = 0

    Workspace.find_each do |workspace|
      org_id = ensure_organization!(workspace)
      migrated_orgs += 1 if workspace.better_auth_org_id.blank?
      workspace.update_columns(better_auth_org_id: org_id) if workspace.better_auth_org_id != org_id

      workspace.workspace_users.find_each do |wu|
        if wu.better_auth_user_id.present?
          skipped += 1
          next
        end

        if wu.password_hash.blank?
          puts "  skip #{wu.email} — no password_hash (use magic link to set one)"
          skipped += 1
          next
        end

        ba_user_id = upsert_better_auth_user!(wu)
        ensure_credential_account!(ba_user_id, wu.password_hash)
        ensure_membership!(ba_user_id, org_id, wu.role)

        wu.update_columns(better_auth_user_id: ba_user_id)
        migrated_users += 1
        puts "  ✓ #{wu.email} → #{ba_user_id}"
      end
    end

    puts ""
    puts "Done. Orgs: #{migrated_orgs} new, Users: #{migrated_users} new, #{skipped} skipped."
  end

  desc "Print migration status counts"
  task status: :environment do
    abort_if_tables_missing!
    puts "Workspaces total ........ #{Workspace.count}"
    puts "  with better_auth_org_id #{Workspace.where.not(better_auth_org_id: nil).count}"
    puts "WorkspaceUsers total .... #{WorkspaceUser.count}"
    puts "  with better_auth_user_id #{WorkspaceUser.where.not(better_auth_user_id: nil).count}"
    puts "Better Auth users ....... #{exec_count('auth.user')}"
    puts "Better Auth orgs ........ #{exec_count('auth.organization')}"
    puts "Better Auth members ..... #{exec_count('auth.member')}"
    puts "Better Auth sessions .... #{exec_count('auth.session')}"
  end

  desc "Revoke all sessions for the given email"
  task :reset_session_for, [:email] => :environment do |_t, args|
    email = args[:email].to_s.downcase
    abort "Usage: rails auth:reset_session_for[email@x.com]" if email.blank?

    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql([
        "DELETE FROM auth.session WHERE user_id IN (SELECT id FROM auth.user WHERE email = ?)",
        email
      ])
    )
    puts "Sessions revoked for #{email}"
  end

  # ─── Helpers ────────────────────────────────────────────────────────────────

  def abort_if_tables_missing!
    %w[auth.user auth.session auth.account auth.organization auth.member].each do |t|
      ActiveRecord::Base.connection.execute("SELECT 1 FROM #{t} LIMIT 1")
    rescue ActiveRecord::StatementInvalid => e
      abort "Better Auth table #{t} missing. Run drizzle-kit migrate in apps/admin first.\n#{e.message}"
    end
  end

  def ensure_organization!(workspace)
    existing = workspace.better_auth_org_id
    return existing if existing.present? && exec_exists?("auth.organization", "id", existing)

    org_id = SecureRandom.uuid
    quoted_id    = ActiveRecord::Base.connection.quote(org_id)
    quoted_name  = ActiveRecord::Base.connection.quote(workspace.name)
    quoted_slug  = ActiveRecord::Base.connection.quote(workspace.slug)

    ActiveRecord::Base.connection.execute(<<~SQL)
      INSERT INTO auth.organization (id, name, slug, created_at)
      VALUES (#{quoted_id}, #{quoted_name}, #{quoted_slug}, NOW())
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    SQL

    # Re-read in case ON CONFLICT path was taken
    row = ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(["SELECT id FROM auth.organization WHERE slug = ?", workspace.slug])
    ).first
    row["id"]
  end

  def upsert_better_auth_user!(wu)
    email = wu.email.downcase
    existing = ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(["SELECT id FROM auth.user WHERE email = ?", email])
    ).first
    return existing["id"] if existing

    user_id = SecureRandom.uuid
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql([
        "INSERT INTO auth.user (id, name, email, email_verified, created_at, updated_at) " \
        "VALUES (?, ?, ?, ?, NOW(), NOW())",
        user_id, wu.name, email, true # backfilled users are trusted
      ])
    )
    user_id
  end

  def ensure_credential_account!(user_id, bcrypt_hash)
    existing = ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql([
        "SELECT id FROM auth.account WHERE user_id = ? AND provider_id = 'credential'",
        user_id
      ])
    ).first
    return existing["id"] if existing

    account_id = SecureRandom.uuid
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql([
        "INSERT INTO auth.account (id, user_id, provider_id, account_id, password, created_at, updated_at) " \
        "VALUES (?, ?, 'credential', ?, ?, NOW(), NOW())",
        account_id, user_id, user_id, bcrypt_hash
      ])
    )
    account_id
  end

  def ensure_membership!(user_id, org_id, role)
    existing = ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql([
        "SELECT id FROM auth.member WHERE user_id = ? AND organization_id = ?", user_id, org_id
      ])
    ).first
    return existing["id"] if existing

    member_id = SecureRandom.uuid
    ba_role = map_role(role)
    ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql([
        "INSERT INTO auth.member (id, user_id, organization_id, role, created_at) " \
        "VALUES (?, ?, ?, ?, NOW())",
        member_id, user_id, org_id, ba_role
      ])
    )
    member_id
  end

  def map_role(role)
    case role.to_s
    when "owner"     then "owner"
    when "admin"     then "admin"
    when "editor"    then "member"
    when "moderator" then "member"
    else                  "member"
    end
  end

  def exec_count(table)
    ActiveRecord::Base.connection.execute("SELECT COUNT(*) AS c FROM #{table}").first["c"]
  end

  def exec_exists?(table, col, val)
    row = ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql(["SELECT 1 FROM #{table} WHERE #{col} = ? LIMIT 1", val])
    ).first
    !row.nil?
  end
end

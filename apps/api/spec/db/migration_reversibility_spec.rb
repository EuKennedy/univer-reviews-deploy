require "rails_helper"

# Premium-CI gate: every committed migration must be reversible. A team
# that ships irreversible migrations (no `def down`, raw `execute` with
# no rollback path, default values backfilled inline) eventually paints
# itself into a corner — bug in prod, can't roll back the offending
# release.
#
# Spec is opt-in via CI_FULL=1. Plain CI runs the rest of the suite
# without this gate so PR feedback stays fast; the main branch push
# and `[full ci]`-flagged PRs flip it on.
RSpec.describe "DB · migration reversibility", type: :db do
  it "every migration past the initial baseline rolls down and up cleanly" do
    skip "Set CI_FULL=1 to run reversibility checks" unless ENV["CI_FULL"] == "1"

    # Rails 8.1 dropped `connection.migration_context`. Use the modern
    # `connection_pool.migration_context` (Rails 8.0+) so this works on
    # the current stack. If we ever go back to Rails < 7.2, swap to
    # `ActiveRecord::Base.connection.migration_context`.
    pool = ActiveRecord::Base.connection_pool
    context = if pool.respond_to?(:migration_context)
                pool.migration_context
              else
                ActiveRecord::Base.connection.migration_context
              end

    migrations = context.migrations

    # Skip the initial baseline — it's a kitchen-sink migration that
    # legitimately can't be replayed without dropping the whole DB.
    baseline_version = migrations.first&.version
    targets = migrations.reject { |m| m.version == baseline_version }

    targets.each do |migration|
      original_version = migration.version

      context.run(:down, original_version)
      status = context.migrations_status.find { |_, v| v.to_s == original_version.to_s }
      expect(status&.first).to eq("down"),
        "Migration #{migration.name} (#{original_version}) failed to roll down"

      context.run(:up, original_version)
      status = context.migrations_status.find { |_, v| v.to_s == original_version.to_s }
      expect(status&.first).to eq("up"),
        "Migration #{migration.name} (#{original_version}) failed to roll back up"
    end
  end
end

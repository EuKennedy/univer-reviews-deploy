require "rails_helper"

# Premium-CI gate: every committed migration must be reversible. A team
# that ships irreversible migrations (no `def down`, raw `execute` with
# no rollback path, default values backfilled inline) eventually paints
# itself into a corner — bug in prod, can't roll back the offending
# release.
#
# This spec discovers every migration version that's currently APPLIED
# beyond the initial schema and walks each one through down/up cycle.
# It runs ONLY when CI_FULL=1 because rebuilding the schema is slow.
# Plain CI runs the rest of the suite without this gate so PR feedback
# stays fast; the nightly schedule (or `[full ci]` PR title) flips it on.
RSpec.describe "DB · migration reversibility", type: :db do
  it "every migration past the initial baseline rolls down and up cleanly" do
    skip "Set CI_FULL=1 to run reversibility checks" unless ENV["CI_FULL"] == "1"

    context = ActiveRecord::Base.connection.migration_context
    migrations = context.migrations

    # Skip the initial baseline — it's a kitchen-sink migration that
    # legitimately can't be replayed without dropping the whole DB.
    baseline_version = migrations.first&.version
    targets = migrations.reject { |m| m.version == baseline_version }

    targets.each do |migration|
      original_version = migration.version

      context.run(:down, original_version)
      expect(context.migrations_status.find { |_, v| v.to_s == original_version.to_s }&.first).to eq("down"),
        "Migration #{migration.name} (#{original_version}) failed to roll down"

      context.run(:up, original_version)
      expect(context.migrations_status.find { |_, v| v.to_s == original_version.to_s }&.first).to eq("up"),
        "Migration #{migration.name} (#{original_version}) failed to roll back up"
    end
  end
end

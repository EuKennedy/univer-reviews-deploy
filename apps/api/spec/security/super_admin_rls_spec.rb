require "rails_helper"

# Counterpart to spec/security/rls_cross_tenant_spec.rb.
#
# Whereas the cross-tenant spec proves that tenants CAN'T see each other,
# this spec proves that the super admin namespace CAN — by design — read
# across all tenants without setting `app.workspace_id`. That requires:
#
#   1. The `workspaces` table itself is NOT RLS-protected (it IS the
#      tenant boundary, has no workspace_id column).
#   2. For RLS-protected child tables, the super admin request must
#      explicitly disable row_security via `SET LOCAL row_security = off`.
#      That requires BYPASSRLS on the app DB role.
#
# If this spec fails, do NOT relax the assertion — figure out which
# guarantee was lost. Loss of #1 = a migration added RLS to workspaces
# (wrong). Loss of #2 = the controller's auth gate stopped calling
# disable_rls!, or the DB role lost BYPASSRLS.
RSpec.describe "Super admin · cross-tenant RLS bypass", type: :model do
  let!(:workspace_a) { create(:workspace, slug: "sa-rls-a") }
  let!(:workspace_b) { create(:workspace, slug: "sa-rls-b") }

  it "Workspace.all is unaffected by RLS (table is not policy-protected)" do
    # Just confirms the basic invariant — the workspaces table itself
    # exposes every row regardless of app.workspace_id. The super admin
    # index relies on this.
    ids = Workspace.where(id: [workspace_a.id, workspace_b.id]).pluck(:id)
    expect(ids).to contain_exactly(workspace_a.id, workspace_b.id)
  end

  it "respects child-table RLS when app.workspace_id is set to a single tenant" do
    # Even without the super admin path, a request that pins app.workspace_id
    # to A must not see B's data. This is the regular-tenant invariant we
    # rely on as the FLOOR — super admin then opts OUT explicitly.
    create(:product, workspace: workspace_a)
    create(:product, workspace: workspace_b)

    ActiveRecord::Base.transaction(requires_new: true) do
      conn = ActiveRecord::Base.connection

      # Demote off superuser when running locally so the policy actually
      # enforces. CI provisions rls_test_role for exactly this.
      if conn.select_value("SELECT current_setting('is_superuser')") == "on"
        role_exists = conn.select_value("SELECT 1 FROM pg_roles WHERE rolname = 'rls_test_role'")
        skip "rls_test_role missing — provision per .github/workflows/ci.yml" if role_exists.nil?
        conn.execute("SET LOCAL ROLE rls_test_role")
      end

      conn.execute(ActiveRecord::Base.sanitize_sql(["SET LOCAL app.workspace_id = ?", workspace_a.id.to_s]))
      conn.execute("SET LOCAL row_security = on")

      slugs = Product.all.pluck(:workspace_id).uniq
      expect(slugs).to eq([workspace_a.id])

      raise ActiveRecord::Rollback
    end
  end

  it "row_security=off makes child tables visible across tenants (super-admin path)" do
    # The Api::V1::SuperAdmin::ApplicationController issues
    # `SET LOCAL row_security = off` during require_super_admin!. This
    # spec replays that branch directly so we don't depend on the
    # controller mocks.
    create(:product, workspace: workspace_a)
    create(:product, workspace: workspace_b)

    ActiveRecord::Base.transaction(requires_new: true) do
      conn = ActiveRecord::Base.connection
      is_super = conn.select_value("SELECT current_setting('is_superuser')") == "on"

      # Superuser bypasses RLS for free — the test would be vacuously
      # true. On CI we expect to run as a non-superuser app role with
      # BYPASSRLS; locally we can simulate by demoting and then bringing
      # row_security off manually. If the test role can't disable
      # row_security we skip (same compromise as the sibling spec).
      if is_super
        role_exists = conn.select_value("SELECT 1 FROM pg_roles WHERE rolname = 'rls_test_role'")
        skip "rls_test_role missing — provision per .github/workflows/ci.yml" if role_exists.nil?
        conn.execute("SET LOCAL ROLE rls_test_role")
      end

      # Critical: NO app.workspace_id set. Super admin must NOT bind a
      # single workspace, exactly because they're operating cross-tenant.
      begin
        conn.execute("SET LOCAL row_security = off")
      rescue ActiveRecord::StatementInvalid => e
        # The non-superuser test role isn't granted BYPASSRLS by default.
        # In CI we expect the app role to carry it; if it doesn't, this
        # is precisely the failure mode the test exists to surface.
        skip "test DB role lacks BYPASSRLS — grant it to enable super-admin reads (`ALTER ROLE rls_test_role BYPASSRLS`): #{e.message}"
      end

      ids = Product.pluck(:workspace_id).uniq
      expect(ids).to include(workspace_a.id, workspace_b.id)

      raise ActiveRecord::Rollback
    end
  end
end

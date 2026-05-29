require "rails_helper"

RSpec.describe Api::V1::SuperAdmin::WorkspacesController, type: :request do
  # The super admin namespace authenticates via Better Auth session
  # cookie/bearer (role='admin'). We don't want to spin up a real
  # `auth.user` row + signed cookie pipeline for every test — that's
  # already covered by the integration suite. Here we stub the
  # `require_super_admin!` gate to assert one of three personas:
  #   - :admin     → role='admin', proceeds
  #   - :non_admin → role='user',  blocked with 404
  #   - :anonymous → no session,   blocked with 404
  let(:headers) do
    {
      "Content-Type" => "application/json",
      "Accept"       => "application/json",
    }
  end

  # Faux Better Auth user. The controller's auth gate only reads
  # `.respond_to?(:role)` + `.role` + `.id` + `.email`, so a Struct mirrors
  # the surface without booting the auth.user table.
  let(:admin_user)    { Struct.new(:id, :email, :role).new("ba_admin", "founder@example.com", "admin") }
  let(:regular_user)  { Struct.new(:id, :email, :role).new("ba_user", "joe@example.com", "user") }

  def stub_super_admin(user)
    # Replace the gate so we can flip personas without touching cookies.
    # We still exercise the controller's transaction wrapper + audit log
    # records, so the rest of the request lifecycle is real.
    allow_any_instance_of(Api::V1::SuperAdmin::ApplicationController)
      .to receive(:require_super_admin!) do |ctrl|
        if user.nil?
          ctrl.send(:head, :not_found)
        elsif user.role != "admin"
          ctrl.send(:head, :not_found)
        else
          ctrl.instance_variable_set(:@current_ba_user, user)
        end
      end
    # The RLS bypass call would require BYPASSRLS in the test DB. Stub
    # it out so the spec runs against the standard `postgres` role.
    allow_any_instance_of(Api::V1::SuperAdmin::ApplicationController)
      .to receive(:disable_rls!)
  end

  describe "GET /api/v1/super_admin/workspaces" do
    let!(:ws_a) { create(:workspace, slug: "tenant-a", name: "Tenant A", plan: "medium", status: "active") }
    let!(:ws_b) { create(:workspace, slug: "tenant-b", name: "Tenant B", plan: "ultra",  status: "trial") }
    let!(:ws_c) { create(:workspace, slug: "tenant-c", name: "Tenant C", plan: "entry",  status: "suspended") }

    it "404s for non-admin Better Auth users (route is invisible)" do
      stub_super_admin(regular_user)
      get "/api/v1/super_admin/workspaces", headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "404s for unauthenticated requests (route is invisible)" do
      stub_super_admin(nil)
      get "/api/v1/super_admin/workspaces", headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "200s for admins and lists every workspace across tenants" do
      stub_super_admin(admin_user)
      get "/api/v1/super_admin/workspaces", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      slugs = body["data"].map { |r| r["slug"] }
      expect(slugs).to include("tenant-a", "tenant-b", "tenant-c")
      # MRR rolled up in BRL (the merchant pays us in BRL). AI cost stays
      # in USD because Anthropic bills us in USD — see aggregate_stats
      # comment in the controller.
      expect(body["meta"]).to include("total_workspaces", "mrr_estimate_brl", "ai_cost_month_usd", "currency")
    end

    it "filters by plan (entry/medium/ultra)" do
      stub_super_admin(admin_user)
      get "/api/v1/super_admin/workspaces", params: { plan: "ultra" }, headers: headers
      expect(response).to have_http_status(:ok)
      labels = JSON.parse(response.body)["data"].map { |r| r["plan_label"] }
      expect(labels).to all(eq("ultra"))
    end

    it "filters by status" do
      stub_super_admin(admin_user)
      get "/api/v1/super_admin/workspaces", params: { status: "suspended" }, headers: headers
      slugs = JSON.parse(response.body)["data"].map { |r| r["slug"] }
      expect(slugs).to eq(["tenant-c"])
    end
  end

  describe "POST /api/v1/super_admin/workspaces/:id/suspend" do
    let!(:ws) { create(:workspace, slug: "victim", status: "active") }

    it "updates status + writes audit row tagged super_admin.workspace.suspended" do
      stub_super_admin(admin_user)

      expect {
        post "/api/v1/super_admin/workspaces/#{ws.id}/suspend", headers: headers
      }.to change { AuditLog.where(workspace_id: ws.id, action: "super_admin.workspace.suspended").count }.by(1)

      expect(response).to have_http_status(:ok)
      expect(ws.reload.status).to eq("suspended")

      audit = AuditLog.where(workspace_id: ws.id, action: "super_admin.workspace.suspended").last
      expect(audit.metadata["previous_status"]).to eq("active")
      expect(audit.metadata["actor_email"]).to eq("founder@example.com")
    end

    it "404s for non-admin" do
      stub_super_admin(regular_user)
      post "/api/v1/super_admin/workspaces/#{ws.id}/suspend", headers: headers
      expect(response).to have_http_status(:not_found)
      expect(ws.reload.status).to eq("active")
    end
  end

  describe "POST /api/v1/super_admin/workspaces/:id/switch_plan" do
    let!(:ws) { create(:workspace, plan: "entry") }

    it "updates the plan and writes an audit row" do
      stub_super_admin(admin_user)
      expect {
        post "/api/v1/super_admin/workspaces/#{ws.id}/switch_plan",
             params: { plan: "ultra" }.to_json,
             headers: headers
      }.to change { AuditLog.where(action: "super_admin.workspace.plan_switched").count }.by(1)

      expect(response).to have_http_status(:ok)
      expect(ws.reload.plan).to eq("ultra")

      audit = AuditLog.where(action: "super_admin.workspace.plan_switched").last
      expect(audit.metadata).to include("previous_plan" => "entry", "new_plan" => "ultra")
    end

    it "rejects unknown plan slugs with 400" do
      stub_super_admin(admin_user)
      post "/api/v1/super_admin/workspaces/#{ws.id}/switch_plan",
           params: { plan: "platinum" }.to_json,
           headers: headers
      expect(response).to have_http_status(:bad_request)
    end

    it "rejects the legacy plan slugs explicitly (pro/starter/enterprise) — those are gone" do
      stub_super_admin(admin_user)
      post "/api/v1/super_admin/workspaces/#{ws.id}/switch_plan",
           params: { plan: "pro" }.to_json,
           headers: headers
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "DELETE /api/v1/super_admin/workspaces/:id/soft_destroy" do
    let!(:ws) { create(:workspace) }

    it "blocks if the acting admin is a member (self-target safety)" do
      # Set up a workspace_user row owned by the faux admin's better-auth id.
      create(:workspace_user, workspace: ws, better_auth_user_id: admin_user.id, email: "founder@example.com")

      stub_super_admin(admin_user)
      delete "/api/v1/super_admin/workspaces/#{ws.id}/soft_destroy", headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("self_target")
      expect(ws.reload.status).not_to eq("suspended")
    end

    it "soft-deletes when not a member and writes audit" do
      stub_super_admin(admin_user)
      # `force=1` lives on the query string so we don't fight the
      # `Content-Type: application/json` header (which makes Rails attempt
      # to parse the request body — a urlencoded `force=1` would explode
      # the JSON parser).
      delete "/api/v1/super_admin/workspaces/#{ws.id}/soft_destroy?force=1",
             headers: headers
      expect(response).to have_http_status(:ok)
      expect(ws.reload.status).to eq("suspended")
      expect(AuditLog.where(action: "super_admin.workspace.soft_deleted").count).to eq(1)
    end
  end
end

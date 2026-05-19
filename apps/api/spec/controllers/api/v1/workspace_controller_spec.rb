require "rails_helper"

RSpec.describe Api::V1::WorkspaceController, type: :request do
  let!(:workspace)  { create(:workspace) }
  let!(:raw_key)    { "unvr_#{SecureRandom.hex(32)}" }
  let!(:api_key) do
    create(:workspace_api_key,
           workspace: workspace,
           key_hash: Digest::SHA256.hexdigest(raw_key),
           key_prefix: raw_key[0, 8])
  end

  let(:headers) do
    {
      "Authorization" => "Bearer #{raw_key}",
      "Content-Type"  => "application/json",
      "Accept"        => "application/json"
    }
  end

  before do
    # Bypass RLS for tests — same pattern as reviews_controller_spec.
    allow_any_instance_of(ApplicationController).to receive(:set_rls_workspace)
  end

  describe "GET /api/v1/workspace" do
    let!(:owner)     { create(:workspace_user, :owner, workspace: workspace, email: "owner@example.com", name: "Alice") }
    let!(:moderator) { create(:workspace_user, workspace: workspace, email: "mod@example.com", name: "Bob", role: "moderator") }
    let!(:other_workspace_user) { create(:workspace_user) } # belongs to a different workspace; must not leak

    it "returns the workspace envelope including its members" do
      get "/api/v1/workspace", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body).to have_key("data")

      data = body["data"]
      expect(data["id"]).to eq(workspace.id)
      expect(data["slug"]).to eq(workspace.slug)

      # Users array is present and ordered created_at asc.
      expect(data["users"]).to be_an(Array)
      expect(data["users"].length).to eq(2)

      emails = data["users"].map { |u| u["email"] }
      expect(emails).to contain_exactly("owner@example.com", "mod@example.com")
      # Ordering: owner was inserted first, so it comes first.
      expect(data["users"].first["email"]).to eq("owner@example.com")
    end

    it "serializes each user with the expected shape" do
      create(:workspace_user, :owner, workspace: workspace, email: "owner@example.com", name: "Alice")
      get "/api/v1/workspace", headers: headers

      body = JSON.parse(response.body)
      user = body.dig("data", "users").find { |u| u["email"] == "owner@example.com" }
      expect(user).to include(
        "id", "email", "name", "role",
        "last_seen_at", "avatar_url", "created_at"
      )
      expect(user["role"]).to eq("owner")
      expect(user["avatar_url"]).to be_nil
    end

    it "does not leak users from other workspaces" do
      get "/api/v1/workspace", headers: headers
      body = JSON.parse(response.body)
      emails = body.dig("data", "users").map { |u| u["email"] }
      expect(emails).not_to include(other_workspace_user.email)
    end
  end
end

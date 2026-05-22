require "rails_helper"

RSpec.describe Api::V1::LoyaltyController, type: :request do
  let!(:workspace) { create(:workspace) }
  let!(:raw_key)   { "unvr_#{SecureRandom.hex(32)}" }
  let!(:api_key) do
    create(:workspace_api_key,
           workspace: workspace,
           key_hash: Digest::SHA256.hexdigest(raw_key),
           key_prefix: raw_key[0, 8],
           scopes: %w[read write])
  end

  let(:headers) do
    {
      "Authorization" => "Bearer #{raw_key}",
      "Content-Type"  => "application/json",
      "Accept"        => "application/json",
    }
  end

  before do
    allow_any_instance_of(ApplicationController).to receive(:set_rls_workspace)
  end

  describe "GET /api/v1/loyalty" do
    it "returns empty + plugin_connected=false when nothing synced" do
      get "/api/v1/loyalty", headers: headers
      body = JSON.parse(response.body)

      expect(response).to have_http_status(:ok)
      expect(body["data"]).to eq([])
      expect(body["meta"]["plugin_connected"]).to be(false)
    end

    it "returns synced configs ordered by priority desc" do
      LoyaltyConfig.create!(workspace:, source_campaign_id: 1, name: "lower", base_points: 10, priority: 1)
      LoyaltyConfig.create!(workspace:, source_campaign_id: 2, name: "higher", base_points: 20, priority: 10)

      get "/api/v1/loyalty", headers: headers
      body = JSON.parse(response.body)

      expect(body["data"].map { |d| d["name"] }).to eq(%w[higher lower])
      expect(body["meta"]["count"]).to eq(2)
      expect(body["meta"]["plugin_connected"]).to be(true)
    end

    it "does not leak configs from other workspaces" do
      other_ws = create(:workspace)
      LoyaltyConfig.create!(workspace: other_ws, source_campaign_id: 99, name: "other", base_points: 999)
      LoyaltyConfig.create!(workspace:, source_campaign_id: 1, name: "mine", base_points: 10)

      get "/api/v1/loyalty", headers: headers
      body = JSON.parse(response.body)

      expect(body["data"].map { |d| d["name"] }).to eq(%w[mine])
    end
  end
end

require "rails_helper"

RSpec.describe Api::V1::Wp::LoyaltyController, type: :request do
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
    # Same pattern as reviews_controller_spec — bypass RLS for tests so the
    # spec can read across the create/find boundary without re-setting
    # app.workspace_id manually.
    allow_any_instance_of(ApplicationController).to receive(:set_rls_workspace)
  end

  describe "PUT /api/v1/wp/loyalty/sync" do
    let(:payload) do
      {
        campaign_id:    42,
        name:           "Avaliação com pontos",
        description:    "Crédito de pontos por avaliação aprovada",
        is_active:      true,
        rule_type:      "review_tiers",
        points_text:    100,
        points_photo:   200,
        points_video:   300,
        min_chars:      50,
        only_logged_in: true,
        bonus_verified: 50,
        priority:       1,
      }
    end

    it "creates a new loyalty_config on first push" do
      expect {
        put "/api/v1/wp/loyalty/sync", params: payload.to_json, headers: headers
      }.to change { LoyaltyConfig.count }.by(1)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["data"]["source_campaign_id"]).to eq(42)
      expect(body["data"]["points_text"]).to eq(100)
      expect(body["data"]["points_photo"]).to eq(200)
      expect(body["data"]["points_video"]).to eq(300)
      expect(body["data"]["bonus_verified"]).to eq(50)
    end

    it "updates an existing config on repeat push (upsert)" do
      put "/api/v1/wp/loyalty/sync", params: payload.to_json, headers: headers
      expect {
        put "/api/v1/wp/loyalty/sync",
            params: payload.merge(points_video: 500).to_json,
            headers: headers
      }.not_to change { LoyaltyConfig.count }

      config = LoyaltyConfig.find_by(workspace: workspace, source_campaign_id: 42)
      expect(config.points_video).to eq(500)
    end

    it "rejects negative values via clamp + DB constraint" do
      put "/api/v1/wp/loyalty/sync",
          params: payload.merge(points_photo: -5).to_json,
          headers: headers
      config = LoyaltyConfig.find_by(workspace: workspace, source_campaign_id: 42)
      expect(config.points_photo).to eq(0)
    end

    it "backfills tier values from legacy schema when tier fields are absent" do
      legacy = payload.except(:rule_type, :points_text, :points_photo, :points_video)
                      .merge(base_points: 50, bonus_photo: 10, bonus_video: 25)
      put "/api/v1/wp/loyalty/sync", params: legacy.to_json, headers: headers

      config = LoyaltyConfig.find_by(workspace: workspace, source_campaign_id: 42)
      expect(config.points_text).to  eq(50)
      expect(config.points_photo).to eq(60)
      expect(config.points_video).to eq(75)
    end

    it "rejects when campaign_id is missing or zero" do
      put "/api/v1/wp/loyalty/sync",
          params: payload.merge(campaign_id: 0).to_json,
          headers: headers
      expect(response).to have_http_status(:bad_request)
    end

    it "does not leak between workspaces" do
      put "/api/v1/wp/loyalty/sync", params: payload.to_json, headers: headers

      # New workspace with its own key — same source_campaign_id.
      other_ws = create(:workspace)
      other_raw = "unvr_#{SecureRandom.hex(32)}"
      create(:workspace_api_key,
             workspace: other_ws,
             key_hash: Digest::SHA256.hexdigest(other_raw),
             key_prefix: other_raw[0, 8],
             scopes: %w[read write])

      put "/api/v1/wp/loyalty/sync",
          params: payload.merge(base_points: 999).to_json,
          headers: headers.merge("Authorization" => "Bearer #{other_raw}")

      first  = LoyaltyConfig.find_by(workspace: workspace, source_campaign_id: 42)
      second = LoyaltyConfig.find_by(workspace: other_ws, source_campaign_id: 42)

      expect(first.base_points).to eq(50)
      expect(second.base_points).to eq(999)
    end
  end

  describe "DELETE /api/v1/wp/loyalty/:source_campaign_id" do
    it "deletes the matching config and returns 204" do
      LoyaltyConfig.create!(
        workspace:          workspace,
        source_campaign_id: 7,
        name:               "x",
        base_points:        10,
      )
      expect {
        delete "/api/v1/wp/loyalty/7", headers: headers
      }.to change { LoyaltyConfig.count }.by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it "returns 204 when not found (idempotent)" do
      delete "/api/v1/wp/loyalty/999", headers: headers
      expect(response).to have_http_status(:no_content)
    end
  end
end

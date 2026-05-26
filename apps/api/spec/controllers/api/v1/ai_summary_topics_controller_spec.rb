require "rails_helper"

RSpec.describe Api::V1::AiSummaryTopicsController, type: :request do
  let!(:workspace) { create(:workspace) }
  let!(:product)   { create(:product, workspace: workspace) }
  let!(:raw_key)   { "unvr_#{SecureRandom.hex(32)}" }
  let!(:api_key) do
    create(:workspace_api_key,
           workspace: workspace,
           key_hash:  Digest::SHA256.hexdigest(raw_key),
           key_prefix: raw_key[0, 8],
           scopes:    "read,write")
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

  describe "GET /api/v1/ai_summary_topics" do
    it "requires product_id" do
      get "/api/v1/ai_summary_topics", headers: headers
      expect(response).to have_http_status(:bad_request)
    end

    it "returns topics ordered by position" do
      a = create(:ai_summary_topic, workspace: workspace, product: product, position: 2, title: "C")
      b = create(:ai_summary_topic, workspace: workspace, product: product, position: 0, title: "A")
      c = create(:ai_summary_topic, workspace: workspace, product: product, position: 1, title: "B")

      get "/api/v1/ai_summary_topics", params: { product_id: product.id }, headers: headers

      expect(response).to have_http_status(:ok)
      titles = JSON.parse(response.body)["data"].map { |t| t["title"] }
      expect(titles).to eq(%w[A B C])
    end

    it "scopes by workspace (no cross-tenant leak)" do
      other_ws      = create(:workspace)
      other_product = create(:product, workspace: other_ws)
      create(:ai_summary_topic, workspace: other_ws, product: other_product, title: "Leaked?")
      create(:ai_summary_topic, workspace: workspace, product: product, title: "Visible")

      get "/api/v1/ai_summary_topics", params: { product_id: product.id }, headers: headers

      titles = JSON.parse(response.body)["data"].map { |t| t["title"] }
      expect(titles).to eq(%w[Visible])
    end
  end

  describe "POST /api/v1/ai_summary_topics" do
    let(:r1) { create(:review, :approved, workspace: workspace, product: product, rating: 5) }
    let(:r2) { create(:review, :approved, workspace: workspace, product: product, rating: 4) }

    it "creates a manual topic and attaches initial reviews" do
      payload = { product_id: product.id, title: "Cabelo brilhoso", review_ids: [r1.id, r2.id] }

      expect {
        post "/api/v1/ai_summary_topics", params: payload.to_json, headers: headers
      }.to change { AiSummaryTopic.count }.by(1)

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)["data"]
      expect(body["title"]).to eq("Cabelo brilhoso")
      expect(body["source"]).to eq("manual")
      expect(body["review_count"]).to eq(2)
      expect(body["stars_avg"].to_f).to eq(4.5)
      expect(body["reviews"].length).to eq(2)
    end

    it "auto-increments position per product" do
      post "/api/v1/ai_summary_topics", params: { product_id: product.id, title: "A" }.to_json, headers: headers
      post "/api/v1/ai_summary_topics", params: { product_id: product.id, title: "B" }.to_json, headers: headers

      positions = AiSummaryTopic.where(product: product).order(:position).pluck(:position)
      expect(positions).to eq([0, 1])
    end

    it "rejects an empty title with 422" do
      post "/api/v1/ai_summary_topics",
           params: { product_id: product.id, title: "" }.to_json,
           headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/ai_summary_topics/:id" do
    let!(:topic) { create(:ai_summary_topic, workspace: workspace, product: product, title: "Antigo") }

    it "updates title and position" do
      patch "/api/v1/ai_summary_topics/#{topic.id}",
            params: { ai_summary_topic: { title: "Novo título", position: 9 } }.to_json,
            headers: headers
      expect(response).to have_http_status(:ok)
      topic.reload
      expect(topic.title).to eq("Novo título")
      expect(topic.position).to eq(9)
    end
  end

  describe "DELETE /api/v1/ai_summary_topics/:id" do
    let!(:topic) { create(:ai_summary_topic, workspace: workspace, product: product) }

    it "destroys the topic and returns 204" do
      expect {
        delete "/api/v1/ai_summary_topics/#{topic.id}", headers: headers
      }.to change { AiSummaryTopic.count }.by(-1)
      expect(response).to have_http_status(:no_content)
    end
  end

  describe "POST /api/v1/ai_summary_topics/:id/attach_reviews" do
    let!(:topic) { create(:ai_summary_topic, workspace: workspace, product: product) }
    let!(:r1)    { create(:review, :approved, workspace: workspace, product: product, rating: 5) }
    let!(:r2)    { create(:review, :approved, workspace: workspace, product: product, rating: 3) }

    it "attaches and returns the updated count" do
      post "/api/v1/ai_summary_topics/#{topic.id}/attach_reviews",
           params: { review_ids: [r1.id, r2.id] }.to_json,
           headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["attached"]).to eq(2)
      expect(body["data"]["review_count"]).to eq(2)
      expect(body["data"]["stars_avg"].to_f).to eq(4.0)
    end

    it "is idempotent (attached=0 on repeat)" do
      topic.attach_reviews!([r1.id])
      post "/api/v1/ai_summary_topics/#{topic.id}/attach_reviews",
           params: { review_ids: [r1.id] }.to_json,
           headers: headers
      expect(JSON.parse(response.body)["attached"]).to eq(0)
    end
  end

  describe "POST /api/v1/ai_summary_topics/:id/detach_reviews" do
    let!(:topic) { create(:ai_summary_topic, workspace: workspace, product: product) }
    let!(:r1)    { create(:review, :approved, workspace: workspace, product: product) }
    let!(:r2)    { create(:review, :approved, workspace: workspace, product: product) }

    before { topic.attach_reviews!([r1.id, r2.id]) }

    it "detaches specified reviews" do
      post "/api/v1/ai_summary_topics/#{topic.id}/detach_reviews",
           params: { review_ids: [r1.id] }.to_json,
           headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["detached"]).to eq(1)
      expect(body["data"]["review_count"]).to eq(1)
    end
  end

  describe "auth gating" do
    let!(:read_key_raw) { "unvr_#{SecureRandom.hex(32)}" }
    let!(:read_key) do
      create(:workspace_api_key,
             workspace:  workspace,
             key_hash:   Digest::SHA256.hexdigest(read_key_raw),
             key_prefix: read_key_raw[0, 8],
             scopes:     "read")
    end
    let(:read_headers) { headers.merge("Authorization" => "Bearer #{read_key_raw}") }

    it "blocks write actions for read-only keys" do
      post "/api/v1/ai_summary_topics",
           params: { product_id: product.id, title: "Nope" }.to_json,
           headers: read_headers
      expect(response.status).to be_in([401, 403])
    end
  end
end

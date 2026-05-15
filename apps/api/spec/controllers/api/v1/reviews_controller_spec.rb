require "rails_helper"

RSpec.describe Api::V1::ReviewsController, type: :request do
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
    # Bypass RLS for tests
    allow_any_instance_of(ApplicationController).to receive(:set_rls_workspace)
  end

  describe "GET /api/v1/reviews" do
    let!(:review1) { create(:review, :approved, workspace: workspace) }
    let!(:review2) { create(:review, workspace: workspace) }
    let!(:other_review) { create(:review, :approved) }

    it "returns paginated reviews for the workspace" do
      get "/api/v1/reviews", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["data"].length).to eq(2)
      expect(body["meta"]).to include("total_count", "per_page")
    end

    it "filters by status" do
      get "/api/v1/reviews?status=approved", headers: headers
      body = JSON.parse(response.body)
      expect(body["data"].length).to eq(1)
      expect(body["data"].first["status"]).to eq("approved")
    end

    it "returns 401 with invalid API key" do
      get "/api/v1/reviews", headers: { "Authorization" => "Bearer invalid" }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/reviews" do
    let(:product) { create(:product, workspace: workspace) }

    it "creates a review and enqueues moderation" do
      expect(AiModerateJob).to receive(:perform_later)

      post "/api/v1/reviews",
           headers: headers,
           params: {
             review: {
               product_id: product.id,
               rating: 5,
               body: "Excellent product!",
               author_name: "João",
               source: "widget"
             }
           }.to_json

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["data"]["rating"]).to eq(5)
    end

    it "returns 422 for invalid rating" do
      post "/api/v1/reviews",
           headers: headers,
           params: { review: { rating: 10, body: "test" } }.to_json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "POST /api/v1/reviews/:id/status" do
    let!(:review) { create(:review, workspace: workspace) }

    it "changes review status" do
      post "/api/v1/reviews/#{review.id}/status",
           headers: headers,
           params: { status: "approved" }.to_json

      expect(response).to have_http_status(:ok)
      expect(review.reload.status).to eq("approved")
    end

    it "returns 400 for invalid status" do
      post "/api/v1/reviews/#{review.id}/status",
           headers: headers,
           params: { status: "invalid_status" }.to_json

      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "POST /api/v1/reviews/bulk" do
    let!(:review1) { create(:review, workspace: workspace) }
    let!(:review2) { create(:review, workspace: workspace) }

    it "bulk approves reviews" do
      post "/api/v1/reviews/bulk",
           headers: headers,
           params: { ids: [review1.id, review2.id], action: "approve" }.to_json

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["updated"]).to eq(2)
    end
  end
end

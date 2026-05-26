require "rails_helper"

RSpec.describe Api::V1::Public::AiSummaryTopicsController, type: :request do
  let!(:workspace) { create(:workspace) }
  let!(:product)   { create(:product, workspace: workspace, handle: "kit-x", platform_product_id: "9999") }
  let!(:domain)    { create(:workspace_domain, workspace: workspace, domain: "shop.example.com") }

  let(:headers) { { "X-Univer-Domain" => "shop.example.com", "Accept" => "application/json" } }

  before do
    allow_any_instance_of(ApplicationController).to receive(:set_rls_workspace)
  end

  describe "GET /api/v1/public/ai-summary-topics/:product_id" do
    it "returns 404 when product is unknown" do
      get "/api/v1/public/ai-summary-topics/does-not-exist", headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "returns topics ordered by position with attached reviews" do
      t1 = create(:ai_summary_topic, workspace: workspace, product: product, title: "A", position: 0)
      t2 = create(:ai_summary_topic, workspace: workspace, product: product, title: "B", position: 1)
      r1 = create(:review, :approved, workspace: workspace, product: product, rating: 5, body: "Bom demais")
      r2 = create(:review, :approved, workspace: workspace, product: product, rating: 4, body: "Recomendo")
      t1.attach_reviews!([r1.id])
      t2.attach_reviews!([r2.id])

      get "/api/v1/public/ai-summary-topics/#{product.handle}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      titles = body["data"].map { |t| t["title"] }
      expect(titles).to eq(%w[A B])
      first_reviews = body["data"].first["reviews"]
      expect(first_reviews.length).to eq(1)
      expect(first_reviews.first["body"]).to eq("Bom demais")
    end

    it "accepts platform_product_id as identifier" do
      create(:ai_summary_topic, workspace: workspace, product: product, title: "X", position: 0)
      get "/api/v1/public/ai-summary-topics/9999", headers: headers
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["data"].length).to eq(1)
    end

    it "returns empty data array (not 404) when product has no topics" do
      get "/api/v1/public/ai-summary-topics/#{product.handle}", headers: headers
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["data"]).to eq([])
    end

    it "blocks requests without a known domain header" do
      get "/api/v1/public/ai-summary-topics/#{product.handle}",
          headers: { "X-Univer-Domain" => "evil.example.com", "Accept" => "application/json" }
      expect(response).to have_http_status(:not_found)
    end
  end
end

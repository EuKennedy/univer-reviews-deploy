require "rails_helper"

# AI bulk-generate → draft → edit → publish flow.
#
# Covers the new behavior added for the draft editor:
#   • bulk-create-reviews / -questions persist as `draft` (out of the
#     storefront AND the pending queue) with a gender-consistent author, and
#     return author_gender / author_avatar_url for the editor to render.
#   • reviews#update edits content + publishes (status=approved).
#   • questions#update full-edit path does NOT auto-publish; publishing
#     stamps answered_at.
#   • upload-author-photo returns a public proxy URL.
#
# Claude (Ai::GenerateService) and object storage are stubbed end-to-end.
RSpec.describe "AI draft flow", type: :request do
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
    # Plan-gate + AI budget are exercised elsewhere; no-op here.
    allow_any_instance_of(Api::V1::AiController).to receive(:require_feature!)
    allow_any_instance_of(Api::V1::AiController).to receive(:require_ai_budget!)
  end

  describe "POST /ai/bulk-create-reviews" do
    before do
      allow_any_instance_of(Ai::GenerateService).to receive(:call).and_return(
        [
          { rating: 5, title: "Ótimo", body: "Produto muito bom, recomendo demais." },
          { rating: 4, title: "Bom",   body: "Gostei bastante, chegou rápido." },
        ],
      )
    end

    it "persists as draft with a gender and returns gender + avatar fields" do
      post "/api/v1/ai/bulk-create-reviews",
           params: { product_id: product.id, count: 2 }.to_json, headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig("meta", "created")).to eq(2)

      body["data"].each do |r|
        expect(r["status"]).to eq("draft")
        expect(%w[female male]).to include(r["author_gender"])
        expect(r).to have_key("author_avatar_url")
      end

      expect(workspace.reviews.draft.count).to eq(2)
      # Drafts must NOT leak into the storefront (approved) or the queue (pending).
      expect(workspace.reviews.approved.count).to eq(0)
      expect(workspace.reviews.pending.count).to eq(0)
    end
  end

  describe "POST /ai/bulk-create-questions" do
    before do
      allow_any_instance_of(Ai::GenerateService).to receive(:generate_qa_pairs).and_return(
        [{ question: "É resistente?", answer: "Sim, muito durável." }],
      )
    end

    it "persists Q&A as draft with a gender" do
      post "/api/v1/ai/bulk-create-questions",
           params: { product_id: product.id, count: 1 }.to_json, headers: headers

      expect(response).to have_http_status(:ok)
      q = workspace.questions.draft.first
      expect(q).to be_present
      expect(%w[female male]).to include(q.author_gender)
    end
  end

  describe "PATCH /reviews/:id — edit + publish" do
    let!(:review) do
      create(:review, workspace: workspace, product: product, status: "draft", author_gender: "male")
    end

    it "edits the fields and publishes (approved + approved_at stamped)" do
      patch "/api/v1/reviews/#{review.id}",
            params: {
              review: { rating: 3, author_name: "Ana B.", author_gender: "female", status: "approved" },
            }.to_json,
            headers: headers

      expect(response).to have_http_status(:ok)
      review.reload
      expect(review.rating).to eq(3)
      expect(review.author_gender).to eq("female")
      expect(review.status).to eq("approved")
      expect(review.approved_at).to be_present
    end
  end

  describe "PATCH /questions/:id — full edit + publish" do
    let!(:question) do
      create(:question, workspace: workspace, product: product, status: "draft", answer: "resposta antiga")
    end

    it "edits body + answer WITHOUT auto-publishing" do
      patch "/api/v1/questions/#{question.id}",
            params: { question: { body: "Nova pergunta?", answer: "Nova resposta." } }.to_json,
            headers: headers

      expect(response).to have_http_status(:ok)
      question.reload
      expect(question.body).to eq("Nova pergunta?")
      expect(question.answer).to eq("Nova resposta.")
      expect(question.status).to eq("draft")
    end

    it "stamps answered_at when published" do
      patch "/api/v1/questions/#{question.id}",
            params: { question: { status: "published" } }.to_json, headers: headers

      question.reload
      expect(question.status).to eq("published")
      expect(question.answered_at).to be_present
    end
  end

  describe "POST /ai/upload-author-photo" do
    before do
      storage = instance_double(StorageService)
      allow(StorageService).to receive(:new).and_return(storage)
      allow(storage).to receive(:upload).and_return("stored")
    end

    it "stores the image and returns a public proxy URL" do
      file = Rack::Test::UploadedFile.new(
        StringIO.new("\xFF\xD8\xFFfakejpegbytes"), "image/jpeg", original_filename: "face.jpg"
      )

      post "/api/v1/ai/upload-author-photo",
           params: { file: file }, headers: { "Authorization" => "Bearer #{raw_key}" }

      expect(response).to have_http_status(:ok)
      url = JSON.parse(response.body).dig("data", "url")
      expect(url).to include("/api/v1/public/brand-assets/rating-icon/")
    end

    it "rejects a non-image upload" do
      file = Rack::Test::UploadedFile.new(
        StringIO.new("plain"), "text/plain", original_filename: "x.txt"
      )

      post "/api/v1/ai/upload-author-photo",
           params: { file: file }, headers: { "Authorization" => "Bearer #{raw_key}" }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("unsupported_type")
    end
  end
end

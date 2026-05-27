require "rails_helper"

# Request spec for POST /api/v1/ai/generate-summary-topics. Covers the
# replace/append modes, the MAX_AI_TOPICS_PER_PRODUCT cap, and the inline
# response shape the admin frontend depends on.
RSpec.describe "POST /api/v1/ai/generate-summary-topics", type: :request do
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
    # The job's RLS hook would otherwise need a real RLS-capable connection.
    allow_any_instance_of(AiGenerateSummaryTopicsJob).to receive(:set_workspace_rls)
  end

  def stub_service_call(topics)
    fake = instance_double(Ai::SummaryTopicsService, call: topics)
    allow(Ai::SummaryTopicsService).to receive(:new).and_return(fake)
    fake
  end

  describe "mode=replace (default)" do
    let!(:review) { create(:review, :approved, workspace: workspace, product: product, body: "Cheiro perfeito que dura o dia todo", rating: 5) }

    it "creates 1 topic, wipes prior AI topics, keeps manual ones, returns ai_count + ai_limit" do
      manual = create(:ai_summary_topic, workspace: workspace, product: product, title: "Manual", source: "manual", position: 0)
      old_ai = create(:ai_summary_topic, :ai, workspace: workspace, product: product, title: "Velho", position: 1)

      stub_service_call([
        { title: "Cheiro dura o dia inteiro", ai_summary: "Várias clientes destacam fixação.", review_ids: [review.id] },
      ])

      post "/api/v1/ai/generate-summary-topics",
           params: { product_id: product.id }.to_json,
           headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)

      expect(body["mode"]).to eq("replace")
      expect(body["ai_count"]).to eq(1)
      expect(body["ai_limit"]).to eq(AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT)
      expect(body["data"].length).to eq(2)  # manual + new ai

      expect(AiSummaryTopic.where(id: manual.id)).to exist
      expect(AiSummaryTopic.where(id: old_ai.id)).to be_empty
    end
  end

  describe "mode=append" do
    let!(:review) do
      create(:review, :approved,
             workspace: workspace,
             product:   product,
             body:      "Embalagem chegou bem caprichada, sem nenhum amassado.",
             rating:    5)
    end

    it "adds 1 topic and passes existing AI titles as exclude_titles" do
      existing = create(:ai_summary_topic, :ai, workspace: workspace, product: product, title: "Brilho marcante", position: 0)

      # instance_double doesn't support `and_call_original`. Re-stub :call
      # with the exact argument matcher we want to assert, returning the
      # canned payload directly. `expect(...).to receive` overrides the
      # earlier `allow(...).to receive` in `stub_service_call`.
      service = stub_service_call([])
      expect(service).to receive(:call)
        .with(product, max_topics: 1, exclude_titles: ["Brilho marcante"])
        .and_return([
          { title: "Embalagem caprichada", ai_summary: "Clientes elogiam apresentação.", review_ids: [review.id] },
        ])

      post "/api/v1/ai/generate-summary-topics",
           params: { product_id: product.id, mode: "append" }.to_json,
           headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["mode"]).to eq("append")
      expect(body["ai_count"]).to eq(2)
      expect(AiSummaryTopic.where(id: existing.id)).to exist
      expect(product.ai_summary_topics.where(source: "ai").pluck(:title))
        .to contain_exactly("Brilho marcante", "Embalagem caprichada")
    end

    it "returns 409 limit_reached when product already has MAX_AI_TOPICS_PER_PRODUCT AI topics" do
      AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT.times do |i|
        create(:ai_summary_topic, :ai, workspace: workspace, product: product, title: "T#{i}", position: i)
      end

      # Service must not be invoked when the cap blocks the request.
      expect(Ai::SummaryTopicsService).not_to receive(:new)

      post "/api/v1/ai/generate-summary-topics",
           params: { product_id: product.id, mode: "append" }.to_json,
           headers: headers

      expect(response).to have_http_status(:conflict)
      body = JSON.parse(response.body)
      expect(body["error"]).to eq("limit_reached")
      expect(body["limit"]).to eq(AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT)
      expect(body["current"]).to eq(AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT)
    end
  end

  describe "missing api key" do
    around do |example|
      original = ENV["ANTHROPIC_API_KEY"]
      ENV["ANTHROPIC_API_KEY"] = ""
      example.run
    ensure
      ENV["ANTHROPIC_API_KEY"] = original
    end

    it "returns 503 missing_api_key without invoking the service" do
      expect(Ai::SummaryTopicsService).not_to receive(:new)

      post "/api/v1/ai/generate-summary-topics",
           params: { product_id: product.id }.to_json,
           headers: headers

      expect(response).to have_http_status(:service_unavailable)
      expect(JSON.parse(response.body)["error"]).to eq("missing_api_key")
    end

    it "returns 503 missing_api_key when the env var is set to the placeholder" do
      ENV["ANTHROPIC_API_KEY"] = "SET_ME_LATER"

      post "/api/v1/ai/generate-summary-topics",
           params: { product_id: product.id }.to_json,
           headers: headers

      expect(response).to have_http_status(:service_unavailable)
    end
  end
end

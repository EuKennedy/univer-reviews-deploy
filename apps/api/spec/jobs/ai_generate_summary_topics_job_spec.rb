require "rails_helper"

RSpec.describe AiGenerateSummaryTopicsJob, type: :job do
  let(:workspace) { create(:workspace) }
  let(:product)   { create(:product, workspace: workspace) }

  before do
    # Bypass RLS in test so the job's set_workspace_rls becomes a no-op.
    allow_any_instance_of(described_class).to receive(:set_workspace_rls)
  end

  context "happy path" do
    let(:r1) { create(:review, :approved, workspace: workspace, product: product, body: "Brilho impressionante", rating: 5) }
    let(:r2) { create(:review, :approved, workspace: workspace, product: product, body: "Brilho lindo, primeiro uso", rating: 5) }
    let(:r3) { create(:review, :approved, workspace: workspace, product: product, body: "Demora 3 semanas pra ver resultado", rating: 4) }

    let(:fake_service) do
      instance_double(Ai::SummaryTopicsService, call: [
        { title: "Brilho marcante",    ai_summary: "Várias clientes destacam brilho imediato.", review_ids: [r1.id, r2.id] },
        { title: "Demora pra aparecer", ai_summary: "Alguns relatam efeito após semanas.",      review_ids: [r3.id] },
      ])
    end

    before do
      [r1, r2, r3]
      allow(Ai::SummaryTopicsService).to receive(:new).and_return(fake_service)
    end

    it "creates topics with source=ai and attaches the right reviews" do
      expect {
        described_class.perform_now(product.id)
      }.to change { AiSummaryTopic.count }.by(2)

      titles = product.ai_summary_topics.order(:position).pluck(:title)
      expect(titles).to eq(["Brilho marcante", "Demora pra aparecer"])

      first = product.ai_summary_topics.find_by(title: "Brilho marcante")
      expect(first.source).to eq("ai")
      expect(first.generated_at).to be_present
      expect(first.reviews).to contain_exactly(r1, r2)
      expect(first.review_count).to eq(2)
      expect(first.stars_avg).to eq(5.0)
    end

    it "replaces previous AI topics but keeps manual ones" do
      manual = create(:ai_summary_topic, workspace: workspace, product: product, title: "Manual", source: "manual", position: 0)
      old_ai = create(:ai_summary_topic, :ai, workspace: workspace, product: product, title: "Old AI", position: 1)

      described_class.perform_now(product.id)

      expect(AiSummaryTopic.where(id: manual.id)).to exist
      expect(AiSummaryTopic.where(id: old_ai.id)).to be_empty
      expect(product.ai_summary_topics.where(source: "ai").count).to eq(2)
    end
  end

  context "no reviews available" do
    let(:fake_service) { instance_double(Ai::SummaryTopicsService, call: []) }

    before do
      allow(Ai::SummaryTopicsService).to receive(:new).and_return(fake_service)
    end

    it "is a no-op (no topics created, no errors)" do
      expect {
        described_class.perform_now(product.id)
      }.not_to change { AiSummaryTopic.count }
    end
  end

  context "missing API key" do
    before do
      allow(Ai::SummaryTopicsService).to receive(:new)
        .and_raise(Ai::BaseService::MissingApiKeyError, "ANTHROPIC_API_KEY not configured")
    end

    it "logs a warning and returns without crashing" do
      expect(Rails.logger).to receive(:warn).with(/ANTHROPIC_API_KEY not configured/)
      expect { described_class.perform_now(product.id) }.not_to raise_error
    end
  end

  context "missing product" do
    it "warns and returns without raising" do
      expect { described_class.perform_now(SecureRandom.uuid) }.not_to raise_error
    end
  end

  context "append mode" do
    let(:r1) { create(:review, :approved, workspace: workspace, product: product, body: "Cheiro perfeito que dura o dia", rating: 5) }

    let(:fake_service) do
      instance_double(Ai::SummaryTopicsService, call: [
        { title: "Cheiro dura o dia inteiro", ai_summary: "Clientes destacam fixação.", review_ids: [r1.id] },
      ])
    end

    before do
      r1
      allow(Ai::SummaryTopicsService).to receive(:new).and_return(fake_service)
    end

    it "adds ONE topic on top of existing AI topics, keeping the old ones" do
      existing = create(:ai_summary_topic, :ai, workspace: workspace, product: product, title: "Já existente", position: 0)

      expect {
        described_class.perform_now(product.id, mode: :append)
      }.to change { product.ai_summary_topics.where(source: "ai").count }.from(1).to(2)

      expect(AiSummaryTopic.where(id: existing.id)).to exist
    end

    it "passes existing AI titles to the service so Claude can dedupe" do
      create(:ai_summary_topic, :ai, workspace: workspace, product: product, title: "Brilho marcante", position: 0)
      create(:ai_summary_topic, :ai, workspace: workspace, product: product, title: "Embalagem caprichada", position: 1)

      expect(fake_service).to receive(:call)
        .with(product, max_topics: 1, exclude_titles: a_collection_containing_exactly("Brilho marcante", "Embalagem caprichada"))
        .and_return([{ title: "Cheiro forte", ai_summary: "", review_ids: [r1.id] }])

      described_class.perform_now(product.id, mode: :append)
    end

    it "is a no-op when product already at MAX_AI_TOPICS_PER_PRODUCT cap" do
      AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT.times do |i|
        create(:ai_summary_topic, :ai, workspace: workspace, product: product, title: "Tópico #{i}", position: i)
      end

      expect(Ai::SummaryTopicsService).not_to receive(:new)

      expect {
        described_class.perform_now(product.id, mode: :append)
      }.not_to change { AiSummaryTopic.count }
    end
  end
end

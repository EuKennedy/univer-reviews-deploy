require "rails_helper"

# Service-layer spec. Stubs `call_claude` (inherited from Ai::BaseService) so
# the test never reaches the network, and verifies:
#   • default max_topics=1 + JSON parsing + UUID resolution
#   • max_topics > 1 returns multiple topics
#   • exclude_titles filters out duplicates (case-insensitive, punctuation
#     insensitive)
#   • empty product returns []
#   • topics referencing invalid review numbers are dropped
RSpec.describe Ai::SummaryTopicsService, type: :service do
  let(:workspace) { create(:workspace) }
  let(:product)   { create(:product, workspace: workspace) }

  # Bodies must be ≥40 chars — see SummaryTopicsService#pick_reviews which
  # filters out anything shorter so the spec'd reviews actually reach Claude.
  let!(:r1) { create(:review, :approved, workspace: workspace, product: product, body: "O cheiro é lindo e dura o dia todo, recomendo demais para o trabalho.", rating: 5) }
  let!(:r2) { create(:review, :approved, workspace: workspace, product: product, body: "Fixação muito boa, chegou na hora certa e veio bem embalado pela transportadora.", rating: 5) }
  let!(:r3) { create(:review, :approved, workspace: workspace, product: product, body: "Embalagem chegou impecável, sem nenhum amassado ou risco visível na caixa.", rating: 5) }

  subject(:service) { described_class.new(workspace) }

  def stub_claude_with(payload)
    allow_any_instance_of(described_class).to receive(:call_claude).and_return(payload.to_json)
  end

  describe "#call (default: max_topics=1)" do
    it "returns one topic with the review UUIDs resolved from the 1-indexed numbers" do
      stub_claude_with(topics: [
        { title: "Cheiro dura o dia inteiro", summary: "Várias clientes elogiam fixação.", reviews: [1, 2] },
      ])

      result = service.call(product)

      expect(result.length).to eq(1)
      expect(result[0][:title]).to eq("Cheiro dura o dia inteiro")
      expect(result[0][:ai_summary]).to include("fixação")
      expect(result[0][:review_ids]).to contain_exactly(r1.id, r2.id)
    end

    it "drops topics whose review_ids list resolves to empty" do
      stub_claude_with(topics: [
        { title: "Tópico real", summary: "ok", reviews: [1] },
        { title: "Tópico fantasma", summary: "ok", reviews: [99] }, # out of range
      ])

      result = service.call(product)

      expect(result.length).to eq(1)
      expect(result[0][:title]).to eq("Tópico real")
    end

    it "filters topics whose title matches an exclude_titles entry (case + punctuation insensitive)" do
      stub_claude_with(topics: [
        { title: "Cheiro dura o dia inteiro.", summary: "x", reviews: [1] },
      ])

      result = service.call(product, exclude_titles: ["cheiro dura o dia inteiro"])

      expect(result).to be_empty
    end

    it "preserves non-duplicate topics when exclude_titles is provided" do
      stub_claude_with(topics: [
        { title: "Embalagem caprichada", summary: "x", reviews: [3] },
      ])

      result = service.call(product, exclude_titles: ["Cheiro dura o dia"])

      expect(result.length).to eq(1)
      expect(result[0][:title]).to eq("Embalagem caprichada")
    end
  end

  describe "#call with max_topics > 1" do
    it "returns up to max_topics topics" do
      stub_claude_with(topics: [
        { title: "Cheiro",    summary: "a", reviews: [1, 2] },
        { title: "Embalagem", summary: "b", reviews: [3] },
        { title: "Bônus",     summary: "c", reviews: [1] },
      ])

      result = service.call(product, max_topics: 2)

      expect(result.length).to eq(2)
      expect(result.map { |t| t[:title] }).to eq(["Cheiro", "Embalagem"])
    end

    it "clamps max_topics to 6" do
      stub_claude_with(topics: (1..10).map { |i| { title: "t#{i}", summary: "s", reviews: [1] } })

      result = service.call(product, max_topics: 99)

      expect(result.length).to eq(6)
    end
  end

  describe "edge cases" do
    it "returns [] when the product has no reviewable bodies" do
      product.reviews.destroy_all

      result = service.call(product)
      expect(result).to eq([])
    end
  end
end

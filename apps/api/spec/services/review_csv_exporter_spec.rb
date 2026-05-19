require "rails_helper"
require "csv"

RSpec.describe ReviewCsvExporter do
  let(:workspace) { create(:workspace) }
  let(:other_ws)  { create(:workspace) }
  let(:product)   { create(:product, workspace: workspace, handle: "produto-teste", title: "Produto Teste") }

  subject(:exporter) { described_class.new(workspace) }

  def parse(csv_string)
    CSV.parse(csv_string, headers: true)
  end

  describe "#to_csv" do
    it "emits the documented header row" do
      table = parse(exporter.to_csv)
      expect(table.headers).to eq(ReviewCsvExporter::HEADERS)
    end

    it "scopes rows to the exporter's workspace only" do
      mine = create(:review, workspace: workspace, product: product, body: "Quero exportar")
      create(:review, workspace: other_ws, body: "Nao deveria sair")

      table = parse(exporter.to_csv)
      expect(table.length).to eq(1)
      expect(table[0]["id"]).to eq(mine.id)
    end

    it "fills product_handle and product_title from the joined product" do
      create(:review, workspace: workspace, product: product)
      table = parse(exporter.to_csv)
      expect(table[0]["product_handle"]).to eq("produto-teste")
      expect(table[0]["product_title"]).to eq("Produto Teste")
    end

    it "renders is_verified_purchase as true/false strings" do
      create(:review, :verified, workspace: workspace, product: product)
      create(:review,            workspace: workspace, product: product, is_verified_purchase: false)
      table = parse(exporter.to_csv)
      flags = table.map { |r| r["is_verified_purchase"] }
      expect(flags).to contain_exactly("true", "false")
    end

    describe "filters" do
      let!(:approved_5) { create(:review, :approved, :five_star, workspace: workspace, product: product, source: "widget", body: "Top!", created_at: 2.days.ago) }
      let!(:pending_3)  { create(:review,                       workspace: workspace, product: product, rating: 3, source: "manual", body: "Meh", created_at: 1.day.ago) }
      let!(:approved_1) { create(:review, :approved,             workspace: workspace, product: product, rating: 1, source: "csv",   body: "Ruim", created_at: 10.days.ago) }

      it "filters by status" do
        table = parse(exporter.to_csv(status: "approved"))
        expect(table.map { |r| r["id"] }).to contain_exactly(approved_5.id, approved_1.id)
      end

      it "filters by rating" do
        table = parse(exporter.to_csv(rating: "5"))
        expect(table.map { |r| r["id"] }).to contain_exactly(approved_5.id)
      end

      it "filters by source" do
        table = parse(exporter.to_csv(source: "widget"))
        expect(table.map { |r| r["id"] }).to contain_exactly(approved_5.id)
      end

      it "filters by q (substring against body / author / title)" do
        table = parse(exporter.to_csv(q: "Ruim"))
        expect(table.map { |r| r["id"] }).to contain_exactly(approved_1.id)
      end

      it "filters by from/to range" do
        from = 3.days.ago.iso8601
        to   = Time.current.iso8601
        table = parse(exporter.to_csv(from: from, to: to))
        expect(table.map { |r| r["id"] }).to contain_exactly(approved_5.id, pending_3.id)
      end

      it "ignores unparseable date bounds rather than crashing" do
        expect { exporter.to_csv(from: "not-a-date") }.not_to raise_error
      end
    end

    describe "CSV escaping" do
      it "escapes embedded commas, quotes and newlines per RFC 4180" do
        body = %(Linha 1\nLinha "com" 2, ainda 2\rLinha 3)
        create(:review,
               workspace: workspace,
               product:   product,
               title:     %(Avaliacao, "muito" boa),
               author_name: %(Maria, "M" Silva),
               body:        body)

        # Round-trip the CSV — if escaping is wrong the parser will explode
        # or split into multiple rows.
        raw   = exporter.to_csv
        table = parse(raw)

        expect(table.length).to eq(1)

        # Newlines stripped — single line in the body cell.
        expect(table[0]["body"]).to eq(%(Linha 1 Linha "com" 2, ainda 2 Linha 3))

        # Commas and quotes preserved through the round-trip.
        expect(table[0]["title"]).to       eq(%(Avaliacao, "muito" boa))
        expect(table[0]["author_name"]).to eq(%(Maria, "M" Silva))
      end

      it "treats nil body as blank without crashing" do
        create(:review, workspace: workspace, product: product, body: nil)
        expect { exporter.to_csv }.not_to raise_error
      end
    end

    describe "row cap" do
      it "honours MAX_ROWS as a safety ceiling" do
        stub_const("ReviewCsvExporter::MAX_ROWS", 2)
        3.times { create(:review, workspace: workspace, product: product) }
        table = parse(exporter.to_csv)
        expect(table.length).to eq(2)
      end
    end
  end
end

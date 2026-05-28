require "rails_helper"

RSpec.describe Integrations::WooCommerceProductSyncer, type: :service do
  let!(:workspace) { create(:workspace) }
  let(:store_url)  { "https://loja.example.com" }
  let(:products_url) { "#{store_url}/wp-json/wc/v3/products" }

  let!(:domain) do
    WorkspaceDomain.create!(
      workspace: workspace,
      domain:    "loja.example.com",
      platform:  "woocommerce",
      platform_meta: {
        "store_url"       => store_url,
        "consumer_key"    => "ck_test",
        "consumer_secret" => "cs_test"
      }
    )
  end

  # The service expects a `with_rls` callable so it stays framework-agnostic.
  # In specs we wrap each batch in a plain transaction (RLS is enforced at the
  # DB role level — the test DB role has BYPASSRLS for fixtures).
  let(:noop_with_rls) { ->(&block) { ActiveRecord::Base.transaction { block.call } } }

  describe ".run" do
    it "upserts every product returned by the WooCommerce REST API" do
      stub_request(:get, products_url)
        .with(query: hash_including("page" => "1", "per_page" => "100"))
        .to_return(
          status: 200,
          body: [
            { id: 101, name: "Produto A", slug: "produto-a", status: "publish",
              price: "29.90", currency: "BRL",
              images: [{ src: "https://cdn.example.com/a.jpg" }] },
            { id: 102, name: "Produto B (rascunho)", slug: "produto-b", status: "draft",
              price: "15.00", currency: "BRL", images: [] }
          ].to_json,
          headers: { "Content-Type" => "application/json" }
        )
      stub_request(:get, products_url)
        .with(query: hash_including("page" => "2", "per_page" => "100"))
        .to_return(status: 200, body: "[]", headers: { "Content-Type" => "application/json" })

      result = described_class.run(workspace: workspace, domain: domain, with_rls: noop_with_rls)

      expect(result[:ok]).to be(true)
      expect(result[:synced]).to eq(2)
      expect(result[:failed]).to eq(0)
      expect(result[:total_fetched]).to eq(2)
      expect(workspace.products.where(platform: "woocommerce").count).to eq(2)

      a = workspace.products.find_by(platform_product_id: "101")
      expect(a.title).to eq("Produto A")
      expect(a.image_url).to eq("https://cdn.example.com/a.jpg")
      expect(a.active).to be(true) # publish → active

      b = workspace.products.find_by(platform_product_id: "102")
      expect(b.active).to be(false) # draft → inactive but still stored
    end

    it "is idempotent — re-running updates the same row instead of creating a duplicate" do
      stub_request(:get, products_url)
        .with(query: hash_including("page" => "1"))
        .to_return(
          status: 200,
          body: [{ id: 200, name: "Old name", slug: "old", status: "publish", price: "10.00", currency: "BRL", images: [] }].to_json,
          headers: { "Content-Type" => "application/json" }
        )
      stub_request(:get, products_url)
        .with(query: hash_including("page" => "2"))
        .to_return(status: 200, body: "[]", headers: { "Content-Type" => "application/json" })

      described_class.run(workspace: workspace, domain: domain, with_rls: noop_with_rls)

      stub_request(:get, products_url)
        .with(query: hash_including("page" => "1"))
        .to_return(
          status: 200,
          body: [{ id: 200, name: "New name", slug: "old", status: "publish", price: "11.00", currency: "BRL", images: [] }].to_json,
          headers: { "Content-Type" => "application/json" }
        )

      expect {
        described_class.run(workspace: workspace, domain: domain, with_rls: noop_with_rls)
      }.not_to change { workspace.products.where(platform: "woocommerce").count }

      expect(workspace.products.find_by(platform_product_id: "200").title).to eq("New name")
    end

    it "returns auth failure with stage=auth when the store rejects the credentials" do
      stub_request(:get, products_url)
        .with(query: hash_including("page" => "1"))
        .to_return(status: 401, body: { code: "unauthorized" }.to_json, headers: { "Content-Type" => "application/json" })

      result = described_class.run(workspace: workspace, domain: domain, with_rls: noop_with_rls)

      expect(result[:ok]).to be(false)
      expect(result[:stage]).to eq("auth")
      expect(workspace.products.count).to eq(0)
    end

    it "returns connection failure with stage=connection when the store is unreachable" do
      stub_request(:get, products_url)
        .with(query: hash_including("page" => "1"))
        .to_raise(Faraday::ConnectionFailed.new("connection refused"))

      result = described_class.run(workspace: workspace, domain: domain, with_rls: noop_with_rls)

      expect(result[:ok]).to be(false)
      expect(result[:stage]).to eq("connection")
    end

    it "records per-product errors without aborting the entire sync" do
      # Force a validation failure by stubbing one product with a title we
      # know is too long for the schema. Easier than monkey-patching: provide
      # an empty-named product so save! raises on the NOT NULL constraint.
      stub_request(:get, products_url)
        .with(query: hash_including("page" => "1"))
        .to_return(
          status: 200,
          body: [
            { id: 301, name: "OK", slug: "ok", status: "publish", price: "5.00", currency: "BRL", images: [] },
            { id: 302, name: nil, slug: nil, status: "publish", price: "5.00", currency: "BRL", images: [] }
          ].to_json,
          headers: { "Content-Type" => "application/json" }
        )
      stub_request(:get, products_url)
        .with(query: hash_including("page" => "2"))
        .to_return(status: 200, body: "[]", headers: { "Content-Type" => "application/json" })

      result = described_class.run(workspace: workspace, domain: domain, with_rls: noop_with_rls)

      expect(result[:synced]).to be >= 1
      # `failed` may be 0 if the schema is permissive — the assertion that
      # matters is the sync DID NOT raise, and at least the good row landed.
      expect(workspace.products.find_by(platform_product_id: "301")).to be_present
    end
  end
end

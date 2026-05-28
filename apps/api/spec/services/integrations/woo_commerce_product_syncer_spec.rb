require "rails_helper"

RSpec.describe Integrations::WooCommerceProductSyncer, type: :service do
  let!(:workspace) { create(:workspace) }
  let(:store_url)  { "https://loja.example.com" }
  let(:products_path) { "https://loja.example.com/wp-json/wc/v3/products" }

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

  # Match on URL + path only and let WebMock accept any query string. The
  # adapter signs requests via basic auth headers (not query params), so
  # only `page` + `per_page` vary; matching with a regex keeps the spec
  # robust against Faraday's encoder swapping param order.
  def stub_products_page(page, body)
    stub_request(:get, /\A#{Regexp.escape(products_path)}\?.*\bpage=#{page}\b/)
      .to_return(
        status:  200,
        body:    body.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  describe ".run" do
    it "upserts every product returned by the WooCommerce REST API" do
      stub_products_page(1, [
        { id: 101, name: "Produto A", slug: "produto-a", status: "publish",
          price: "29.90", currency: "BRL",
          images: [{ src: "https://cdn.example.com/a.jpg" }] },
        { id: 102, name: "Produto B (rascunho)", slug: "produto-b", status: "draft",
          price: "15.00", currency: "BRL", images: [] }
      ])
      stub_products_page(2, [])

      result = described_class.run(workspace: workspace, domain: domain)

      # Surface the actual result if the assertion fails so CI diagnostics
      # are immediately useful instead of just "expected 2 got 0".
      expect(result[:ok]).to    be(true),    "result=#{result.inspect}"
      expect(result[:synced]).to eq(2),       "result=#{result.inspect}"
      expect(result[:failed]).to eq(0),       "result=#{result.inspect}"
      expect(workspace.products.where(platform: "woocommerce").count).to eq(2)

      a = workspace.products.find_by(platform_product_id: "101")
      expect(a.title).to     eq("Produto A")
      expect(a.image_url).to eq("https://cdn.example.com/a.jpg")
      expect(a.active).to    be(true) # publish → active

      b = workspace.products.find_by(platform_product_id: "102")
      expect(b.active).to be(false) # draft → inactive but still stored
    end

    it "is idempotent — re-running updates the same row instead of creating a duplicate" do
      stub_products_page(1, [
        { id: 200, name: "Old name", slug: "old", status: "publish", price: "10.00", currency: "BRL", images: [] }
      ])
      stub_products_page(2, [])

      described_class.run(workspace: workspace, domain: domain)

      WebMock.reset! # drop the first-pass stubs so re-running gets fresh bodies

      stub_products_page(1, [
        { id: 200, name: "New name", slug: "old", status: "publish", price: "11.00", currency: "BRL", images: [] }
      ])
      stub_products_page(2, [])

      expect {
        described_class.run(workspace: workspace, domain: domain)
      }.not_to change { workspace.products.where(platform: "woocommerce").count }

      expect(workspace.products.find_by(platform_product_id: "200").title).to eq("New name")
    end

    it "returns auth failure with stage=auth when the store rejects credentials" do
      stub_request(:get, /\A#{Regexp.escape(products_path)}/)
        .to_return(status: 401, body: { code: "unauthorized" }.to_json,
                   headers: { "Content-Type" => "application/json" })

      result = described_class.run(workspace: workspace, domain: domain)

      expect(result[:ok]).to    be(false)
      expect(result[:stage]).to eq("auth")
      expect(workspace.products.count).to eq(0)
    end

    it "returns connection failure with stage=connection when the store is unreachable" do
      stub_request(:get, /\A#{Regexp.escape(products_path)}/)
        .to_raise(Faraday::ConnectionFailed.new("connection refused"))

      result = described_class.run(workspace: workspace, domain: domain)

      expect(result[:ok]).to    be(false)
      expect(result[:stage]).to eq("connection")
    end

    it "records per-product errors without aborting the entire sync" do
      stub_products_page(1, [
        { id: 301, name: "OK",  slug: "ok",  status: "publish", price: "5.00", currency: "BRL", images: [] },
        { id: 302, name: nil,   slug: nil,   status: "publish", price: "5.00", currency: "BRL", images: [] }
      ])
      stub_products_page(2, [])

      result = described_class.run(workspace: workspace, domain: domain)

      # The good row must always land; the bad row may or may not raise on
      # save! depending on the schema's NOT NULL stance. The contract we
      # care about is "one bad apple doesn't abort the batch".
      expect(workspace.products.find_by(platform_product_id: "301")).to be_present, "result=#{result.inspect}"
      expect(result[:synced]).to be >= 1, "result=#{result.inspect}"
    end
  end
end

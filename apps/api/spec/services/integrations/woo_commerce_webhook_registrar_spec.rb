require "rails_helper"

RSpec.describe Integrations::WooCommerceWebhookRegistrar, type: :service do
  let!(:workspace) { create(:workspace) }
  let(:store_url)  { "https://loja.example.com" }
  let(:base)       { "#{store_url}/wp-json/wc/v3/webhooks" }
  let(:delivery)   { "https://api.univerreviews.com/api/v1/webhooks/woocommerce" }

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

  describe ".register_all" do
    it "registers webhooks for every topic when the store has none yet" do
      stub_request(:get, "#{base}?per_page=100")
        .to_return(status: 200, body: "[]", headers: { "Content-Type" => "application/json" })

      stub_request(:post, base)
        .with { |req| JSON.parse(req.body)["topic"] == "order.updated" }
        .to_return(
          status: 201,
          body: { id: 111, topic: "order.updated", status: "active" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:post, base)
        .with { |req| JSON.parse(req.body)["topic"] == "order.created" }
        .to_return(
          status: 201,
          body: { id: 222, topic: "order.created", status: "active" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      result = described_class.register_all(domain)

      expect(result.ok).to be(true)
      expect(result.registered.map { |r| r[:topic] }).to contain_exactly("order.updated", "order.created")

      domain.reload
      expect(domain.platform_meta["webhook_secret"]).to be_present
      expect(domain.platform_meta["webhook_ids"].size).to eq(2)
      expect(domain.platform_meta["webhooks_registered_at"]).to be_present
    end

    it "is idempotent — skips topics whose webhook already exists at our URL" do
      existing = [
        { id: 1, topic: "order.updated", delivery_url: delivery, status: "active" },
        { id: 2, topic: "order.created", delivery_url: delivery, status: "active" }
      ]
      stub_request(:get, "#{base}?per_page=100")
        .to_return(status: 200, body: existing.to_json, headers: { "Content-Type" => "application/json" })

      # No POSTs expected — both topics already covered.
      result = described_class.register_all(domain)

      expect(result.ok).to be(true)
      expect(result.registered).to be_empty
      expect(result.skipped.map { |s| s[:topic] }).to contain_exactly("order.updated", "order.created")
      expect(WebMock).not_to have_requested(:post, base)
    end

    it "preserves an existing secret on re-registration so signatures stay valid" do
      domain.update_column(:platform_meta, domain.platform_meta.merge("webhook_secret" => "preexisting"))

      stub_request(:get, "#{base}?per_page=100")
        .to_return(status: 200, body: "[]", headers: { "Content-Type" => "application/json" })
      stub_request(:post, base)
        .to_return(status: 201, body: { id: 9, topic: "order.updated" }.to_json,
                   headers: { "Content-Type" => "application/json" })

      described_class.register_all(domain)

      domain.reload
      expect(domain.platform_meta["webhook_secret"]).to eq("preexisting")
    end

    it "does not crash when WooCommerce returns a 5xx — collects errors" do
      stub_request(:get, "#{base}?per_page=100")
        .to_return(status: 200, body: "[]", headers: { "Content-Type" => "application/json" })
      stub_request(:post, base)
        .to_return(status: 500, body: { message: "boom" }.to_json,
                   headers: { "Content-Type" => "application/json" })

      result = described_class.register_all(domain)

      expect(result.ok).to be(false)
      expect(result.errors).not_to be_empty
    end
  end

  describe ".unregister_all" do
    before do
      domain.update_column(:platform_meta, domain.platform_meta.merge(
        "webhook_secret" => "abc",
        "webhook_ids"    => [{ "id" => 111, "topic" => "order.updated" }, { "id" => 222, "topic" => "order.created" }],
        "webhooks_registered_at" => Time.current.iso8601
      ))
    end

    it "deletes every stored webhook and clears local state" do
      stub_request(:delete, "#{base}/111?force=true").to_return(status: 200, body: "{}")
      stub_request(:delete, "#{base}/222?force=true").to_return(status: 200, body: "{}")

      result = described_class.unregister_all(domain)

      expect(result.ok).to be(true)
      expect(result.registered.map { |r| r[:id] }).to contain_exactly(111, 222)

      domain.reload
      expect(domain.platform_meta).not_to have_key("webhook_ids")
      expect(domain.platform_meta).not_to have_key("webhook_secret")
    end

    it "is a no-op when nothing was registered" do
      domain.update_column(:platform_meta, { "store_url" => store_url, "consumer_key" => "ck", "consumer_secret" => "cs" })
      result = described_class.unregister_all(domain)
      expect(result.ok).to be(true)
      expect(result.registered).to be_empty
    end

    it "still clears local state even when remote delete fails" do
      stub_request(:delete, "#{base}/111?force=true").to_return(status: 500, body: "boom")
      stub_request(:delete, "#{base}/222?force=true").to_return(status: 500, body: "boom")

      result = described_class.unregister_all(domain)

      expect(result.ok).to be(false)
      expect(result.errors.size).to eq(2)
      domain.reload
      expect(domain.platform_meta).not_to have_key("webhook_ids")
    end
  end
end

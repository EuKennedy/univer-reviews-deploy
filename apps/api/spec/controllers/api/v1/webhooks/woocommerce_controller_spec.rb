require "rails_helper"

RSpec.describe Api::V1::Webhooks::WoocommerceController, type: :request do
  let!(:workspace) { create(:workspace) }
  let!(:domain)    do
    WorkspaceDomain.create!(workspace: workspace, domain: "loja.example.com", platform: "woocommerce")
  end

  let(:payload) do
    {
      "id"     => 12345,
      "number" => "12345",
      "status" => "completed",
      "total"  => "199.00",
      "currency" => "BRL",
      "billing" => { "first_name" => "Joao", "last_name" => "Silva", "email" => "joao@example.com" },
      "line_items" => [{ "name" => "Camisa", "slug" => "camisa", "product_id" => 1 }]
    }
  end

  let(:headers) do
    {
      "Content-Type"          => "application/json",
      "X-Wc-Webhook-Source"   => "https://loja.example.com/",
      "X-Wc-Webhook-Topic"    => "order.completed"
    }
  end

  before do
    allow_any_instance_of(ApplicationController).to receive(:set_rls_workspace)
  end

  it "creates a single PlatformEvent and enqueues ProcessPlatformEventJob" do
    expect {
      post "/api/v1/webhooks/woocommerce", params: payload.to_json, headers: headers
    }.to change(PlatformEvent, :count).by(1)
     .and have_enqueued_job(ProcessPlatformEventJob)

    expect(response).to have_http_status(:ok)
    pe = PlatformEvent.last
    expect(pe.workspace_id).to eq(workspace.id)
    expect(pe.event_type).to eq("order_completed")
    expect(pe.external_order_id).to eq("12345")
  end

  it "is idempotent — same delivery twice yields a single PlatformEvent" do
    post "/api/v1/webhooks/woocommerce", params: payload.to_json, headers: headers
    expect {
      post "/api/v1/webhooks/woocommerce", params: payload.to_json, headers: headers
    }.not_to change(PlatformEvent, :count)
  end

  it "returns 404 when the source domain is unknown" do
    post "/api/v1/webhooks/woocommerce",
         params: payload.to_json,
         headers: headers.merge("X-Wc-Webhook-Source" => "https://other.example.com/")
    expect(response).to have_http_status(:not_found)
  end

  it "resolves via parent domain when source uses a subdomain" do
    post "/api/v1/webhooks/woocommerce",
         params: payload.to_json,
         headers: headers.merge("X-Wc-Webhook-Source" => "https://www.loja.example.com/")
    expect(response).to have_http_status(:ok)
  end

  # NOTE: Signature verification is exercised when platform_meta.webhook_secret is set.
  # Default test domain has no secret so unsigned deliveries are accepted — this matches
  # WooCommerce's behavior when the user has not configured a signing secret on their store.

  describe "HMAC signature verification" do
    let(:secret) { "shhh-secret-32-bytes" }
    let(:body)   { payload.to_json }

    def sign(body, secret)
      Base64.strict_encode64(OpenSSL::HMAC.digest("SHA256", secret, body))
    end

    before do
      domain.update!(platform_meta: { "webhook_secret" => secret })
    end

    it "accepts a delivery with a valid HMAC signature" do
      post "/api/v1/webhooks/woocommerce",
           params: body,
           headers: headers.merge("X-Wc-Webhook-Signature" => sign(body, secret))

      expect(response).to have_http_status(:ok)
    end

    it "rejects a delivery whose body was tampered with" do
      tampered = body.sub("199.00", "0.01")
      post "/api/v1/webhooks/woocommerce",
           params: tampered,
           headers: headers.merge("X-Wc-Webhook-Signature" => sign(body, secret))

      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects a delivery with a missing signature header" do
      post "/api/v1/webhooks/woocommerce", params: body, headers: headers
      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects a delivery signed with the wrong secret" do
      post "/api/v1/webhooks/woocommerce",
           params: body,
           headers: headers.merge("X-Wc-Webhook-Signature" => sign(body, "other-secret"))

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "secret enforcement" do
    it "accepts unsigned deliveries in non-production envs and logs a warning" do
      expect(Rails.logger).to receive(:warn).with(/no secret on domain=/).at_least(:once)

      post "/api/v1/webhooks/woocommerce", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:ok)
    end

    it "rejects unsigned deliveries when running as production" do
      allow(Rails.env).to receive(:production?).and_return(true)
      post "/api/v1/webhooks/woocommerce", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:unauthorized)
    end
  end
end

require "rails_helper"

RSpec.describe Api::V1::Webhooks::PaymentController, type: :request do
  let(:secret) { "test-payment-webhook-secret-32chars" }

  let(:payload) do
    {
      "transaction_id" => "ext_tx_#{SecureRandom.hex(6)}",
      "event"          => "payment.succeeded",
      "buyer"          => {
        "email"   => "buyer-#{SecureRandom.hex(4)}@example.com",
        "name"    => "Buyer Tester",
        "country" => "BR"
      },
      "plan"           => "entry",
      "amount_cents"   => 19_900,
      "currency"       => "BRL",
      "occurred_at"    => "2026-05-28T17:00:00Z"
    }
  end

  let(:body) { payload.to_json }

  def sign(b, sec)
    "sha256=#{OpenSSL::HMAC.hexdigest('SHA256', sec, b)}"
  end

  def headers(sig = sign(body, secret))
    { "Content-Type" => "application/json", "X-Payment-Signature" => sig }
  end

  around do |example|
    original = ENV["PAYMENT_WEBHOOK_SECRET"]
    example.run
    ENV["PAYMENT_WEBHOOK_SECRET"] = original
  end

  before do
    ENV["PAYMENT_WEBHOOK_SECRET"] = secret
    # Magic-link inserts directly into auth.verification — stub the entire
    # issuer so we don't depend on the auth schema being writable from the
    # test DB. The dedicated MagicLinkIssuer spec covers the SQL.
    allow(Payment::MagicLinkIssuer).to receive(:issue_and_send!).and_return(
      Payment::MagicLinkIssuer::Result.new(
        token: "stub", url: "https://app.example.com/api/auth/magic-link/verify?token=stub", verification_id: SecureRandom.uuid
      )
    )
    # Bypass RLS-related SET LOCAL inside the processor — we don't have
    # row_security configured in the test DB role.
    allow_any_instance_of(Payment::WebhookProcessor).to receive(:find_or_create_better_auth_user!).and_return(SecureRandom.uuid)
  end

  describe "POST /api/v1/webhooks/payment" do
    context "signature handling" do
      it "returns 401 when the X-Payment-Signature header is missing" do
        post "/api/v1/webhooks/payment", params: body, headers: { "Content-Type" => "application/json" }
        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when the signature is wrong" do
        post "/api/v1/webhooks/payment", params: body, headers: headers("sha256=#{'0' * 64}")
        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 when the body is tampered with after signing" do
        sig = sign(body, secret)
        tampered = body.sub("19900", "1")
        post "/api/v1/webhooks/payment", params: tampered, headers: headers(sig)
        expect(response).to have_http_status(:unauthorized)
      end

      it "accepts a bare-hex signature (no sha256= prefix)" do
        sig = OpenSSL::HMAC.hexdigest("SHA256", secret, body)
        post "/api/v1/webhooks/payment", params: body, headers: { "Content-Type" => "application/json", "X-Payment-Signature" => sig }
        expect(response).to have_http_status(:ok)
      end
    end

    context "configuration" do
      it "returns 503 when PAYMENT_WEBHOOK_SECRET is unset" do
        ENV["PAYMENT_WEBHOOK_SECRET"] = nil
        post "/api/v1/webhooks/payment", params: body, headers: headers
        expect(response).to have_http_status(:service_unavailable)
      end

      it "returns 415 when content-type is not application/json" do
        post "/api/v1/webhooks/payment",
             params: body,
             headers: { "Content-Type" => "text/plain", "X-Payment-Signature" => sign(body, secret) }
        expect(response).to have_http_status(:unsupported_media_type)
      end

      it "returns 413 when body exceeds 64 KB" do
        big = "x" * (65 * 1024)
        sig = sign(big, secret)
        post "/api/v1/webhooks/payment",
             params: big,
             headers: { "Content-Type" => "application/json", "X-Payment-Signature" => sig }
        expect(response).to have_http_status(:payload_too_large)
      end
    end

    context "request validation" do
      it "returns 400 on invalid JSON" do
        bad = "{not json"
        post "/api/v1/webhooks/payment",
             params: bad,
             headers: { "Content-Type" => "application/json", "X-Payment-Signature" => sign(bad, secret) }
        expect(response).to have_http_status(:bad_request)
      end

      it "returns 400 when transaction_id is missing" do
        bad = payload.merge("transaction_id" => "").to_json
        post "/api/v1/webhooks/payment",
             params: bad,
             headers: { "Content-Type" => "application/json", "X-Payment-Signature" => sign(bad, secret) }
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "idempotency" do
      it "returns { idempotent: true } on a second delivery of the same transaction_id" do
        post "/api/v1/webhooks/payment", params: body, headers: headers
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)).to eq("ok" => true, "idempotent" => false)

        # Second delivery — same body, same signature.
        expect {
          post "/api/v1/webhooks/payment", params: body, headers: headers
        }.not_to change(PaymentEvent, :count)

        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)).to eq("ok" => true, "idempotent" => true)
      end
    end

    context "successful provisioning" do
      it "creates PaymentEvent + Workspace + WorkspaceUser + AuditLog and calls the magic-link issuer" do
        # `issue_and_send!` is already stubbed in `before`; just assert it
        # was invoked. Running the real implementation would also write to
        # auth.verification and call Resend, which we don't need to exercise
        # here (covered by magic_link_issuer_spec).
        expect(Payment::MagicLinkIssuer).to receive(:issue_and_send!).once.and_return(
          Payment::MagicLinkIssuer::Result.new(token: "t", url: "https://x.test/", verification_id: SecureRandom.uuid)
        )

        expect {
          post "/api/v1/webhooks/payment", params: body, headers: headers
        }.to change(PaymentEvent, :count).by(1)
         .and change(Workspace, :count).by(1)
         .and change(WorkspaceUser, :count).by(1)
         .and change(AuditLog, :count).by_at_least(1)

        expect(response).to have_http_status(:ok)

        pe = PaymentEvent.find_by!(transaction_id: payload["transaction_id"])
        expect(pe.event).to eq("payment.succeeded")
        expect(pe.processed_at).to be_present

        ws_user = WorkspaceUser.order(created_at: :desc).first
        expect(ws_user.email).to eq(payload["buyer"]["email"].downcase)
        expect(ws_user.role).to eq("owner")
      end

      it "logs an audit row with the transaction_id and plan in metadata" do
        post "/api/v1/webhooks/payment", params: body, headers: headers
        audit = AuditLog.find_by(action: "payment.processed")
        expect(audit).to be_present
        expect(audit.metadata["transaction_id"]).to eq(payload["transaction_id"])
        expect(audit.metadata["plan"]).to eq("entry")
      end
    end

    context "unhandled events" do
      it "accepts a non-success event with 200 and records it as processed" do
        bad = payload.merge("event" => "refund").to_json
        post "/api/v1/webhooks/payment",
             params: bad,
             headers: { "Content-Type" => "application/json", "X-Payment-Signature" => sign(bad, secret) }

        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)["ok"]).to eq(true)
        expect(PaymentEvent.find_by(transaction_id: payload["transaction_id"]).event).to eq("refund")
      end
    end

    context "invalid plan" do
      it "returns 422 and persists the failure on the PaymentEvent row" do
        bad = payload.merge("plan" => "totally-fake-plan").to_json
        post "/api/v1/webhooks/payment",
             params: bad,
             headers: { "Content-Type" => "application/json", "X-Payment-Signature" => sign(bad, secret) }

        expect(response).to have_http_status(:unprocessable_entity)
        pe = PaymentEvent.find_by(transaction_id: payload["transaction_id"])
        expect(pe.error).to match(/invalid_plan/)
        expect(pe.processed_at).to be_nil
      end
    end
  end
end

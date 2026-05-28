require "rails_helper"

RSpec.describe Payment::WebhookProcessor do
  let(:base_payload) do
    {
      "transaction_id" => "ext_tx_#{SecureRandom.hex(6)}",
      "event"          => "payment.succeeded",
      "buyer"          => { "email" => "buyer-#{SecureRandom.hex(3)}@example.com", "name" => "Buyer Name", "country" => "BR" },
      "plan"           => "entry",
      "amount_cents"   => 19_900,
      "currency"       => "BRL",
      "occurred_at"    => "2026-05-28T17:00:00Z"
    }
  end

  before do
    # Magic-link issuer touches auth.verification; stub for unit specs that
    # only care about provisioning side-effects.
    allow(Payment::MagicLinkIssuer).to receive(:issue_and_send!).and_return(
      Payment::MagicLinkIssuer::Result.new(
        token: "stub-token", url: "https://app.example.com/api/auth/magic-link/verify?token=stub-token", verification_id: SecureRandom.uuid
      )
    )
    # auth.user requires the auth schema + Drizzle tables. Real tests in
    # this layer should not assume those tables exist with insert rights —
    # stub the upsert to return a stable UUID.
    allow_any_instance_of(described_class).to receive(:find_or_create_better_auth_user!).and_return(SecureRandom.uuid)
  end

  describe "validation" do
    it "rejects when email is blank" do
      result = described_class.process!(base_payload.merge("buyer" => { "email" => "" }))
      expect(result.ok).to be(false)
      expect(result.error).to eq("invalid_email")
    end

    it "rejects unknown plan values" do
      result = described_class.process!(base_payload.merge("plan" => "diamond"))
      expect(result.ok).to be(false)
      expect(result.error).to include("invalid_plan")
    end

    it "lowercases and trims the buyer e-mail" do
      payload = base_payload.deep_dup
      payload["buyer"]["email"] = "  MixedCase@Example.COM  "
      described_class.process!(payload)
      expect(WorkspaceUser.last.email).to eq("mixedcase@example.com")
    end
  end

  describe "new buyer (no prior workspace_user)" do
    it "creates a workspace and a workspace_user with role=owner" do
      expect {
        described_class.process!(base_payload)
      }.to change(Workspace, :count).by(1)
       .and change(WorkspaceUser, :count).by(1)

      ws_user = WorkspaceUser.last
      expect(ws_user.role).to eq("owner")
      expect(ws_user.email).to eq(base_payload["buyer"]["email"].downcase)
      expect(ws_user.workspace.status).to eq("active")
    end

    it "returns :new provisioned and sends the magic-link" do
      expect(Payment::MagicLinkIssuer).to receive(:issue_and_send!).once
      result = described_class.process!(base_payload)
      expect(result.ok).to be(true)
      expect(result.provisioned).to eq(:new)
    end

    it "audits a payment.processed event with metadata" do
      expect {
        described_class.process!(base_payload)
      }.to change(AuditLog.where(action: "payment.processed"), :count).by(1)

      audit = AuditLog.where(action: "payment.processed").last
      expect(audit.metadata["transaction_id"]).to eq(base_payload["transaction_id"])
      expect(audit.metadata["provisioned"]).to eq("new")
    end
  end

  describe "existing workspace_user without better_auth_user_id" do
    let!(:ws) { create(:workspace, plan: "entry") }
    let!(:wu) { create(:workspace_user, workspace: ws, email: base_payload["buyer"]["email"], better_auth_user_id: nil) }

    it "links the better_auth_user_id without creating a new workspace" do
      ba_id = SecureRandom.uuid
      allow_any_instance_of(described_class).to receive(:find_or_create_better_auth_user!).and_return(ba_id)

      expect {
        described_class.process!(base_payload)
      }.to change(Workspace, :count).by(0)
       .and change(WorkspaceUser, :count).by(0)

      expect(wu.reload.better_auth_user_id).to eq(ba_id)
    end
  end

  describe "plan upgrade flow" do
    let!(:ws) { create(:workspace, plan: "entry") }
    let!(:wu) { create(:workspace_user, workspace: ws, email: base_payload["buyer"]["email"], better_auth_user_id: SecureRandom.uuid) }

    it "upgrades the workspace plan when the payload differs" do
      payload = base_payload.merge("plan" => "ultra")
      result = described_class.process!(payload)

      expect(result.provisioned).to eq(:upgraded)
      expect(ws.reload.plan).to eq("ultra")
    end

    it "records workspace.plan_changed in audit log on upgrade" do
      payload = base_payload.merge("plan" => "medium")
      described_class.process!(payload)
      audit = AuditLog.where(action: "workspace.plan_changed").last
      expect(audit).to be_present
      expect(audit.metadata["to"]).to eq("medium")
      expect(audit.metadata["from"]).to eq("entry")
    end

    it "is a no-op when payload plan matches the workspace's current plan" do
      payload = base_payload.merge("plan" => "entry")
      result = described_class.process!(payload)
      expect(result.provisioned).to eq(:noop)
      expect(ws.reload.plan).to eq("entry")
    end
  end
end

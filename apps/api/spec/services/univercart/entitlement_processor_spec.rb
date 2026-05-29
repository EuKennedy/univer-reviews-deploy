require "rails_helper"

RSpec.describe Univercart::EntitlementProcessor, type: :service do
  let(:sub_id) { "sub_#{SecureRandom.hex(6)}" }
  let(:email)  { "buyer-#{SecureRandom.hex(4)}@example.com" }

  before do
    # Bypass the auth.user direct insert path — we exercise that integration
    # under spec/integration if a test DB has the auth schema loaded. Here
    # we focus on the public.workspaces side of provisioning.
    allow_any_instance_of(described_class).to receive(:find_or_create_better_auth_user!).and_return(SecureRandom.uuid)
  end

  describe ".process! with entitlement.granted" do
    let(:data) do
      {
        "externalUserId" => sub_id,
        "email"          => email,
        "name"           => "Buyer Tester",
        "role"           => "medium",
        "validUntil"     => 1.month.from_now.iso8601,
        "planId"         => "plan_xyz",
      }
    end

    it "creates a new workspace pinned to the subscription id, role, and owner" do
      expect {
        described_class.process!(event_type: "entitlement.granted", data: data)
      }.to change(Workspace, :count).by(1)
       .and change(WorkspaceUser, :count).by(1)

      ws = Workspace.find_by(univercart_subscription_id: sub_id)
      expect(ws).to be_present, "workspace should be pinned to the Univercart sub id"
      expect(ws.plan).to eq("medium")
      expect(ws.status).to eq("active")
      expect(ws.univercart_email).to eq(email)

      owner = ws.workspace_users.find_by(role: "owner")
      expect(owner).to be_present
      expect(owner.email.downcase).to eq(email)
    end

    it "rejects unknown plan slugs without touching the DB" do
      bad = data.merge("role" => "platinum")
      expect {
        described_class.process!(event_type: "entitlement.granted", data: bad)
      }.not_to change(Workspace, :count)
    end

    it "is idempotent across repeated grants for the same subscription" do
      described_class.process!(event_type: "entitlement.granted", data: data)
      # `change(...).by(0)` lets us chain a no-op assertion through `.and`.
      # `not_to change(...)` doesn't compose, and `not_change` isn't a real
      # matcher — RSpec only ships positive ones for `.and` composition.
      expect {
        described_class.process!(event_type: "entitlement.granted", data: data)
      }.to change(Workspace, :count).by(0)
       .and change(WorkspaceUser, :count).by(0)
    end
  end

  describe ".process! with entitlement.role_changed" do
    before do
      described_class.process!(event_type: "entitlement.granted", data: {
        "externalUserId" => sub_id, "email" => email, "name" => "X", "role" => "entry",
      })
    end

    it "updates workspace.plan without creating a new workspace" do
      expect {
        described_class.process!(event_type: "entitlement.role_changed", data: {
          "externalUserId" => sub_id, "role" => "ultra",
        })
      }.not_to change(Workspace, :count)
      ws = Workspace.find_by(univercart_subscription_id: sub_id)
      expect(ws.plan).to eq("ultra")
    end

    it "rejects unknown plan slugs" do
      result = described_class.process!(event_type: "entitlement.role_changed", data: {
        "externalUserId" => sub_id, "role" => "ghost",
      })
      expect(result.ok).to be(false)
    end
  end

  describe ".process! with entitlement.suspended / reactivated / revoked" do
    before do
      described_class.process!(event_type: "entitlement.granted", data: {
        "externalUserId" => sub_id, "email" => email, "name" => "X", "role" => "medium",
      })
    end

    it "flips status to suspended" do
      described_class.process!(event_type: "entitlement.suspended", data: { "externalUserId" => sub_id })
      expect(Workspace.find_by(univercart_subscription_id: sub_id).status).to eq("suspended")
    end

    it "flips status back to active on reactivated" do
      described_class.process!(event_type: "entitlement.suspended",   data: { "externalUserId" => sub_id })
      described_class.process!(event_type: "entitlement.reactivated", data: { "externalUserId" => sub_id })
      expect(Workspace.find_by(univercart_subscription_id: sub_id).status).to eq("active")
    end

    it "flips status to cancelled on revoked" do
      described_class.process!(event_type: "entitlement.revoked", data: { "externalUserId" => sub_id })
      expect(Workspace.find_by(univercart_subscription_id: sub_id).status).to eq("cancelled")
    end
  end
end

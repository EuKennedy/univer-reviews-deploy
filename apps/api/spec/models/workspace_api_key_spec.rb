require "rails_helper"

RSpec.describe WorkspaceApiKey, type: :model do
  describe ".generate" do
    let(:workspace) { create(:workspace) }

    it "returns a record and a raw key" do
      record, raw_key = WorkspaceApiKey.generate(workspace: workspace, label: "Test")
      expect(raw_key).to start_with("unvr_")
      expect(record.key_prefix).to eq(raw_key[0, 8])
      expect(record.key_hash).to eq(Digest::SHA256.hexdigest(raw_key))
    end
  end

  describe "#active?" do
    it "returns true for a non-revoked, non-expired key" do
      key = build(:workspace_api_key)
      expect(key).to be_active
    end

    it "returns false for revoked keys" do
      key = build(:workspace_api_key, :revoked)
      expect(key).not_to be_active
    end

    it "returns false for expired keys" do
      key = build(:workspace_api_key, :expired)
      expect(key).not_to be_active
    end
  end

  describe "#has_scope?" do
    it "returns true for included scope" do
      key = build(:workspace_api_key, scopes: "read,write")
      expect(key.has_scope?("read")).to be true
      expect(key.has_scope?("write")).to be true
    end

    it "returns false for missing scope" do
      key = build(:workspace_api_key, :read_only)
      expect(key.has_scope?("write")).to be false
    end
  end
end

require "rails_helper"

RSpec.describe Workspace, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:slug) }
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_uniqueness_of(:slug) }

    it "rejects invalid slug formats" do
      ws = build(:workspace, slug: "Invalid Slug!")
      expect(ws).not_to be_valid
      expect(ws.errors[:slug]).to be_present
    end

    it "accepts valid slug" do
      expect(build(:workspace, slug: "my-store-123")).to be_valid
    end

    it "rejects invalid brand_color" do
      expect(build(:workspace, brand_color: "red")).not_to be_valid
    end

    it "accepts valid brand_color" do
      expect(build(:workspace, brand_color: "#ff0000")).to be_valid
    end
  end

  describe "associations" do
    it { is_expected.to have_many(:workspace_users).dependent(:destroy) }
    it { is_expected.to have_many(:reviews).dependent(:destroy) }
    it { is_expected.to have_many(:products).dependent(:destroy) }
    it { is_expected.to have_one(:subscription).dependent(:destroy) }
  end

  describe "status predicates" do
    it "#active? returns true for active workspaces" do
      expect(build(:workspace, status: "active")).to be_active
    end

    it "#suspended? returns true for suspended workspaces" do
      expect(build(:workspace, status: "suspended")).to be_suspended
    end
  end
end

require "rails_helper"

RSpec.describe LoyaltyConfig, type: :model do
  describe "validations" do
    subject { build(:loyalty_config) }

    it { is_expected.to be_valid }

    it "requires source_campaign_id" do
      subject.source_campaign_id = nil
      expect(subject).not_to be_valid
    end

    it "is unique per workspace + source_campaign_id" do
      a = create(:loyalty_config, source_campaign_id: 1)
      dup = build(:loyalty_config, workspace: a.workspace, source_campaign_id: 1)
      expect(dup).not_to be_valid
    end

    it "allows same source_campaign_id in different workspaces" do
      a = create(:loyalty_config, source_campaign_id: 1)
      b = build(:loyalty_config, source_campaign_id: 1, workspace: create(:workspace))
      expect(b).to be_valid
    end

    %i[base_points min_chars bonus_photo bonus_video bonus_verified priority].each do |attr|
      it "rejects negative #{attr}" do
        subject.send("#{attr}=", -1)
        expect(subject).not_to be_valid
      end
    end
  end

  describe ".upsert_from_wp!" do
    let(:workspace) { create(:workspace) }

    it "creates on first call" do
      expect {
        described_class.upsert_from_wp!(
          workspace: workspace,
          attrs: {
            source_campaign_id: 7,
            name:               "x",
            base_points:        25,
            min_chars:          50,
            only_logged_in:     true,
            bonus_photo:        0,
            bonus_video:        0,
            bonus_verified:     0,
            priority:           0,
            is_active:          true,
          },
        )
      }.to change { LoyaltyConfig.count }.by(1)
    end

    it "updates on second call (idempotent upsert)" do
      described_class.upsert_from_wp!(
        workspace: workspace,
        attrs: { source_campaign_id: 7, base_points: 10 },
      )
      expect {
        described_class.upsert_from_wp!(
          workspace: workspace,
          attrs: { source_campaign_id: 7, base_points: 99 },
        )
      }.not_to change { LoyaltyConfig.count }

      expect(LoyaltyConfig.find_by(workspace: workspace, source_campaign_id: 7).base_points).to eq(99)
    end
  end
end

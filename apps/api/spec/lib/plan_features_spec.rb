require "rails_helper"

RSpec.describe PlanFeatures do
  describe ".allow?" do
    it "free plan sees only the freebie features" do
      expect(described_class.allow?(:reviews_basic, "free")).to be true
      expect(described_class.allow?(:ai_summary_topics, "free")).to be false
      expect(described_class.allow?(:custom_brand_icon, "free")).to be false
    end

    it "pro plan unlocks AI summaries + custom brand icon" do
      expect(described_class.allow?(:ai_summary_topics, "pro")).to be true
      expect(described_class.allow?(:custom_brand_icon, "pro")).to be true
      expect(described_class.allow?(:whitelabel, "pro")).to be false
    end

    it "enterprise plan unlocks everything" do
      %i[
        reviews_basic ai_summary_topics ai_bulk_generate_reviews
        custom_brand_icon whitelabel sso audit_log_export
      ].each do |f|
        expect(described_class.allow?(f, "enterprise")).to be(true), "expected enterprise to allow #{f}"
      end
    end

    it "unknown plan falls back to free (defense in depth)" do
      expect(described_class.allow?(:ai_summary_topics, "hijack-plan")).to be false
      expect(described_class.allow?(:reviews_basic, "hijack-plan")).to be true
    end

    it "accepts a Workspace instance" do
      ws = create(:workspace, plan: "pro")
      expect(described_class.allow?(:ai_summary_topics, ws)).to be true
    end
  end

  describe ".require!" do
    let(:free_ws) { create(:workspace, plan: "free") }
    let(:pro_ws)  { create(:workspace, plan: "pro") }

    it "no-op when feature is allowed" do
      expect { described_class.require!(:ai_summary_topics, pro_ws) }.not_to raise_error
    end

    it "raises FeatureLocked with the cheapest required plan on miss" do
      expect { described_class.require!(:ai_summary_topics, free_ws) }
        .to raise_error(PlanFeatures::FeatureLocked) do |err|
          expect(err.feature).to eq(:ai_summary_topics)
          expect(err.current_plan).to eq("free")
          expect(err.required_plan).to eq("pro")
        end
    end

    it "FeatureLocked#to_json_payload renders the 402 contract the frontend reads" do
      err = PlanFeatures::FeatureLocked.new(
        feature: :ai_summary_topics, current_plan: "free", required_plan: "pro"
      )
      payload = err.to_json_payload
      expect(payload).to include(
        error:         "feature_locked",
        feature:       "ai_summary_topics",
        current_plan:  "free",
        required_plan: "pro",
      )
      expect(payload[:upgrade_url]).to eq("/billing")
    end
  end

  describe ".limit" do
    it "returns numeric caps per plan" do
      expect(described_class.limit(:max_products, "free")).to eq(25)
      expect(described_class.limit(:max_products, "pro")).to eq(2_500)
    end

    it "returns nil for unlimited (enterprise)" do
      expect(described_class.limit(:max_products, "enterprise")).to be_nil
    end
  end

  describe ".snapshot" do
    it "renders the workspace#show payload shape" do
      ws = create(:workspace, plan: "pro")
      snap = described_class.snapshot(ws)
      expect(snap[:plan]).to eq("pro")
      expect(snap[:features]).to include("ai_summary_topics", "custom_brand_icon")
      expect(snap[:features]).not_to include("whitelabel")
      expect(snap[:limits][:max_products]).to eq(2_500)
    end
  end
end

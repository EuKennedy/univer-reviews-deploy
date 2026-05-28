require "rails_helper"

# Plan-tier contract spec. The PlanFeatures table is the single source of
# truth for what each tier unlocks — the frontend mirrors a snapshot of
# it via /api/v1/workspace.plan_features and every premium-gated
# controller calls require_feature!. Drift here breaks both at once, so
# we lock the relationship down with concrete examples per tier.
RSpec.describe PlanFeatures do
  describe ".allow?" do
    it "entry plan sees only the floor features" do
      expect(described_class.allow?(:reviews_basic, "entry")).to be true
      expect(described_class.allow?(:ai_generate, "entry")).to be true
      expect(described_class.allow?(:ai_summary_topics, "entry")).to be false
      expect(described_class.allow?(:custom_brand_icon, "entry")).to be false
      expect(described_class.allow?(:multi_user, "entry")).to be false
    end

    it "medium plan unlocks the working-merchant toolkit on top of entry" do
      expect(described_class.allow?(:reviews_basic, "medium")).to be true
      expect(described_class.allow?(:ai_generate, "medium")).to be true
      expect(described_class.allow?(:ai_dedup, "medium")).to be true
      expect(described_class.allow?(:ai_summary_topics, "medium")).to be true
      expect(described_class.allow?(:multi_user, "medium")).to be true
      expect(described_class.allow?(:webhook_auto_register, "medium")).to be true
      # Bulk-AI features are reserved for ultra.
      expect(described_class.allow?(:ai_bulk_generate_reviews, "medium")).to be false
      expect(described_class.allow?(:bulk_qa, "medium")).to be false
      expect(described_class.allow?(:whitelabel, "medium")).to be false
    end

    it "ultra plan unlocks everything (bulk AI + whitelabel)" do
      %i[
        reviews_basic ai_generate ai_dedup ai_summary_topics
        ai_bulk_generate_reviews ai_bulk_generate_qa
        bulk_qa bulk_ai_summary
        multi_user webhook_auto_register
        whitelabel sso audit_log_export priority_support sla
      ].each do |f|
        expect(described_class.allow?(f, "ultra")).to be(true), "expected ultra to allow #{f}"
      end
    end

    it "unknown plan falls back to entry (defense in depth)" do
      # A mis-migrated row must never unlock anything beyond the floor.
      expect(described_class.allow?(:ai_summary_topics, "hijack-plan")).to be false
      expect(described_class.allow?(:reviews_basic, "hijack-plan")).to be true
    end

    it "accepts a Workspace instance" do
      ws = create(:workspace, :medium)
      expect(described_class.allow?(:ai_summary_topics, ws)).to be true
    end
  end

  describe ".require!" do
    let(:entry_ws)  { create(:workspace, :entry) }
    let(:medium_ws) { create(:workspace, :medium) }

    it "no-op when feature is allowed" do
      expect { described_class.require!(:ai_summary_topics, medium_ws) }.not_to raise_error
    end

    it "raises FeatureLocked pointing to the cheapest qualifying plan on miss" do
      expect { described_class.require!(:ai_summary_topics, entry_ws) }
        .to raise_error(PlanFeatures::FeatureLocked) do |err|
          expect(err.feature).to eq(:ai_summary_topics)
          expect(err.current_plan).to eq("entry")
          # ai_summary_topics is first unlocked by the medium tier.
          expect(err.required_plan).to eq("medium")
        end
    end

    it "raises FeatureLocked → ultra when the feature is ultra-only" do
      expect { described_class.require!(:bulk_qa, entry_ws) }
        .to raise_error(PlanFeatures::FeatureLocked) do |err|
          expect(err.required_plan).to eq("ultra")
        end
    end

    it "FeatureLocked#to_json_payload renders the 402 contract the frontend reads" do
      err = PlanFeatures::FeatureLocked.new(
        feature: :ai_summary_topics, current_plan: "entry", required_plan: "medium"
      )
      payload = err.to_json_payload
      expect(payload).to include(
        error:         "feature_locked",
        feature:       "ai_summary_topics",
        current_plan:  "entry",
        required_plan: "medium",
      )
      expect(payload[:upgrade_url]).to eq("/billing")
      # Message is rendered in PT-BR with the capitalized plan name.
      expect(payload[:message]).to include("Medium")
    end
  end

  describe ".limit" do
    it "returns numeric caps per plan" do
      expect(described_class.limit(:max_products, "entry")).to eq(100)
      expect(described_class.limit(:max_products, "medium")).to eq(1_000)
    end

    it "returns nil for unlimited (ultra)" do
      expect(described_class.limit(:max_products, "ultra")).to be_nil
      expect(described_class.limit(:max_team_members, "ultra")).to be_nil
    end

    it "exposes monthly AI-generation cap so PlanGated can enforce" do
      expect(described_class.limit(:max_ai_generations_month, "entry")).to eq(200)
      expect(described_class.limit(:max_ai_generations_month, "medium")).to eq(2_000)
      expect(described_class.limit(:max_ai_generations_month, "ultra")).to be_nil
    end
  end

  describe ".snapshot" do
    it "renders the workspace#show payload shape" do
      ws = create(:workspace, :medium)
      snap = described_class.snapshot(ws)

      expect(snap[:plan]).to eq("medium")
      expect(snap[:features]).to include("ai_summary_topics", "custom_brand_icon", "multi_user")
      # Ultra-only capabilities must NOT leak to medium.
      expect(snap[:features]).not_to include("whitelabel", "bulk_qa")
      expect(snap[:limits][:max_products]).to eq(1_000)
    end

    it "ultra snapshot reports unlimited caps" do
      ws = create(:workspace, :ultra)
      snap = described_class.snapshot(ws)
      expect(snap[:plan]).to eq("ultra")
      expect(snap[:limits][:max_products]).to be_nil
      expect(snap[:features]).to include("whitelabel", "sso", "bulk_qa")
    end
  end

  describe "TIERS ordering" do
    it "TIERS is sorted weakest → strongest so required_plan_for returns the cheapest" do
      expect(described_class::TIERS).to eq(%w[entry medium ultra])
    end
  end
end

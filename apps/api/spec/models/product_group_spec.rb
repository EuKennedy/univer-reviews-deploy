require "rails_helper"

RSpec.describe ProductGroup, type: :model do
  let(:workspace) { create(:workspace) }

  describe "associations + validations" do
    subject(:group) { build(:product_group, workspace: workspace) }

    it { is_expected.to be_valid }

    it "requires name" do
      group.name = nil
      expect(group).not_to be_valid
    end

    it "auto-derives slug from name when blank" do
      g = build(:product_group, workspace: workspace, name: "Colorizze 2026", slug: nil)
      expect(g).to be_valid
      expect(g.slug).to eq("colorizze-2026")
    end

    it "enforces slug uniqueness per workspace" do
      create(:product_group, workspace: workspace, slug: "colorizze")
      dup = build(:product_group, workspace: workspace, slug: "colorizze")
      expect(dup).not_to be_valid
    end

    it "allows same slug across different workspaces" do
      create(:product_group, workspace: workspace, slug: "colorizze")
      other_ws = create(:workspace)
      other = build(:product_group, workspace: other_ws, slug: "colorizze")
      expect(other).to be_valid
    end

    it "rejects slugs with uppercase/spaces" do
      group.slug = "Colorizze Pro"
      expect(group).not_to be_valid
    end
  end

  describe "#attach_products! / #detach_products!" do
    let(:group)   { create(:product_group, workspace: workspace) }
    let(:p1)      { create(:product, workspace: workspace) }
    let(:p2)      { create(:product, workspace: workspace) }
    let(:p_other) { create(:product, workspace: create(:workspace)) }

    it "attaches workspace-scoped products only" do
      attached = group.attach_products!([p1.id, p2.id, p_other.id])
      expect(attached).to eq(2)
      expect(p1.reload.product_group_id).to eq(group.id)
      expect(p2.reload.product_group_id).to eq(group.id)
      expect(p_other.reload.product_group_id).to be_nil
    end

    it "detaches specified products" do
      group.attach_products!([p1.id, p2.id])
      detached = group.detach_products!([p1.id])
      expect(detached).to eq(1)
      expect(p1.reload.product_group_id).to be_nil
      expect(p2.reload.product_group_id).to eq(group.id)
    end

    it "detaches all when no ids given" do
      group.attach_products!([p1.id, p2.id])
      detached = group.detach_products!
      expect(detached).to eq(2)
      expect(group.products.reload).to be_empty
    end
  end

  describe "review aggregation" do
    let(:group) { create(:product_group, workspace: workspace) }
    let(:p_a)   { create(:product, workspace: workspace, product_group: group) }
    let(:p_b)   { create(:product, workspace: workspace, product_group: group) }
    let(:lone)  { create(:product, workspace: workspace) }

    before do
      create_list(:review, 3, :approved, workspace: workspace, product: p_a, rating: 5)
      create_list(:review, 2, :approved, workspace: workspace, product: p_b, rating: 4)
      create(:review, workspace: workspace, product: p_b, status: "pending", rating: 1)
      create(:review, :approved, workspace: workspace, product: lone, rating: 1)
    end

    it "aggregates approved reviews across members" do
      expect(group.reviews_count).to eq(5)
    end

    it "computes weighted avg rating" do
      # (5*3 + 4*2) / 5 = 23/5 = 4.6
      expect(group.avg_rating).to eq(4.6)
    end

    it "excludes non-approved reviews" do
      expect(group.reviews.pluck(:status).uniq).to eq(["approved"])
    end

    it "excludes products from outside the group" do
      expect(group.member_product_ids).to contain_exactly(p_a.id, p_b.id)
      expect(group.member_product_ids).not_to include(lone.id)
    end
  end

  describe "Product#review_scope_product_ids" do
    let(:group) { create(:product_group, workspace: workspace) }
    let(:p_a)   { create(:product, workspace: workspace, product_group: group) }
    let(:p_b)   { create(:product, workspace: workspace, product_group: group) }
    let(:lone)  { create(:product, workspace: workspace) }

    it "fans out to group members when grouped" do
      [p_a, p_b]
      expect(p_a.review_scope_product_ids).to contain_exactly(p_a.id, p_b.id)
    end

    it "returns only self when ungrouped" do
      expect(lone.review_scope_product_ids).to eq([lone.id])
    end
  end
end

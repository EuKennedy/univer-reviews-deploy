require "rails_helper"

RSpec.describe AiSummaryTopic, type: :model do
  let(:workspace) { create(:workspace) }
  let(:product)   { create(:product, workspace: workspace) }

  describe "validations" do
    subject(:topic) { build(:ai_summary_topic, workspace: workspace, product: product) }

    it { is_expected.to be_valid }

    it "requires a title" do
      topic.title = nil
      expect(topic).not_to be_valid
    end

    it "caps title at 140 chars" do
      topic.title = "x" * 141
      expect(topic).not_to be_valid
    end

    it "rejects unknown source values" do
      topic.source = "robot"
      expect(topic).not_to be_valid
    end

    it "rejects negative position" do
      topic.position = -1
      expect(topic).not_to be_valid
    end
  end

  describe "associations" do
    it "destroys join rows when the topic is destroyed" do
      topic = create(:ai_summary_topic, workspace: workspace, product: product)
      review = create(:review, :approved, workspace: workspace, product: product)
      topic.attach_reviews!([review.id])

      expect { topic.destroy! }.to change { AiSummaryTopicReview.count }.by(-1)
      expect(AiSummaryTopic.where(id: topic.id)).to be_empty
    end
  end

  describe "#attach_reviews!" do
    let(:topic)  { create(:ai_summary_topic, workspace: workspace, product: product) }
    let!(:r1)    { create(:review, :approved, workspace: workspace, product: product, rating: 5) }
    let!(:r2)    { create(:review, :approved, workspace: workspace, product: product, rating: 4) }
    let!(:other_ws)     { create(:workspace) }
    let!(:other_review) { create(:review, :approved, workspace: other_ws, product: create(:product, workspace: other_ws)) }

    it "attaches workspace-scoped reviews only" do
      attached = topic.attach_reviews!([r1.id, r2.id, other_review.id])
      expect(attached).to eq(2)
      expect(topic.reviews.reload).to contain_exactly(r1, r2)
    end

    it "is idempotent — repeated attach returns 0 new" do
      topic.attach_reviews!([r1.id, r2.id])
      attached = topic.attach_reviews!([r1.id, r2.id])
      expect(attached).to eq(0)
      expect(topic.reviews.reload.count).to eq(2)
    end

    it "refreshes review_count and stars_avg" do
      topic.attach_reviews!([r1.id, r2.id])
      topic.reload
      expect(topic.review_count).to eq(2)
      expect(topic.stars_avg).to eq(4.5)
    end

    it "ignores blank/nil ids gracefully" do
      attached = topic.attach_reviews!([nil, "", r1.id])
      expect(attached).to eq(1)
    end
  end

  describe "#detach_reviews!" do
    let(:topic) { create(:ai_summary_topic, workspace: workspace, product: product) }
    let!(:r1)   { create(:review, :approved, workspace: workspace, product: product, rating: 5) }
    let!(:r2)   { create(:review, :approved, workspace: workspace, product: product, rating: 3) }

    before { topic.attach_reviews!([r1.id, r2.id]) }

    it "detaches specified reviews and refreshes counts" do
      detached = topic.detach_reviews!([r1.id])
      topic.reload
      expect(detached).to eq(1)
      expect(topic.review_count).to eq(1)
      expect(topic.stars_avg).to eq(3.0)
    end

    it "detaches all when ids omitted" do
      detached = topic.detach_reviews!
      topic.reload
      expect(detached).to eq(2)
      expect(topic.review_count).to eq(0)
      expect(topic.stars_avg).to be_nil
    end
  end

  describe ".ordered" do
    it "sorts by position ascending then created_at" do
      a = create(:ai_summary_topic, workspace: workspace, product: product, position: 2)
      b = create(:ai_summary_topic, workspace: workspace, product: product, position: 0)
      c = create(:ai_summary_topic, workspace: workspace, product: product, position: 1)
      expect(AiSummaryTopic.ordered.pluck(:id)).to eq([b.id, c.id, a.id])
    end
  end
end

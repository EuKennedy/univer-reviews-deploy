require "rails_helper"

RSpec.describe Review, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:rating) }

    it "rejects rating below 1" do
      expect(build(:review, rating: 0)).not_to be_valid
    end

    it "rejects rating above 5" do
      expect(build(:review, rating: 6)).not_to be_valid
    end

    it "accepts valid ratings" do
      (1..5).each do |r|
        expect(build(:review, rating: r)).to be_valid
      end
    end
  end

  describe "scopes" do
    let!(:approved_review) { create(:review, :approved) }
    let!(:pending_review)  { create(:review) }

    it ".approved returns only approved reviews" do
      expect(Review.approved).to include(approved_review)
      expect(Review.approved).not_to include(pending_review)
    end
  end

  describe "#approve!" do
    it "sets status to approved and sets approved_at" do
      review = create(:review)
      review.approve!
      expect(review.reload.status).to eq("approved")
      expect(review.approved_at).to be_present
    end
  end

  describe "#has_photo?" do
    it "returns false when no media" do
      review = create(:review)
      expect(review.has_photo?).to be false
    end
  end
end

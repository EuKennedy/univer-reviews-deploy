require "rails_helper"

RSpec.describe Api::V1::TrackingController, type: :request do
  let!(:workspace) { create(:workspace) }
  let!(:campaign)  { create(:campaign, workspace: workspace) }
  let!(:send_rec)  { create(:campaign_send, workspace: workspace, campaign: campaign, status: "sent") }

  let(:signed) { Api::V1::TrackingController.sign(send_rec.id) }

  describe "GET /api/v1/email/open" do
    it "returns a 1x1 GIF and marks opened with a valid signature" do
      get "/api/v1/email/open", params: { s: signed }
      expect(response).to have_http_status(:ok)
      expect(response.content_type).to start_with("image/gif")
      expect(send_rec.reload.opened_count).to eq(1)
    end

    it "ignores a tampered signature but still returns the pixel" do
      get "/api/v1/email/open", params: { s: "tampered-#{signed}" }
      expect(response).to have_http_status(:ok)
      expect(send_rec.reload.opened_count).to eq(0)
    end
  end

  describe "GET /api/v1/email/click" do
    let(:target) { "https://example.com/produto/abc" }
    let(:encoded) { Base64.urlsafe_encode64(target) }

    it "redirects to the decoded URL and marks click" do
      get "/api/v1/email/click", params: { s: signed, u: encoded }
      expect(response).to have_http_status(:found)
      expect(response.location).to eq(target)
      expect(send_rec.reload.clicked_count).to eq(1)
    end

    it "rejects non-http(s) schemes with 400" do
      bad = Base64.urlsafe_encode64("javascript:alert(1)")
      get "/api/v1/email/click", params: { s: signed, u: bad }
      expect(response).to have_http_status(:bad_request)
    end

    it "rejects tampered signatures with 400" do
      get "/api/v1/email/click", params: { s: "tampered", u: encoded }
      expect(response).to have_http_status(:bad_request)
    end
  end
end

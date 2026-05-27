require "rails_helper"

# Coverage:
#   • happy-path SVG upload returns 200 + sets workspace.rating_icon_filled
#   • PNG upload accepted
#   • content-type allow list (txt/gif rejected with 422)
#   • size limit (>500 KB rejected with 422)
#   • SVG with <script> rejected with 422 (XSS guard)
#   • SVG with onclick rejected with 422
#   • SVG with javascript: URL rejected with 422
#   • DELETE clears the column and pings StorageService.delete
#
# StorageService is stubbed end-to-end so the spec doesn't touch MinIO/S3.
RSpec.describe Api::V1::WorkspaceBrandAssetsController, type: :request do
  let!(:workspace) { create(:workspace) }
  let!(:raw_key)   { "unvr_#{SecureRandom.hex(32)}" }
  let!(:api_key) do
    create(:workspace_api_key,
           workspace: workspace,
           key_hash:  Digest::SHA256.hexdigest(raw_key),
           key_prefix: raw_key[0, 8],
           scopes:    "read,write")
  end

  let(:auth_headers) do
    {
      "Authorization" => "Bearer #{raw_key}",
      "Accept"        => "application/json",
    }
  end

  before do
    allow_any_instance_of(ApplicationController).to receive(:set_rls_workspace)

    @stored_url = "https://cdn.example.com/test-bucket/workspaces/#{workspace.id}/brand/rating-icon-deadbeef.svg"
    @storage = instance_double(StorageService)
    allow(StorageService).to receive(:new).and_return(@storage)
    allow(@storage).to receive(:upload).and_return(@stored_url)
    allow(@storage).to receive(:delete)
  end

  def upload(file_fixture, content_type: "image/svg+xml", filename: "icon.svg")
    file = Rack::Test::UploadedFile.new(
      StringIO.new(file_fixture),
      content_type,
      original_filename: filename,
    )
    post "/api/v1/workspace/brand-assets/rating-icon",
         params: { file: file },
         headers: auth_headers
  end

  describe "POST /workspace/brand-assets/rating-icon" do
    it "stores a clean SVG and writes the URL onto the workspace" do
      svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z"/></svg>'

      upload(svg)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig("data", "rating_icon_url")).to eq(@stored_url)

      expect(@storage).to have_received(:upload).with(
        hash_including(
          key: a_string_starting_with("workspaces/#{workspace.id}/brand/rating-icon-"),
          content_type: "image/svg+xml",
          public: true,
        ),
      )

      expect(workspace.reload.rating_icon_filled).to eq(@stored_url)
    end

    it "accepts a PNG upload" do
      png_bytes = "\x89PNG\r\n\x1a\n" + ("A" * 200) # not a real PNG, but bytes are inert

      upload(png_bytes, content_type: "image/png", filename: "icon.png")

      expect(response).to have_http_status(:ok)
      expect(@storage).to have_received(:upload).with(
        hash_including(content_type: "image/png"),
      )
    end

    it "rejects unsupported content types" do
      upload("plain", content_type: "text/plain", filename: "icon.txt")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("unsupported_type")
      expect(workspace.reload.rating_icon_filled).to be_blank
    end

    it "rejects files larger than the 500 KB cap" do
      huge_svg = "<svg>" + ("x" * (Api::V1::WorkspaceBrandAssetsController::MAX_BYTES + 1)) + "</svg>"

      upload(huge_svg)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("too_large")
    end

    it "rejects SVG carrying <script> (XSS guard)" do
      evil = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M1 1"/></svg>'

      upload(evil)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("unsafe_svg")
      expect(@storage).not_to have_received(:upload)
    end

    it "rejects SVG with inline event handlers" do
      evil = '<svg xmlns="http://www.w3.org/2000/svg"><path onclick="x()" d="M1 1"/></svg>'

      upload(evil)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("unsafe_svg")
    end

    it "rejects SVG with javascript: URLs" do
      evil = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><path d="M1 1"/></a></svg>'

      upload(evil)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("unsafe_svg")
    end

    it "rejects SVG with <foreignObject>" do
      evil = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe/></foreignObject></svg>'

      upload(evil)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to eq("unsafe_svg")
    end

    it "returns 400 when no file is attached" do
      post "/api/v1/workspace/brand-assets/rating-icon", headers: auth_headers

      expect(response).to have_http_status(:bad_request)
      expect(JSON.parse(response.body)["error"]).to eq("file_required")
    end
  end

  describe "DELETE /workspace/brand-assets/rating-icon" do
    it "clears the column and asks StorageService to delete the previous object" do
      workspace.update!(
        rating_icon_filled: "https://cdn.example.com/test-bucket/workspaces/#{workspace.id}/brand/rating-icon-old.svg",
      )
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AWS_S3_ENDPOINT").and_return("https://cdn.example.com")
      stub_const("S3_BUCKET", "test-bucket")

      delete "/api/v1/workspace/brand-assets/rating-icon", headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("data", "rating_icon_url")).to be_nil
      expect(workspace.reload.rating_icon_filled).to be_blank

      expect(@storage).to have_received(:delete).with(
        "workspaces/#{workspace.id}/brand/rating-icon-old.svg",
      )
    end

    it "is a no-op when no icon was set" do
      delete "/api/v1/workspace/brand-assets/rating-icon", headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(@storage).not_to have_received(:delete)
    end
  end
end

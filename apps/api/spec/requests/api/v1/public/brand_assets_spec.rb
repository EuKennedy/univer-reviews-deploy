require "rails_helper"

# Public brand-asset proxy. Streams the workspace rating icon from object
# storage through our own origin so the storefront widget (running on
# third-party domains) can load it via CSS mask-image without the bucket
# being public.
#
# StorageService is stubbed end-to-end so the spec never touches MinIO/S3.
RSpec.describe "Api::V1::Public::BrandAssets", type: :request do
  # Workspace IDs are UUIDs — the key MUST use that shape (a numeric stub here
  # previously masked a KEY_RE bug that rejected every real icon with 400).
  let(:key)   { "public/workspaces/4ab0b6f8-f0b5-4299-b830-d5e30bfe4ce7/brand/rating-icon-deadbeef.svg" }
  let(:token) { Api::V1::Public::BrandAssetsController.encode_token(key) }
  let(:svg)   { '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1"/></svg>' }

  let(:storage) { instance_double(StorageService) }

  before { allow(StorageService).to receive(:new).and_return(storage) }

  def get_icon(tok) = get("/api/v1/public/brand-assets/rating-icon/#{tok}")

  it "streams the object with its content-type and immutable cache headers" do
    allow(storage).to receive(:download).with(key)
      .and_return({ body: svg, content_type: "image/svg+xml" })

    get_icon(token)

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("image/svg+xml")
    expect(response.body).to eq(svg)
    expect(response.headers["Cache-Control"]).to include("immutable")
    expect(response.headers["X-Content-Type-Options"]).to eq("nosniff")
  end

  it "requires no authentication (public asset)" do
    allow(storage).to receive(:download)
      .and_return({ body: svg, content_type: "image/svg+xml" })

    get_icon(token) # no auth headers at all

    expect(response).to have_http_status(:ok)
  end

  it "404s when the object is missing" do
    allow(storage).to receive(:download).with(key).and_return(nil)

    get_icon(token)

    expect(response).to have_http_status(:not_found)
  end

  it "refuses tokens that decode outside the brand-asset namespace (no arbitrary reads)" do
    evil = Api::V1::Public::BrandAssetsController.encode_token("secrets/db-password.txt")
    expect(storage).not_to receive(:download)

    get_icon(evil)

    expect(response).to have_http_status(:bad_request)
  end

  it "round-trips encode/decode of a key" do
    expect(Api::V1::Public::BrandAssetsController.decode_token(token)).to eq(key)
  end
end

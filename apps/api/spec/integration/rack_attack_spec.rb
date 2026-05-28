require "rails_helper"

# Rack::Attack contract — verifies that:
#   1. Health endpoints are always allowed (safelist).
#   2. /api/v1/ai/ throttle keys off workspace identifier (X-Univer-Workspace-Id).
#   3. 429 body matches the contract the frontend reads.
#
# Uses Rack::Attack's MemoryStore (already wired for Rails.env.test in
# config/initializers/rack_attack.rb) so specs don't need Redis.
RSpec.describe "Rack::Attack throttles", type: :request do
  before do
    Rack::Attack.cache.store.clear if Rack::Attack.cache.store.respond_to?(:clear)
  end

  describe "safelist" do
    it "never throttles /api/health" do
      120.times { get "/api/health" }
      # Last response should not be 429. We don't require :ok here because
      # /api/health may legitimately return :service_unavailable in CI if
      # the DB ping fails — but a 429 means the safelist broke.
      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "AI endpoint per-workspace throttle" do
    let(:headers) { { "X-Univer-Workspace-Id" => "ws-aaaa" } }

    it "rate-limits AI burst per workspace (60/min)" do
      # The /api/v1/ai/health endpoint is unauthenticated and free to call.
      # Throttle is 60/min/workspace; 61 should trip.
      61.times { get "/api/v1/ai/health", headers: headers }
      expect(response).to have_http_status(:too_many_requests)

      body = JSON.parse(response.body)
      expect(body["error"]).to eq("rate_limited")
      expect(body["retry_after_seconds"]).to be_a(Integer)
    end

    it "second workspace has its own bucket" do
      60.times { get "/api/v1/ai/health", headers: { "X-Univer-Workspace-Id" => "ws-aaaa" } }
      # First workspace is now at the limit. Second workspace should still
      # be admitted.
      get "/api/v1/ai/health", headers: { "X-Univer-Workspace-Id" => "ws-bbbb" }
      expect(response).not_to have_http_status(:too_many_requests)
    end
  end
end

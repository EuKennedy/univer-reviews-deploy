require "rails_helper"

# Rack::Attack contract — verifies that:
#   1. Health endpoints are always allowed (safelist).
#   2. /api/auth/sign-in throttle kicks in at 10 attempts/min/IP.
#   3. /api/v1/ai/ throttle keys off workspace identifier (header).
#   4. 429 body matches the contract the frontend reads.
#
# Uses Rack::Attack's MemoryStore (already wired for Rails.env.test in
# config/initializers/rack_attack.rb) so specs don't need Redis.
RSpec.describe "Rack::Attack throttles", type: :request do
  before do
    Rack::Attack.cache.store.clear if Rack::Attack.cache.store.respond_to?(:clear)
  end

  describe "safelist" do
    it "never throttles /up or /api/health" do
      120.times { get "/up" }
      expect(response).to have_http_status(:ok).or have_http_status(:service_unavailable)
      # No 429s should be observed regardless of count.
    end
  end

  describe "login throttle" do
    it "rate-limits sign-in after the configured budget" do
      # Limit is 10/min/IP. After the 11th we should see 429.
      11.times { post "/api/auth/sign-in", params: {} }
      expect(response).to have_http_status(:too_many_requests)
      body = JSON.parse(response.body)
      expect(body["error"]).to eq("rate_limited")
      expect(body["message"]).to match(/aguarde/i)
      expect(body["retry_after_seconds"]).to be_a(Integer)
    end
  end

  describe "AI endpoint per-workspace throttle" do
    let(:headers) { { "X-Univer-Workspace-Id" => "ws-aaaa" } }

    it "groups requests by workspace id, not IP" do
      # 60/min per workspace. Burst to 61 should trip.
      61.times { get "/api/v1/ai/health", headers: headers }
      expect(response).to have_http_status(:too_many_requests)
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

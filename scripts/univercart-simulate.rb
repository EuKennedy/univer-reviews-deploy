#!/usr/bin/env ruby
# frozen_string_literal: true

# Simulate the Univercart Connect flow end-to-end without Univercart.
#
# What this does:
#   1. Builds a fake `entitlement.granted` payload (the buyer's purchase).
#   2. HMAC-signs it with UNIVERCART_WEBHOOK_SECRET and POSTs to
#      `/api/v1/webhooks/univercart`. Our side provisions the workspace
#      + auth.user + workspace_user.
#   3. Mints a matching HS256 magic-link JWT with UNIVERCART_JWT_SECRET.
#   4. Prints the magic-link URL.
#
# Click the URL in a browser, /connect/setup verifies the JWT, calls our
# redeem proxy (short-circuited by UNIVERCART_DEV_SKIP_REDEEM=1 so we
# don't need a real Univercart endpoint), mints a Better Auth session,
# and lands the buyer on /<workspace>/dashboard.
#
# REQUIRED env vars:
#   UNIVERCART_WEBHOOK_SECRET   matching what's set on the API
#   UNIVERCART_JWT_SECRET       matching what /connect/setup verifies with
#   UNIVERCART_PARTNER_SLUG     defaults to "univerreviews"
#   API_BASE                    defaults to "https://api.univerreviews.com"
#   DASH_BASE                   defaults to "https://dash.univerreviews.com"
#
# OPTIONAL:
#   EMAIL                       buyer email; default "buyer-<rand>@example.com"
#   NAME                        buyer name;  default derived from email
#   ROLE                        entry|medium|ultra; default "medium"
#   SUB_ID                      subscription id; default "sub_<hex>"
#
# Usage:
#   chmod +x scripts/univercart-simulate.rb
#   EMAIL=test@meusite.com ROLE=ultra ./scripts/univercart-simulate.rb
#
# Before running, set `UNIVERCART_DEV_SKIP_REDEEM=1` on the API container
# (Coolify env) so the redeem proxy doesn't try to call real Univercart.
# REMOVE the env var after testing — never run with it in production.

require "json"
require "net/http"
require "openssl"
require "securerandom"
require "uri"
require "base64"
require "time"

# ── Config ───────────────────────────────────────────────────────────────
WEBHOOK_SECRET = ENV.fetch("UNIVERCART_WEBHOOK_SECRET") do
  abort "ERROR: UNIVERCART_WEBHOOK_SECRET env var required"
end
JWT_SECRET = ENV.fetch("UNIVERCART_JWT_SECRET") do
  abort "ERROR: UNIVERCART_JWT_SECRET env var required"
end
PARTNER_SLUG = ENV.fetch("UNIVERCART_PARTNER_SLUG", "univerreviews")
API_BASE     = ENV.fetch("API_BASE",  "https://api.univerreviews.com")
DASH_BASE    = ENV.fetch("DASH_BASE", "https://dash.univerreviews.com")

email = ENV["EMAIL"] || "buyer-#{SecureRandom.hex(4)}@example.com"
name  = ENV["NAME"]  || email.split("@").first.gsub("-", " ").capitalize
role  = ENV["ROLE"]  || "medium"
unless %w[entry medium ultra].include?(role)
  abort "ERROR: ROLE must be entry|medium|ultra (got #{role.inspect})"
end
sub_id = ENV["SUB_ID"] || "sub_#{SecureRandom.hex(6)}"
event_id = "evt_#{SecureRandom.uuid}"
jti = "jti_#{SecureRandom.hex(8)}"
now = Time.now.utc

valid_until = (now + (30 * 24 * 60 * 60)).iso8601

# ── 1. Build payload ─────────────────────────────────────────────────────
magic_link_path = "/connect/setup"
payload = {
  "id"       => event_id,
  "type"     => "entitlement.granted",
  "version"  => "v1",
  "created"  => now.to_i,
  "livemode" => true,
  "data" => {
    "externalUserId" => sub_id,
    "email"          => email,
    "name"           => name,
    "role"           => role,
    "productSlug"    => "review-suite",
    "planId"         => "plan_test_#{role}",
    "billingPeriod"  => "monthly",
    "amountCents"    => 9990,
    "currency"       => "BRL",
    "validUntil"     => valid_until,
    "trial"          => false,
    "trialEndsAt"    => nil,
    "magicLinkJti"   => jti,
    # `magicLinkUrl` is what Univercart would put in the email body.
    # The actual URL we hand the user later carries the *fresh* JWT we
    # mint below — this field on the payload is informational only and
    # mirrors the contract.
    "magicLinkUrl"   => "#{DASH_BASE}#{magic_link_path}?t=<JWT_placeholder>",
  },
}.to_json

# ── 2. HMAC sign + POST webhook ──────────────────────────────────────────
t = now.to_i
hmac = OpenSSL::HMAC.hexdigest("SHA256", WEBHOOK_SECRET, "#{t}.#{payload}")
signature_header = "t=#{t},v1=#{hmac}"

uri = URI.parse("#{API_BASE}/api/v1/webhooks/univercart")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = uri.scheme == "https"
http.read_timeout = 30
req = Net::HTTP::Post.new(uri.request_uri)
req["Content-Type"] = "application/json"
req["X-Univercart-Signature"] = signature_header
req["Idempotency-Key"] = event_id
req["User-Agent"] = "Univercart-Simulate/1.0"
req.body = payload

puts "── Step 1: POST webhook ───────────────────────────────────────────"
puts "  endpoint:  #{uri}"
puts "  event_id:  #{event_id}"
puts "  sub_id:    #{sub_id}"
puts "  email:     #{email}"
puts "  role:      #{role}"
puts ""

res = http.request(req)
puts "  status:    #{res.code}"
puts "  body:      #{res.body.to_s[0, 500]}"
puts ""

unless res.code.to_i == 200
  abort "ERROR: webhook failed (#{res.code}). Aborting — magic-link would 404 on the user lookup."
end

# ── 3. Mint magic-link JWT ───────────────────────────────────────────────
def b64url(bytes)
  Base64.urlsafe_encode64(bytes).delete("=")
end

header  = b64url({ alg: "HS256", typ: "JWT" }.to_json)
exp = (now + (72 * 60 * 60)).to_i
claims = {
  sub:   sub_id,
  email: email,
  name:  name,
  role:  role,
  iss:   "univercart",
  aud:   PARTNER_SLUG,
  exp:   exp,
  iat:   now.to_i,
  jti:   jti,
}.to_json
payload_b64 = b64url(claims)
signing_input = "#{header}.#{payload_b64}"
sig_b64 = b64url(OpenSSL::HMAC.digest("SHA256", JWT_SECRET, signing_input))
jwt = "#{signing_input}.#{sig_b64}"

magic_link = "#{DASH_BASE}#{magic_link_path}?t=#{jwt}"

puts "── Step 2: Magic-link URL (cole no browser) ──────────────────────"
puts ""
puts "  #{magic_link}"
puts ""
puts "── Notes ─────────────────────────────────────────────────────────"
puts "  - JTI:        #{jti}"
puts "  - JWT exp:    #{Time.at(exp).utc.iso8601} (72h)"
puts "  - workspace:  query DB → SELECT slug FROM workspaces WHERE univercart_subscription_id='#{sub_id}';"
puts ""
puts "  Reminder: /connect/setup will call /api/v1/connect/redeem/#{jti}."
puts "  Set UNIVERCART_DEV_SKIP_REDEEM=1 on the API container (Coolify env)"
puts "  so the proxy short-circuits without hitting real Univercart."
puts "  REMOVE that env var after testing."

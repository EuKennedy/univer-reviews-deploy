require "rails_helper"

RSpec.describe Univercart::SignatureVerifier, type: :service do
  let(:secret) { "whsec_test_64_chars_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
  let(:body)   { '{"id":"evt_abc","type":"entitlement.granted","data":{}}' }
  let(:now)    { Time.utc(2026, 5, 29, 12, 0, 0) }
  let(:clock)  { class_double("Time", now: now) }

  def sign(b, ts, sec = secret)
    "t=#{ts.to_i},v1=#{OpenSSL::HMAC.hexdigest('SHA256', sec, "#{ts.to_i}.#{b}")}"
  end

  describe ".verify" do
    it "returns :ok for a fresh signature" do
      header = sign(body, now)
      expect(described_class.verify(secret: secret, raw_body: body, signature_header: header, clock: clock)).to eq(:ok)
    end

    it "returns :no_secret when the secret is empty" do
      expect(described_class.verify(secret: "", raw_body: body, signature_header: sign(body, now), clock: clock)).to eq(:no_secret)
    end

    it "returns :missing when the header is absent" do
      expect(described_class.verify(secret: secret, raw_body: body, signature_header: nil, clock: clock)).to eq(:missing)
      expect(described_class.verify(secret: secret, raw_body: body, signature_header: "",  clock: clock)).to eq(:missing)
    end

    it "returns :malformed when t or v1 is missing" do
      expect(described_class.verify(secret: secret, raw_body: body, signature_header: "v1=abc", clock: clock)).to eq(:malformed)
      expect(described_class.verify(secret: secret, raw_body: body, signature_header: "t=#{now.to_i}", clock: clock)).to eq(:malformed)
    end

    it "returns :malformed when v1 is not hex" do
      header = "t=#{now.to_i},v1=this-is-not-hex"
      expect(described_class.verify(secret: secret, raw_body: body, signature_header: header, clock: clock)).to eq(:malformed)
    end

    it "returns :replay when timestamp is more than 5 min off the clock" do
      stale = now - 6.minutes
      header = sign(body, stale)
      expect(described_class.verify(secret: secret, raw_body: body, signature_header: header, clock: clock)).to eq(:replay)
    end

    it "returns :replay for a future-dated signature outside the window" do
      future = now + 6.minutes
      header = sign(body, future)
      expect(described_class.verify(secret: secret, raw_body: body, signature_header: header, clock: clock)).to eq(:replay)
    end

    it "returns :mismatch when the HMAC was made with a different secret" do
      header = sign(body, now, "different-secret")
      expect(described_class.verify(secret: secret, raw_body: body, signature_header: header, clock: clock)).to eq(:mismatch)
    end

    it "returns :mismatch when the body was tampered post-signing" do
      header   = sign(body, now)
      tampered = body.sub("entitlement.granted", "entitlement.revoked")
      expect(described_class.verify(secret: secret, raw_body: tampered, signature_header: header, clock: clock)).to eq(:mismatch)
    end
  end
end

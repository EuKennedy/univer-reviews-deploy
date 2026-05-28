require "rails_helper"

RSpec.describe Payment::MagicLinkIssuer do
  let(:email) { "buyer-#{SecureRandom.hex(3)}@example.com" }
  let(:name)  { "Buyer Tester" }

  around do |example|
    original = ENV["RESEND_API_KEY"]
    example.run
    ENV["RESEND_API_KEY"] = original
  end

  describe ".issue!" do
    it "returns a Result with a 32-char alphabetic token, URL, and verification id and persists the row" do
      result = described_class.issue!(email: email, name: name)

      expect(result.token).to match(/\A[a-zA-Z]{32}\z/)
      expect(result.verification_id).to match(/\A[0-9a-f]{8}-/)
      expect(result.url).to include("/api/auth/magic-link/verify?token=")
      expect(result.url).to include(CGI.escape(result.token))

      # Verify the row exists in auth.verification — query via raw SQL since
      # there's no AR model for the auth schema.
      row = ActiveRecord::Base.connection.exec_query(
        "SELECT identifier, value, expires_at FROM auth.verification WHERE id = $1",
        "select_verify",
        [result.verification_id]
      ).first
      expect(row).to be_present
      expect(row["identifier"]).to eq(result.token)
      parsed = JSON.parse(row["value"])
      expect(parsed["email"]).to eq(email)
      expect(parsed["name"]).to eq(name)
      # Expires within 24h ± 5s of now
      expires = row["expires_at"].is_a?(Time) ? row["expires_at"] : Time.parse(row["expires_at"].to_s)
      expect(expires).to be_within(5.seconds).of(24.hours.from_now)
    end

    it "raises on blank email" do
      expect { described_class.issue!(email: "", name: name) }.to raise_error(ArgumentError, /email required/)
    end

    it "builds a URL pointing at ADMIN_URL with token + callbackURL" do
      stub_const("Payment::MagicLinkIssuer::ADMIN_URL", "https://dash.example.com")
      result = described_class.issue!(email: email, name: name, callback_path: "/onboarding")
      expect(result.url).to start_with("https://dash.example.com/api/auth/magic-link/verify?token=")
      expect(result.url).to include("callbackURL=#{CGI.escape('/onboarding')}")
    end
  end

  describe ".send_email!" do
    let(:url) { "https://app.example.com/api/auth/magic-link/verify?token=stub" }

    it "skips sending and returns false when RESEND_API_KEY is missing" do
      ENV["RESEND_API_KEY"] = nil
      expect(Resend::Emails).not_to receive(:send)
      ok = described_class.send_email!(email: email, name: name, url: url, workspace_name: "Acme")
      expect(ok).to be(false)
    end

    it "calls Resend::Emails.send with the rendered template when key is present" do
      ENV["RESEND_API_KEY"] = "re_test_123"
      payload = nil
      allow(Resend::Emails).to receive(:send) { |args| payload = args; OpenStruct.new(id: "msg_1") }

      ok = described_class.send_email!(email: email, name: name, url: url, workspace_name: "Acme")
      expect(ok).to be(true)
      expect(payload[:to]).to eq(email)
      expect(payload[:subject]).to include("Acme")
      # URL is html-escaped inside the template (& → &amp;)
      expect(payload[:html]).to include(ERB::Util.html_escape(url))
    end

    it "swallows Resend errors and returns false" do
      ENV["RESEND_API_KEY"] = "re_test_123"
      allow(Resend::Emails).to receive(:send).and_raise(StandardError.new("boom"))

      ok = described_class.send_email!(email: email, name: name, url: url, workspace_name: "Acme")
      expect(ok).to be(false)
    end
  end
end

module Univercart
  # Verifies the `X-Univercart-Signature` header on inbound webhook
  # deliveries. Header format mirrors Stripe's:
  #
  #     X-Univercart-Signature: t=<unix_seconds>,v1=<hex_hmac_sha256>
  #
  # The HMAC fenced byte sequence is `"{t}.{raw_body}"` (UTF-8), keyed by
  # `ENV['UNIVERCART_WEBHOOK_SECRET']`. We also enforce a 5-minute replay
  # window — anything older than 300s gets rejected even when the HMAC
  # itself checks out.
  #
  # Constant-time comparison is mandatory: a non-constant-time check
  # leaks the matching prefix length and lets an attacker brute-force the
  # signature byte-by-byte through timing.
  class SignatureVerifier
    REPLAY_WINDOW_SECONDS = 300

    # @return [Symbol] :ok | :missing | :malformed | :replay | :mismatch | :no_secret
    def self.verify(secret:, raw_body:, signature_header:, clock: Time)
      new(secret: secret, raw_body: raw_body, signature_header: signature_header, clock: clock).verify
    end

    def initialize(secret:, raw_body:, signature_header:, clock: Time)
      @secret  = secret.to_s
      @body    = raw_body.to_s
      @header  = signature_header.to_s
      @clock   = clock
    end

    def verify
      return :no_secret if @secret.empty?
      return :missing   if @header.empty?

      parts = @header.split(",").each_with_object({}) do |segment, h|
        k, v = segment.strip.split("=", 2)
        h[k] = v if k && v
      end

      t  = Integer(parts["t"], 10) rescue nil
      v1 = parts["v1"].to_s
      return :malformed if t.nil? || v1.empty?
      return :malformed unless v1.match?(/\A[0-9a-fA-F]+\z/)

      # Replay window: reject events whose `t` is more than 5 min off the
      # server clock in either direction. Slow webhook retries can drift
      # but the doc commits to a 30s ack window, so 5min is generous.
      return :replay if (@clock.now.to_i - t).abs > REPLAY_WINDOW_SECONDS

      expected = OpenSSL::HMAC.hexdigest("SHA256", @secret, "#{t}.#{@body}")
      if ActiveSupport::SecurityUtils.secure_compare(expected.downcase, v1.downcase)
        :ok
      else
        :mismatch
      end
    end
  end
end

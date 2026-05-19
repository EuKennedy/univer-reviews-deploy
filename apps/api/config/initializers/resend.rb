# Resend API config.
#
# RESEND_API_KEY is read from the environment (set via Coolify for production).
# We don't crash on boot when the key is missing — Rails consoles, tests, and
# CI checks all need to load the app without a live key. The first send that
# actually hits Resend will fail loudly if the key is wrong.
api_key = ENV["RESEND_API_KEY"].to_s
if api_key.empty?
  Rails.logger.warn("[resend] RESEND_API_KEY not set — outbound emails will fail until configured")
end
Resend.api_key = api_key

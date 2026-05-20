# Scrub sensitive request params from log output.
#
# Rails 8 ships this initializer with a sensible default in `rails new`,
# but the file was missing from this codebase. Without it, request
# parameters were printed verbatim into the production log on every
# POST that carried passwords, API keys, webhook secrets, or OAuth
# credentials. A log shipper that forwards to S3 / Datadog / Logflare
# would persist those values indefinitely.
#
# Anything matching these names is replaced with [FILTERED] in
# `Parameters:` log lines and in error reports.

Rails.application.config.filter_parameters += %i[
  password
  password_confirmation
  passwd
  pwd
  secret
  token
  auth
  api_key
  apikey
  authorization
  bearer
  jwt
  refresh_token
  access_token
  id_token
  consumer_key
  consumer_secret
  webhook_secret
  stripe_secret_key
  anthropic_api_key
  resend_api_key
  client_secret
  private_key
  ssn
  cpf
  credit_card
  card
  cvv
  cvc
]

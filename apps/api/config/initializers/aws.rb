require "aws-sdk-s3"

Aws.config.update(
  access_key_id:     ENV.fetch("AWS_ACCESS_KEY_ID", nil),
  secret_access_key: ENV.fetch("AWS_SECRET_ACCESS_KEY", nil),
  region:            ENV.fetch("AWS_REGION", "us-east-1"),
  endpoint:          ENV.fetch("AWS_S3_ENDPOINT", nil),
  force_path_style:  ENV.fetch("AWS_S3_FORCE_PATH_STYLE", "false") == "true"
)

S3_BUCKET = ENV.fetch("AWS_S3_BUCKET", "univerreviews")

require "aws-sdk-s3"

# S3-compatible storage config. Production runs MinIO (self-hosted on the
# Coolify box); the AWS SDK talks to it over the S3 API.
#
# HISTORICAL BUG (fixed here): the docker-compose api/sidekiq services
# inject the MinIO connection as MINIO_ENDPOINT / MINIO_ACCESS_KEY /
# MINIO_SECRET_KEY / MINIO_BUCKET, but this initializer used to read only
# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_ENDPOINT / etc. The
# names never matched, so every credential resolved to nil and the SDK
# silently targeted real AWS S3 with no key — every StorageService.upload
# 500'd (surfaced in the admin as a generic "unknown" on the brand-icon
# upload, the first code path to actually exercise MinIO since review
# media comes in as external WooCommerce URLs).
#
# We now accept BOTH naming schemes, preferring explicit AWS_* when set
# and falling back to the MINIO_* names the compose file ships. force-
# path-style defaults to true because MinIO requires path-style addressing
# (bucket in the path, not the host) — virtual-host style only works on
# real AWS with DNS for every bucket.
Aws.config.update(
  access_key_id:
    ENV["AWS_ACCESS_KEY_ID"].presence ||
    ENV["MINIO_ACCESS_KEY"].presence  ||
    ENV["MINIO_ROOT_USER"].presence,
  secret_access_key:
    ENV["AWS_SECRET_ACCESS_KEY"].presence ||
    ENV["MINIO_SECRET_KEY"].presence      ||
    ENV["MINIO_ROOT_PASSWORD"].presence,
  region:           ENV.fetch("AWS_REGION", "us-east-1"),
  endpoint:
    ENV["AWS_S3_ENDPOINT"].presence ||
    ENV["MINIO_ENDPOINT"].presence,
  # MinIO needs path-style. Only flip to false when explicitly targeting
  # real AWS S3 (AWS_S3_FORCE_PATH_STYLE=false).
  force_path_style: ENV.fetch("AWS_S3_FORCE_PATH_STYLE", "true") == "true",
)

# Bucket name: prefer AWS_S3_BUCKET, fall back to the compose MINIO_BUCKET
# (`univer-media`), then a sane default. The previous hard default of
# "univerreviews" pointed at a bucket that doesn't exist in MinIO (the
# init container creates `univer-media`), so uploads 404'd the bucket
# even when creds were right.
S3_BUCKET =
  ENV["AWS_S3_BUCKET"].presence ||
  ENV["MINIO_BUCKET"].presence  ||
  "univer-media"

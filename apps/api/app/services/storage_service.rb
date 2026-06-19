class StorageService
  def initialize
    @client = Aws::S3::Client.new
    @bucket = S3_BUCKET
  end

  def upload(key:, body:, content_type:, public: false)
    args = {
      bucket: @bucket,
      key: key,
      body: body,
      content_type: content_type,
    }
    # Canned ACLs are deprecated in newer MinIO releases and a put_object
    # carrying `acl:` can fail with NotImplemented / AccessControlList-
    # NotSupported, which would 500 the whole upload. We attempt with the
    # ACL (works on real AWS + older MinIO), and on rejection retry
    # without it — public access then relies on the bucket's anonymous
    # download policy for the `public/` prefix (set by the minio-init
    # container). Callers that need public serving should key their
    # objects under `public/`.
    begin
      @client.put_object(args.merge(acl: public ? "public-read" : "private"))
    rescue Aws::S3::Errors::NotImplemented,
           Aws::S3::Errors::AccessControlListNotSupported,
           Aws::S3::Errors::InvalidRequest => e
      Rails.logger.warn("[storage] ACL rejected (#{e.class}); retrying without ACL for key=#{key}")
      @client.put_object(args)
    end

    url_for(key)
  end

  def presigned_url(key, expires_in: 3600)
    signer = Aws::S3::Presigner.new(client: @client)
    signer.presigned_url(:get_object, bucket: @bucket, key: key, expires_in: expires_in)
  end

  def delete(key)
    @client.delete_object(bucket: @bucket, key: key)
  end

  def url_for(key)
    endpoint = ENV.fetch("AWS_S3_ENDPOINT", nil)
    if endpoint.present?
      "#{endpoint}/#{@bucket}/#{key}"
    else
      "https://#{@bucket}.s3.#{ENV.fetch('AWS_REGION', 'us-east-1')}.amazonaws.com/#{key}"
    end
  end

  def review_media_key(workspace_id, review_id, filename)
    ext = File.extname(filename)
    "workspaces/#{workspace_id}/reviews/#{review_id}/#{SecureRandom.uuid}#{ext}"
  end
end

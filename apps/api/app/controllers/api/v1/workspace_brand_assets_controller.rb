module Api
  module V1
    # Brand-asset uploads for the current workspace.
    #
    # Currently exposes:
    #   POST   /workspace/brand-assets/rating-icon  — replace the custom
    #                                                 star icon (SVG or PNG)
    #   DELETE /workspace/brand-assets/rating-icon  — clear it (fall back
    #                                                 to preset star shape)
    #
    # SVG content is sniffed and rejected when it carries <script> tags or
    # `on*=` event handlers — the file ships to the storefront <img> tag
    # so we must not let workspaces sideload XSS payloads onto their own
    # customers. PNG uploads are accepted as-is.
    class WorkspaceBrandAssetsController < ApplicationController
      MAX_BYTES   = 500_000
      ALLOWED_MIME = %w[image/svg+xml image/png].freeze

      def upload_rating_icon
        require_write!

        file = params[:file]
        unless file.respond_to?(:read) && file.respond_to?(:original_filename)
          return render json: { error: "file_required", message: "Anexe um arquivo SVG ou PNG." }, status: :bad_request
        end

        content_type = (file.content_type.presence || "application/octet-stream").downcase

        unless ALLOWED_MIME.include?(content_type)
          return render json: {
            error: "unsupported_type",
            message: "Apenas SVG ou PNG. Recebido: #{content_type}.",
          }, status: :unprocessable_entity
        end

        body = file.read
        if body.bytesize > MAX_BYTES
          return render json: {
            error: "too_large",
            message: "Arquivo acima de #{MAX_BYTES / 1024} KB.",
          }, status: :unprocessable_entity
        end

        if content_type == "image/svg+xml" && unsafe_svg?(body)
          return render json: {
            error: "unsafe_svg",
            message: "SVG contém scripts ou handlers de evento e foi rejeitado.",
          }, status: :unprocessable_entity
        end

        ext = content_type == "image/svg+xml" ? ".svg" : ".png"
        key = "workspaces/#{current_workspace.id}/brand/rating-icon-#{SecureRandom.hex(8)}#{ext}"

        url = StorageService.new.upload(
          key: key,
          body: body,
          content_type: content_type,
          public: true,
        )

        old_key = extract_key_from_url(current_workspace.rating_icon_filled)
        current_workspace.update!(rating_icon_filled: url)

        # Best-effort cleanup of the previous asset so the bucket doesn't
        # accumulate stale icons every time the merchant re-uploads. Soft
        # failure — we already saved the new pointer, the old object is a
        # cosmetic concern.
        if old_key.present? && old_key != key
          begin
            StorageService.new.delete(old_key)
          rescue => e
            Rails.logger.warn("[brand_assets] failed to delete old icon #{old_key}: #{e.message}")
          end
        end

        AuditLog.record(
          workspace: current_workspace,
          action: "workspace.rating_icon_uploaded",
          metadata: { content_type: content_type, bytes: body.bytesize },
          request: request,
        )

        render json: { data: { rating_icon_url: url } }
      end

      def destroy_rating_icon
        require_write!

        old_url = current_workspace.rating_icon_filled
        current_workspace.update!(rating_icon_filled: nil)

        old_key = extract_key_from_url(old_url)
        if old_key.present?
          begin
            StorageService.new.delete(old_key)
          rescue => e
            Rails.logger.warn("[brand_assets] failed to delete icon #{old_key}: #{e.message}")
          end
        end

        AuditLog.record(
          workspace: current_workspace,
          action: "workspace.rating_icon_removed",
          metadata: {},
          request: request,
        )

        render json: { data: { rating_icon_url: nil } }
      end

      private

      def unsafe_svg?(content)
        text = content.to_s
        return true if text =~ /<\s*script\b/i
        return true if text =~ /\son[a-z]+\s*=/i
        return true if text =~ /javascript\s*:/i
        return true if text =~ /<\s*foreignObject\b/i
        false
      end

      # The StorageService URLs look like
      #   "{AWS_S3_ENDPOINT}/{bucket}/{key}"  (MinIO/S3-compatible)
      # or
      #   "https://{bucket}.s3.{region}.amazonaws.com/{key}"
      # Translate either shape back to the bare object key so we can call
      # delete on it after a re-upload. Returns nil when the URL isn't ours.
      def extract_key_from_url(url)
        return nil if url.blank?

        endpoint = ENV["AWS_S3_ENDPOINT"].to_s
        bucket   = S3_BUCKET

        if endpoint.present? && url.start_with?(endpoint)
          path = url.sub(endpoint, "").sub(%r{\A/}, "")
          parts = path.split("/", 2)
          return parts[1] if parts[0] == bucket
        end

        amazon_prefix = "https://#{bucket}.s3."
        if url.start_with?(amazon_prefix)
          return url.split(".amazonaws.com/", 2).last
        end

        nil
      end
    end
  end
end

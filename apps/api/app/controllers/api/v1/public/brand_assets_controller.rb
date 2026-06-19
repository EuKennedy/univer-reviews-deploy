require "base64"

module Api
  module V1
    module Public
      # GET /api/v1/public/brand-assets/rating-icon/:token
      #
      # Streams a workspace brand asset (the custom rating icon) from object
      # storage THROUGH our own origin. Rationale:
      #
      #   * The storefront widget runs on arbitrary third-party domains and
      #     loads this asset via CSS `mask-image`. Pointing the browser at
      #     MinIO directly would require the bucket to be public + reachable
      #     + CSP-allowlisted on every merchant site. MinIO's endpoint is
      #     also frequently an internal docker host (`minio:9000`) the
      #     browser can't even resolve.
      #   * Serving via `api.univerreviews.com` gives a stable, HTTPS,
      #     CORS-`*`, CSP-friendly URL, keeps the bucket private, and lets us
      #     slap immutable cache headers on it (keys carry random hex, so the
      #     bytes never change for a given URL).
      #
      # `token` is the urlsafe-base64 of the object key. We ONLY ever serve
      # keys matching `public/workspaces/<id>/brand/<file>`, so a crafted
      # token can't be used to read arbitrary objects out of the bucket.
      class BrandAssetsController < ApplicationController
        # Object keys we are willing to stream. Locks the proxy to brand
        # assets and blocks path traversal / arbitrary-object reads.
        KEY_RE = %r{\Apublic/workspaces/\d+/brand/[A-Za-z0-9._\-]+\z}

        def rating_icon
          key = self.class.decode_token(params[:token])
          return head(:bad_request) unless key&.match?(KEY_RE)

          obj = StorageService.new.download(key)
          return head(:not_found) unless obj

          response.set_header("Cache-Control", "public, max-age=31536000, immutable")
          response.set_header("X-Content-Type-Options", "nosniff")
          # Defense in depth: <img>/mask contexts never execute SVG scripts,
          # but lock the asset down so it can never behave as an active
          # document if linked directly.
          response.set_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")

          send_data obj[:body],
                    type: obj[:content_type].presence || content_type_for(key),
                    disposition: "inline"
        end

        # Build the public proxy URL for a stored object key. Called by the
        # admin brand-asset upload so the saved `rating_icon_filled` points
        # at this proxy instead of a raw bucket URL.
        def self.icon_url(key, base_url)
          "#{base_url.to_s.chomp('/')}/api/v1/public/brand-assets/rating-icon/#{encode_token(key)}"
        end

        def self.encode_token(key)
          Base64.urlsafe_encode64(key, padding: false)
        end

        def self.decode_token(token)
          t = token.to_s
          t += "=" * ((4 - (t.length % 4)) % 4)
          Base64.urlsafe_decode64(t)
        rescue ArgumentError
          nil
        end

        private

        def content_type_for(key)
          key.end_with?(".svg") ? "image/svg+xml" : "image/png"
        end

        # No tenant context, no auth, no RLS — this is a pure public asset
        # proxy. Skipping authentication also skips the request transaction
        # and set_current_workspace (see ApplicationController).
        def skip_authentication?
          true
        end
      end
    end
  end
end

module Api
  module V1
    module Wp
      class SyncController < ApplicationController
        # GET /api/v1/wp/ping
        # Lightweight auth probe used by the WP plugin's "Testar conexão" button.
        # Returns workspace identity so the plugin can confirm the key + workspace
        # combination resolves to the right tenant.
        def ping
          render json: {
            ok: true,
            workspace: {
              id: current_workspace.id,
              slug: current_workspace.slug,
              name: current_workspace.name,
            },
            ts: Time.current.iso8601,
          }
        end

        # POST /api/v1/wp/sync
        def sync
          require_write!

          WooCommerceSyncJob.perform_later(current_workspace.id)
          WooCommerceImportJob.perform_later(current_workspace.id, nil)

          render json: { message: "WordPress sync queued (products + reviews)" }
        end
      end
    end
  end
end

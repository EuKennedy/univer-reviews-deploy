module Api
  module V1
    module Wp
      class SyncController < ApplicationController
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

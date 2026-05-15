module Api
  module V1
    module Webhooks
      class FeedspaceController < ApplicationController
        skip_before_action :set_current_workspace

        # POST /api/v1/webhooks/feedspace
        def create
          workspace_id = request.headers["X-Workspace-Id"] || params[:workspace_id]
          workspace = Workspace.find_by(id: workspace_id)

          unless workspace
            head :not_found
            return
          end

          set_rls_workspace(workspace.id)

          payload = JSON.parse(request.body.read)

          review = workspace.reviews.create!(
            source: "widget",
            rating: payload["rating"].to_i,
            body: payload["message"],
            author_name: payload["name"],
            author_email: payload["email"]&.downcase,
            status: "pending"
          )

          AiModerateJob.perform_later(review.id)

          head :ok
        rescue JSON::ParserError
          head :bad_request
        rescue => e
          Rails.logger.error("Feedspace webhook error: #{e.message}")
          head :internal_server_error
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

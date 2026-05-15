module Api
  module V1
    module Webhooks
      class ShopifyController < ApplicationController
        skip_before_action :set_current_workspace

        # POST /api/v1/webhooks/shopify
        def create
          shop_domain = request.headers["X-Shopify-Shop-Domain"]
          topic       = request.headers["X-Shopify-Topic"]

          domain_record = WorkspaceDomain.find_by(domain: shop_domain&.downcase)

          unless domain_record
            head :not_found
            return
          end

          @workspace = domain_record.workspace
          set_rls_workspace(@workspace.id)

          payload = JSON.parse(request.body.read)

          case topic
          when "orders/create", "orders/fulfilled"
            CampaignTriggerJob.perform_later(
              workspace_id: @workspace.id,
              order_id: payload["id"].to_s,
              customer_email: payload.dig("email"),
              order_status: payload["financial_status"],
              line_items: payload["line_items"] || []
            )
          end

          head :ok
        rescue JSON::ParserError
          head :bad_request
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

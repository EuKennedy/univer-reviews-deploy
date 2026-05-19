module Api
  module V1
    module Public
      # GET /api/v1/public/widget-config
      #
      # Returns the storefront customization payload for the workspace that
      # owns the calling domain. The `<univer-reviews>` web component calls
      # this on connect to pick up workspace-level defaults; explicit HTML
      # attributes always win over what the workspace ships here (precedence
      # is enforced inside the widget itself).
      class WidgetConfigController < ApplicationController
        skip_before_action :set_current_workspace
        before_action :resolve_workspace

        def show
          render json: { data: @workspace.widget_config }
        end

        private

        # Same progressive fallback as Api::V1::Public::ReviewsController —
        # apex matches cover staging.foo.com / www.foo.com without forcing
        # the admin to register every variant.
        def resolve_workspace
          domain_header = request.headers["X-Univer-Domain"] ||
                          request.headers["Origin"]&.gsub(/https?:\/\//, "")&.split("/")&.first

          if domain_header.blank?
            render json: { error: "domain_required", message: "X-Univer-Domain header required" }, status: :bad_request
            return
          end

          domain_record = find_workspace_domain(domain_header)

          unless domain_record
            render json: { error: "workspace_not_found", host: domain_header },
                   status: :not_found
            return
          end

          @workspace = domain_record.workspace
          set_rls_workspace(@workspace.id)
        end

        def find_workspace_domain(raw)
          host = raw.to_s.downcase.strip.sub(/^https?:\/\//, "").split("/").first.to_s
          host = host.split(":").first

          candidates = []
          candidates << host
          candidates << host.sub(/^www\./, "") if host.start_with?("www.")

          parts = host.split(".")
          while parts.length > 2
            parts.shift
            candidates << parts.join(".")
          end

          candidates.uniq.each do |c|
            d = WorkspaceDomain.find_by(domain: c)
            return d if d
          end
          nil
        end

        def skip_authentication?
          true
        end
      end
    end
  end
end

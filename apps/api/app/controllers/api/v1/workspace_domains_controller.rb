module Api
  module V1
    class WorkspaceDomainsController < ApplicationController
      # GET /api/v1/workspace/domains
      def index
        domains = current_workspace.workspace_domains.order(created_at: :asc)
        render json: { data: domains.map { |d| serialize_domain(d) } }
      end

      # POST /api/v1/workspace/domains
      # Accepts either:
      #   { "domain": "lizzon.com.br", "platform": "generic" }   ← flat
      #   { "domain": { "domain": "lizzon.com.br", ... } }       ← nested
      def create
        require_write!

        host, platform, meta = extract_domain_input
        if host.blank?
          render json: { error: "bad_request", message: "domain required" }, status: :bad_request
          return
        end

        # Idempotent — if the same host already exists for THIS workspace, return it.
        existing = current_workspace.workspace_domains.find_by(domain: host)
        if existing
          render json: { data: serialize_domain(existing) }, status: :ok
          return
        end

        domain = current_workspace.workspace_domains.new(
          domain: host,
          platform: platform.presence || "generic",
          platform_meta: meta || {}
        )

        if domain.save
          AuditLog.record(
            workspace: current_workspace,
            action: "domain.added",
            entity: domain,
            request: request
          )
          render json: { data: serialize_domain(domain) }, status: :created
        else
          render json: { error: "unprocessable_entity", issues: domain.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/workspace/domains/:id
      # `:id` accepts either the row UUID or the raw domain string.
      def destroy
        require_write!

        identifier = params[:id].to_s
        domain = current_workspace.workspace_domains.find_by(id: identifier) ||
                 current_workspace.workspace_domains.find_by(domain: identifier.downcase)

        unless domain
          render json: { error: "not_found" }, status: :not_found
          return
        end

        domain.destroy!

        AuditLog.record(
          workspace: current_workspace,
          action: "domain.removed",
          metadata: { domain: domain.domain },
          request: request
        )

        head :no_content
      end

      private

      def extract_domain_input
        raw_domain = params[:domain]
        case raw_domain
        when ActionController::Parameters, Hash
          permitted = raw_domain.is_a?(ActionController::Parameters) ?
            raw_domain.permit(:domain, :platform, platform_meta: {}) :
            ActionController::Parameters.new(raw_domain).permit(:domain, :platform, platform_meta: {})
          [normalize_host(permitted[:domain]), permitted[:platform], permitted[:platform_meta]]
        else
          [normalize_host(raw_domain || params[:host]), params[:platform], params[:platform_meta]]
        end
      end

      def normalize_host(raw)
        return nil if raw.blank?
        host = raw.to_s.strip.downcase
        host = host.sub(/^https?:\/\//, "").split("/").first.to_s
        host.split(":").first.presence
      end

      def serialize_domain(d)
        {
          id: d.id, domain: d.domain, platform: d.platform,
          verified: d.verified?, verified_at: d.verified_at&.iso8601,
          created_at: d.created_at&.iso8601
        }
      end
    end
  end
end

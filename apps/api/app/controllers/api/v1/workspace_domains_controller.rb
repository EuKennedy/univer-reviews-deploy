module Api
  module V1
    class WorkspaceDomainsController < ApplicationController
      # GET /api/v1/workspace/domains
      def index
        domains = current_workspace.workspace_domains.order(created_at: :asc)
        render json: { data: domains.map { |d| serialize_domain(d) } }
      end

      # POST /api/v1/workspace/domains
      def create
        require_write!

        domain = current_workspace.workspace_domains.new(domain_params)

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
      def destroy
        require_write!

        domain = current_workspace.workspace_domains.find(params[:id])
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

      def domain_params
        params.require(:domain).permit(:domain, :platform, platform_meta: {})
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

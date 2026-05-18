module Api
  module V1
    class WorkspaceDomainsController < ApplicationController
      # GET /api/v1/workspace/domains
      def index
        domains = current_workspace.workspace_domains.order(created_at: :asc)
        render json: { data: domains.map { |d| serialize_domain(d) } }
      end

      # POST /api/v1/workspace/domains
      #
      # Accepts every shape we have ever shipped a client with — backend
      # never explodes on parameter shape because clients in the wild are
      # mixed (the admin posts flat, older callers post nested):
      #
      #   { "domain": "lizzon.com.br", "platform": "generic" }    ← flat
      #   { "domain": { "domain": "lizzon.com.br", ... } }        ← nested
      #   { "host": "lizzon.com.br" }                             ← legacy
      def create
        require_write!

        host = pick_host
        if host.blank?
          render json: { error: "bad_request", message: "domain required" }, status: :bad_request
          return
        end

        host = normalize_host(host)
        platform = pick_platform

        # Idempotent for THIS workspace.
        existing = current_workspace.workspace_domains.find_by(domain: host)
        if existing
          render json: { data: serialize_domain(existing) }, status: :ok
          return
        end

        domain = current_workspace.workspace_domains.new(
          domain: host,
          platform: platform,
          platform_meta: {}
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
      rescue ActiveRecord::RecordNotUnique => e
        # Global uniqueness index on workspace_domains.domain — host attached
        # to another workspace already.
        Rails.logger.warn("[domains#create] unique violation host=#{host} err=#{e.message}")
        render json: {
          error: "conflict",
          message: "Esse domínio já está vinculado a outro workspace. Remova de lá antes."
        }, status: :conflict
      rescue => e
        Rails.logger.error("[domains#create] #{e.class}: #{e.message}\n#{e.backtrace.first(8).join("\n")}")
        render json: { error: "server_error", class: e.class.to_s, message: e.message },
               status: :internal_server_error
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

      def pick_host
        raw = params[:domain]
        return raw if raw.is_a?(String) && raw.present?
        if raw.respond_to?(:[]) && !raw.is_a?(String)
          inner = raw[:domain] || raw["domain"]
          return inner if inner.is_a?(String) && inner.present?
        end
        params[:host].to_s.presence
      end

      def pick_platform
        raw = params[:domain]
        if raw.respond_to?(:[]) && !raw.is_a?(String)
          val = raw[:platform] || raw["platform"]
          return val.to_s if val.present?
        end
        v = params[:platform].to_s
        valid = %w[woocommerce shopify generic]
        valid.include?(v) ? v : "generic"
      end

      def normalize_host(raw)
        host = raw.to_s.strip.downcase
        host = host.sub(/^https?:\/\//, "").split("/").first.to_s
        host.split(":").first.to_s
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

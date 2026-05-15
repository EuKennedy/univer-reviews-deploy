module Api
  module V1
    class WorkspaceApiKeysController < ApplicationController
      # GET /api/v1/workspace/api_keys
      def index
        keys = current_workspace.workspace_api_keys.order(created_at: :desc)
        render json: { data: keys.map { |k| serialize_key(k) } }
      end

      # POST /api/v1/workspace/api_keys
      def create
        require_write!

        record, raw_key = WorkspaceApiKey.generate(
          workspace: current_workspace,
          label: params.dig(:api_key, :label),
          scopes: params.dig(:api_key, :scopes) || "read,write",
          expires_in: params.dig(:api_key, :expires_in_days)&.to_i&.days
        )

        if record.save
          AuditLog.record(
            workspace: current_workspace,
            action: "api_key.created",
            entity: record,
            request: request
          )

          render json: {
            data: serialize_key(record),
            # Raw key shown ONLY once on creation
            key: raw_key
          }, status: :created
        else
          render json: { error: "unprocessable_entity", issues: record.errors.full_messages },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/workspace/api_keys/:id
      def destroy
        require_write!

        key = current_workspace.workspace_api_keys.find(params[:id])
        key.revoke!

        AuditLog.record(
          workspace: current_workspace,
          action: "api_key.revoked",
          entity: key,
          request: request
        )

        head :no_content
      end

      private

      def serialize_key(k)
        {
          id: k.id, key_prefix: k.key_prefix, label: k.label,
          scopes: k.scopes, active: k.active?,
          last_used_at: k.last_used_at&.iso8601,
          expires_at: k.expires_at&.iso8601,
          revoked_at: k.revoked_at&.iso8601,
          created_at: k.created_at&.iso8601
        }
      end
    end
  end
end

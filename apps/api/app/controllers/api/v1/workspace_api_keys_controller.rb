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

        # Accept either a flat payload ({ name, scopes, expires_in_days })
        # or a nested one ({ api_key: { label, scopes, expires_in_days } })
        # so older clients keep working.
        label_in = params[:label].presence ||
                   params[:name].presence ||
                   params.dig(:api_key, :label).presence ||
                   params.dig(:api_key, :name).presence
        scopes_in = params[:scopes].presence ||
                    params.dig(:api_key, :scopes).presence ||
                    "read,write"
        ttl_days = (params[:expires_in_days] || params.dig(:api_key, :expires_in_days)).to_i

        record, raw_key = WorkspaceApiKey.generate(
          workspace: current_workspace,
          label: label_in,
          scopes: scopes_in,
          expires_in: ttl_days.positive? ? ttl_days.days : nil
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
          id: k.id,
          # Emit both spellings so the client can read either.
          key_prefix: k.key_prefix, prefix: k.key_prefix,
          label: k.label, name: k.label,
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

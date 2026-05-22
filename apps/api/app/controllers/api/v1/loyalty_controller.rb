module Api
  module V1
    # Read-only loyalty config — the SaaS dashboard surfaces what's currently
    # synced from the Univer Loyalty WordPress plugin. Edits happen in the
    # plugin's admin UI and propagate here via /api/v1/wp/loyalty/sync.
    class LoyaltyController < ApplicationController
      # GET /api/v1/loyalty
      def index
        configs = current_workspace.loyalty_configs.ordered_by_priority

        render json: {
          data: configs.map { |c| serialize(c) },
          meta: {
            count:           configs.size,
            active_count:    configs.count(&:is_active),
            last_synced_at:  configs.maximum(:synced_at)&.iso8601,
            plugin_connected: configs.exists?,
          },
        }
      end

      private

      def serialize(config)
        {
          id:                 config.id,
          source_campaign_id: config.source_campaign_id,
          name:               config.name,
          description:        config.description,
          is_active:          config.is_active,
          rule_type:          config.rule_type,
          points_text:        config.points_text,
          points_photo:       config.points_photo,
          points_video:       config.points_video,
          base_points:        config.base_points,
          min_chars:          config.min_chars,
          only_logged_in:     config.only_logged_in,
          bonus_photo:        config.bonus_photo,
          bonus_video:        config.bonus_video,
          bonus_verified:     config.bonus_verified,
          priority:           config.priority,
          synced_at:          config.synced_at&.iso8601,
          updated_at:         config.updated_at&.iso8601,
        }
      end
    end
  end
end

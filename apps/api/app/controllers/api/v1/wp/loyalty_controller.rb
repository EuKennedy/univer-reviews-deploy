module Api
  module V1
    module Wp
      # Receives push from the Univer Loyalty WordPress plugin whenever a
      # merchant saves a campaign of action_type `review`. The plugin owns
      # the source of truth — we just mirror the config so the SaaS dashboard
      # can show what's currently in effect on the WP side.
      class LoyaltyController < ApplicationController
        # PUT /api/v1/wp/loyalty/sync
        def sync
          require_write!

          attrs = permitted_attrs
          if attrs[:source_campaign_id].nil? || attrs[:source_campaign_id] <= 0
            render json: { error: "invalid_campaign_id" }, status: :bad_request
            return
          end

          config = LoyaltyConfig.upsert_from_wp!(
            workspace: current_workspace,
            attrs:     attrs,
          )

          AuditLog.record(
            workspace: current_workspace,
            action:    "loyalty_config.synced_from_wp",
            entity:    config,
            metadata:  { source_campaign_id: config.source_campaign_id },
            request:   request,
          )

          render json: { data: serialize(config) }
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: "unprocessable_entity", issues: e.record.errors.full_messages },
                 status: :unprocessable_entity
        end

        # DELETE /api/v1/wp/loyalty/:source_campaign_id
        def destroy
          require_write!

          config = current_workspace.loyalty_configs
                                    .find_by(source_campaign_id: params[:source_campaign_id])
          return head :no_content unless config

          config.destroy!

          AuditLog.record(
            workspace: current_workspace,
            action:    "loyalty_config.deleted_from_wp",
            entity:    config,
            metadata:  { source_campaign_id: config.source_campaign_id },
            request:   request,
          )

          head :no_content
        end

        private

        MAX_POINTS = 1_000_000

        def permitted_attrs
          legacy_base   = params[:base_points].to_i.clamp(0, MAX_POINTS)
          legacy_bphoto = params[:bonus_photo].to_i.clamp(0, MAX_POINTS)
          legacy_bvideo = params[:bonus_video].to_i.clamp(0, MAX_POINTS)

          # Tier values: prefer explicit (review_tiers schema), fall back to
          # additive backfill if plugin is on an older version.
          points_text  = params.key?(:points_text)  ? params[:points_text].to_i.clamp(0, MAX_POINTS)  : legacy_base
          points_photo = params.key?(:points_photo) ? params[:points_photo].to_i.clamp(0, MAX_POINTS) : (legacy_base + legacy_bphoto)
          points_video = params.key?(:points_video) ? params[:points_video].to_i.clamp(0, MAX_POINTS) : (legacy_base + legacy_bvideo)

          {
            source_campaign_id: params[:campaign_id].to_i,
            name:               params[:name].to_s[0, 180],
            description:        params[:description].to_s[0, 4_000],
            is_active:          ActiveModel::Type::Boolean.new.cast(params[:is_active]),
            rule_type:          params[:rule_type].presence || "review_tiers",
            points_text:        points_text,
            points_photo:       points_photo,
            points_video:       points_video,
            base_points:        legacy_base,
            min_chars:          params[:min_chars].to_i.clamp(0, 100_000),
            only_logged_in:     ActiveModel::Type::Boolean.new.cast(params[:only_logged_in]),
            bonus_photo:        legacy_bphoto,
            bonus_video:        legacy_bvideo,
            bonus_verified:     params[:bonus_verified].to_i.clamp(0, MAX_POINTS),
            priority:           params[:priority].to_i.clamp(0, MAX_POINTS),
          }
        end

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
end

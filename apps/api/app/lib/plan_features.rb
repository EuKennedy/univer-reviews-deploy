# frozen_string_literal: true

# Single source of truth for what each subscription plan unlocks.
#
# Frontend mirrors this map via /api/v1/workspace which now surfaces
# `plan_features` so the admin can hide / disable / paywall UI cheaply.
# Backend enforces via PlanFeatures.require!(:feature, workspace) inside
# controllers — see `Concerns::PlanGated`.
#
# Keep the leaf set small + named after the user-visible action, not the
# implementation detail. "ai_summary_topics" not "anthropic_haiku_call".
#
# Plan ladder (T1.3): collapsed the legacy free/starter/pro/enterprise
# tuple into a three-tier paid funnel (entry/medium/ultra). Freemium was
# never live and the external payment platform doesn't support trials,
# so "entry" replaces both free and starter. See the rename migration's
# header for the rationale.
module PlanFeatures
  # Plans sorted weakest → strongest. Inclusion-based: stronger plans
  # inherit the features of weaker ones plus their own additions.
  TIERS = %w[entry medium ultra].freeze

  # Entry is the floor: a single operator running the storefront widget
  # with AI generation enabled. No bulk operations, no team, capped at
  # a small catalog.
  ENTRY_FEATURES = %i[
    reviews_basic
    widget_basic
    qa_basic
    workspace_branding
    ai_moderation
    ai_reply_suggestions
    ai_generate
    bulk_reviews_csv
    campaign_email
    campaign_analytics_basic
    custom_brand_color
  ].freeze

  # Medium is the working merchant: ops can dedup, has a small team,
  # widget can be customized, webhook auto-register kicks in so the
  # storefront sync is hands-off.
  MEDIUM_FEATURES = (ENTRY_FEATURES + %i[
    ai_dedup
    ai_summary_topics
    multi_user
    custom_brand_icon
    widget_custom_css
    campaign_analytics_pro
    loyalty_program
    api_keys
    multi_domain
    webhook_auto_register
  ]).freeze

  # Ultra is scale: bulk AI ops on the entire catalog, no caps, full
  # white-label + governance features.
  ULTRA_FEATURES = (MEDIUM_FEATURES + %i[
    ai_bulk_generate_reviews
    ai_bulk_generate_qa
    bulk_qa
    bulk_ai_summary
    whitelabel
    sso
    audit_log_export
    priority_support
    sla
  ]).freeze

  FEATURES = {
    "entry"  => ENTRY_FEATURES,
    "medium" => MEDIUM_FEATURES,
    "ultra"  => ULTRA_FEATURES,
  }.freeze

  # Hard limits per plan. nil means "unlimited" (ultra tier).
  LIMITS = {
    "entry" => {
      max_products:               100,
      max_reviews_per_month:      1_000,
      max_ai_generations_month:   200,
      max_ai_summary_topics:      0,    # zero = blocked
      max_ai_bulk_reviews_month:  0,
      max_workspace_domains:      1,
      max_team_members:           1,
    }.freeze,

    "medium" => {
      max_products:               1_000,
      max_reviews_per_month:      10_000,
      max_ai_generations_month:   2_000,
      max_ai_summary_topics:      5,
      max_ai_bulk_reviews_month:  500,
      max_workspace_domains:      3,
      max_team_members:           5,
    }.freeze,

    "ultra" => {
      max_products:               nil,
      max_reviews_per_month:      nil,
      max_ai_generations_month:   nil,
      max_ai_summary_topics:      nil,
      max_ai_bulk_reviews_month:  nil,
      max_workspace_domains:      nil,
      max_team_members:           nil,
    }.freeze,
  }.freeze

  module_function

  # Whether the workspace's current plan grants the named feature.
  # Tolerates string/symbol input. Unknown plan → entry fallback so a
  # mis-migrated row never accidentally unlocks Ultra features.
  def allow?(feature, workspace_or_plan)
    plan = plan_of(workspace_or_plan)
    list = FEATURES[plan] || FEATURES["entry"]
    list.include?(feature.to_sym)
  end

  # Numeric cap for a plan (returns nil = unlimited).
  def limit(limit_name, workspace_or_plan)
    plan = plan_of(workspace_or_plan)
    map  = LIMITS[plan] || LIMITS["entry"]
    map[limit_name.to_sym]
  end

  # Throws PlanFeatures::FeatureLocked when the workspace doesn't have
  # the feature on its current plan. Controllers should rescue this in
  # ApplicationController to render a clean 402 Payment Required +
  # `required_plan` hint so the admin can deep-link to the upgrade flow.
  def require!(feature, workspace)
    return if allow?(feature, workspace)
    plan = plan_of(workspace)
    required = required_plan_for(feature) || "medium"
    raise FeatureLocked.new(feature: feature.to_sym, current_plan: plan, required_plan: required)
  end

  # Walks the tier table and returns the cheapest plan that includes
  # the feature. Used for the upgrade nudge in error responses.
  def required_plan_for(feature)
    TIERS.find { |p| FEATURES[p].include?(feature.to_sym) }
  end

  def plan_of(workspace_or_plan)
    case workspace_or_plan
    when String, Symbol then workspace_or_plan.to_s
    when Workspace      then workspace_or_plan.plan.to_s
    else
      ws = workspace_or_plan
      ws.respond_to?(:plan) ? ws.plan.to_s : "entry"
    end
  end

  # Snapshot for the workspace#show payload — frontend renders gates
  # without needing to mirror the table.
  def snapshot(workspace)
    plan = plan_of(workspace)
    {
      plan:     plan,
      features: (FEATURES[plan] || FEATURES["entry"]).map(&:to_s),
      limits:   LIMITS[plan]   || LIMITS["entry"],
    }
  end

  class FeatureLocked < StandardError
    attr_reader :feature, :current_plan, :required_plan

    def initialize(feature:, current_plan:, required_plan:)
      @feature       = feature
      @current_plan  = current_plan
      @required_plan = required_plan
      super("Feature #{feature} requires plan #{required_plan} (current: #{current_plan})")
    end

    def to_json_payload
      {
        error:         "feature_locked",
        message:       "Esta funcionalidade exige o plano #{required_plan.capitalize}.",
        feature:       feature.to_s,
        current_plan:  current_plan,
        required_plan: required_plan,
        upgrade_url:   "/billing",
      }
    end
  end
end

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
module PlanFeatures
  # Plans sorted weakest → strongest. Inclusion-based: stronger plans
  # inherit the features of weaker ones plus their own additions.
  TIERS = %w[free starter pro enterprise].freeze

  FEATURES = {
    "free" => %i[
      reviews_basic
      widget_basic
      qa_basic
      workspace_branding
    ].freeze,

    "starter" => %i[
      reviews_basic
      widget_basic
      qa_basic
      workspace_branding
      ai_moderation
      ai_reply_suggestions
      bulk_reviews_csv
      campaign_email
      campaign_analytics_basic
      custom_brand_color
    ].freeze,

    "pro" => %i[
      reviews_basic
      widget_basic
      qa_basic
      workspace_branding
      ai_moderation
      ai_reply_suggestions
      bulk_reviews_csv
      campaign_email
      campaign_analytics_basic
      custom_brand_color
      ai_summary_topics
      ai_bulk_generate_reviews
      ai_bulk_generate_qa
      ai_dedup
      custom_brand_icon
      widget_custom_css
      campaign_analytics_pro
      loyalty_program
      api_keys
      multi_domain
    ].freeze,

    "enterprise" => %i[
      reviews_basic
      widget_basic
      qa_basic
      workspace_branding
      ai_moderation
      ai_reply_suggestions
      bulk_reviews_csv
      campaign_email
      campaign_analytics_basic
      custom_brand_color
      ai_summary_topics
      ai_bulk_generate_reviews
      ai_bulk_generate_qa
      ai_dedup
      custom_brand_icon
      widget_custom_css
      campaign_analytics_pro
      loyalty_program
      api_keys
      multi_domain
      whitelabel
      sso
      audit_log_export
      priority_support
      sla
    ].freeze,
  }.freeze

  # Hard limits per plan. nil means "unlimited" (enterprise tier).
  LIMITS = {
    "free" => {
      max_products:               25,
      max_reviews_per_month:      500,
      max_ai_summary_topics:      0,    # zero = blocked
      max_ai_bulk_reviews_month:  0,
      max_workspace_domains:      1,
      max_team_members:           1,
    }.freeze,

    "starter" => {
      max_products:               250,
      max_reviews_per_month:      5_000,
      max_ai_summary_topics:      0,
      max_ai_bulk_reviews_month:  100,
      max_workspace_domains:      1,
      max_team_members:           3,
    }.freeze,

    "pro" => {
      max_products:               2_500,
      max_reviews_per_month:      50_000,
      max_ai_summary_topics:      5,
      max_ai_bulk_reviews_month:  1_000,
      max_workspace_domains:      5,
      max_team_members:           10,
    }.freeze,

    "enterprise" => {
      max_products:               nil,
      max_reviews_per_month:      nil,
      max_ai_summary_topics:      10,
      max_ai_bulk_reviews_month:  nil,
      max_workspace_domains:      nil,
      max_team_members:           nil,
    }.freeze,
  }.freeze

  module_function

  # Whether the workspace's current plan grants the named feature.
  # Tolerates string/symbol input. Unknown plan → free fallback so a
  # mis-migrated row never accidentally unlocks Pro features.
  def allow?(feature, workspace_or_plan)
    plan = plan_of(workspace_or_plan)
    list = FEATURES[plan] || FEATURES["free"]
    list.include?(feature.to_sym)
  end

  # Numeric cap for a plan (returns nil = unlimited).
  def limit(limit_name, workspace_or_plan)
    plan = plan_of(workspace_or_plan)
    map  = LIMITS[plan] || LIMITS["free"]
    map[limit_name.to_sym]
  end

  # Throws PlanFeatures::FeatureLocked when the workspace doesn't have
  # the feature on its current plan. Controllers should rescue this in
  # ApplicationController to render a clean 402 Payment Required +
  # `required_plan` hint so the admin can deep-link to the upgrade flow.
  def require!(feature, workspace)
    return if allow?(feature, workspace)
    plan = plan_of(workspace)
    required = required_plan_for(feature) || "pro"
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
      ws.respond_to?(:plan) ? ws.plan.to_s : "free"
    end
  end

  # Snapshot for the workspace#show payload — frontend renders gates
  # without needing to mirror the table.
  def snapshot(workspace)
    plan = plan_of(workspace)
    {
      plan:     plan,
      features: (FEATURES[plan] || FEATURES["free"]).map(&:to_s),
      limits:   LIMITS[plan]   || LIMITS["free"],
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
        message:       "Esta funcionalidade exige plano #{required_plan.capitalize}.",
        feature:       feature.to_s,
        current_plan:  current_plan,
        required_plan: required_plan,
        upgrade_url:   "/billing",
      }
    end
  end
end

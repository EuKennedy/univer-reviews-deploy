# frozen_string_literal: true

# Hard cap enforcement for AI consumption per workspace.
#
# Companion of the soft UI gauge served by ai#cost_report. While the
# gauge surfaces *information* ("you're at 67% of cap"), this lib
# *prevents* the request from running once the cap is crossed —
# protecting the workspace from a runaway loop burning Anthropic credit.
#
# Plan caps in USD per calendar month. Every paid tier carries a cap
# because the upstream Anthropic credit is a hard cost on us — leaving
# any plan uncapped means a single broken merchant integration (e.g. a
# webhook loop) can drain weeks of margin before we notice. Numbers
# mirror the soft thresholds returned by ai_controller#cost_report so
# users see the same value in the gauge and the 402 response.
#
# Ratios are deliberate: ultra = 5× medium so a power user graduating
# tiers always buys back at least 5× the headroom, and medium = 10×
# entry so a serious merchant moving off entry never feels rate-limited
# by the cap on day one.
module AiCostCap
  PLAN_MONTHLY_CAP_USD = {
    "entry"  => 1.00,
    "medium" => 10.00,
    "ultra"  => 50.00,
  }.freeze

  # Some flows (e.g. moderate-pending bulk) deliberately bypass the cap
  # for internal jobs we trust. List here so a single allow-list keeps
  # us honest.
  BYPASS_JOB_TYPES = %w[health].freeze

  module_function

  # The configured cap for a workspace's current plan. nil = unlimited.
  def cap_for(workspace)
    PLAN_MONTHLY_CAP_USD[workspace.plan.to_s]
  end

  # Current calendar-month spend in USD.
  def month_spent(workspace)
    workspace.ai_jobs
             .where("created_at >= ?", Time.current.beginning_of_month)
             .sum(:cost_usd)
             .to_f
  end

  # True when the workspace has consumed >= 100% of its monthly cap.
  # cap_for() returns nil for unknown / mis-migrated plans; we treat
  # that as "no cap" so a stale row doesn't accidentally lock the
  # workspace out — wrong direction to fail, vs. silently allowing.
  def exceeded?(workspace)
    cap = cap_for(workspace)
    return false if cap.nil?
    month_spent(workspace) >= cap
  end

  # Convenience for controllers — raises CapReached when exceeded so
  # ApplicationController can render a uniform 402.
  def require!(workspace)
    return unless exceeded?(workspace)
    raise CapReached.new(workspace: workspace)
  end

  class CapReached < StandardError
    attr_reader :workspace, :cap_usd, :spent_usd

    def initialize(workspace:)
      @workspace = workspace
      @cap_usd   = AiCostCap.cap_for(workspace)
      @spent_usd = AiCostCap.month_spent(workspace).round(4)
      super("AI monthly cap of $#{@cap_usd} reached (spent $#{@spent_usd})")
    end

    def to_json_payload
      {
        error:         "ai_cost_cap_reached",
        message:       "Limite mensal de IA atingido (#{format('%.2f', spent_usd)} de #{format('%.2f', cap_usd || 0)} USD). Faça upgrade para continuar.",
        spent_usd:     spent_usd,
        cap_usd:       cap_usd,
        current_plan:  workspace.plan,
        upgrade_url:   "/billing",
      }
    end
  end
end

class RewardGrantJob < ApplicationJob
  queue_as :default

  def perform(review_id)
    review = Review.find_by(id: review_id)
    return unless review&.approved?

    set_workspace_rls(review.workspace_id)
    workspace = review.workspace

    # Find applicable reward rules
    rules = workspace.reward_rules.active.where(trigger_event: "review_approved")

    rules.each do |rule|
      next if rule.cap_reached?
      next if max_per_customer_exceeded?(rule, review)

      grant_reward(rule, review)
    rescue => e
      Rails.logger.error("RewardGrantJob rule #{rule.id} error: #{e.message}")
    end
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("RewardGrantJob: review #{review_id} not found")
  end

  private

  def max_per_customer_exceeded?(rule, review)
    return false unless review.author_email.present?

    count = RewardGrant.where(rule_id: rule.id, customer_email: review.author_email)
                       .where.not(status: "reverted")
                       .count

    return true if rule.max_per_customer_per_product.present? && count >= rule.max_per_customer_per_product

    if rule.max_per_customer_per_month.present?
      month_count = RewardGrant.where(rule_id: rule.id, customer_email: review.author_email)
                               .where("created_at >= ?", Time.current.beginning_of_month)
                               .where.not(status: "reverted")
                               .count
      return true if month_count >= rule.max_per_customer_per_month
    end

    false
  end

  def grant_reward(rule, review)
    reward_calc = rule.calculate_reward(review: review)

    coupon_code = generate_coupon(rule) if rule.reward_type == "coupon"

    grant = review.workspace.reward_grants.create!(
      rule:           rule,
      review:         review,
      customer_email: review.author_email,
      reward_type:    rule.reward_type,
      amount_base:    reward_calc[:base],
      amount_total:   reward_calc[:total],
      bonuses_applied: reward_calc[:bonuses],
      coupon_code:    coupon_code,
      expires_at:     30.days.from_now
    )

    grant.grant!

    Rails.logger.info("RewardGrantJob: granted #{rule.reward_type} to #{review.author_email} for review #{review.id}")
  end

  def generate_coupon(rule)
    template = rule.coupon_template.presence || "UNVR-{CODE}"
    code = SecureRandom.alphanumeric(8).upcase
    template.gsub("{CODE}", code)
  end
end

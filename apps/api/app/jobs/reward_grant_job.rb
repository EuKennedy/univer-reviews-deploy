class RewardGrantJob < ApplicationJob
  queue_as :default

  # How many times we retry coupon-code generation on collision before
  # giving up. Unique index on coupon_code protects us; the loop is
  # only here to absorb the birthday-bound likelihood of duplicates.
  COUPON_GENERATION_ATTEMPTS = 5

  def perform(review_id)
    review = Review.find_by(id: review_id)
    return unless review&.approved?

    workspace = review.workspace

    # Wrap the whole rule loop in an RLS-scoped transaction. SET LOCAL on
    # the previous code path leaked across pooled connections; with_workspace_rls
    # pins workspace_id for the duration of every read AND write below.
    with_workspace_rls(workspace.id) do
      rules = workspace.reward_rules.active.where(trigger_event: "review_approved")

      rules.each do |rule|
        begin
          # Lock the rule row so concurrent jobs serialise on the cap checks.
          # max_per_customer_per_month is a soft cap (no unique index), and
          # max_total_grants reads total_grants_count which is mutated by
          # other workers. Both need a lock.
          rule.with_lock do
            next if rule.cap_reached?
            next if max_per_customer_exceeded?(rule, review)

            grant_reward(rule, review)
          end
        rescue ActiveRecord::RecordNotUnique => e
          # Hit the (rule_id, review_id) or (rule_id, customer_email) unique
          # index — means another job already issued this grant. Idempotent
          # behavior is what we want; log and move on.
          Rails.logger.info("RewardGrantJob rule=#{rule.id} review=#{review.id} dedupe: #{e.message}")
        rescue => e
          Rails.logger.error("RewardGrantJob rule #{rule.id} error: #{e.message}")
        end
      end
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

    coupon_code = rule.reward_type == "coupon" ? generate_unique_coupon(rule) : nil

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

  # Retries on the unique index until we get a non-colliding code. With
  # 37 bits of entropy a collision is ~3.5% at 1M issued grants per
  # workspace — the retry loop absorbs that without raising.
  def generate_unique_coupon(rule)
    template = rule.coupon_template.presence || "UNVR-{CODE}"
    COUPON_GENERATION_ATTEMPTS.times do
      code = SecureRandom.alphanumeric(10).upcase
      candidate = template.gsub("{CODE}", code)
      return candidate unless RewardGrant.exists?(coupon_code: candidate)
    end
    raise "Could not generate a unique coupon code after #{COUPON_GENERATION_ATTEMPTS} attempts"
  end
end

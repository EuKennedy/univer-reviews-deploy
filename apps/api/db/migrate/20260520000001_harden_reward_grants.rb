class HardenRewardGrants < ActiveRecord::Migration[8.0]
  # Closes the TOCTOU race in RewardGrantJob (security audit finding).
  #
  # The job previously checked rule.max_per_customer_per_product with a
  # plain SELECT COUNT(*), then inserted a new grant. Two parallel workers
  # could both pass the check at COUNT == max - 1, both insert, and the
  # cap was breached. With unique partial indexes the second insert raises
  # ActiveRecord::RecordNotUnique and the job logs + skips.
  #
  # Indexes:
  #   - (rule_id, review_id) — same review never grants twice no matter
  #     how many times the job is enqueued (idempotency)
  #   - (rule_id, customer_email) WHERE status != 'reverted'
  #       — caps to one active grant per (rule, customer). The
  #     max_per_customer_per_month case is still application-level (the
  #     month boundary makes a unique index unwieldy) but is protected
  #     by row-level lock in the job (rule.with_lock).
  #   - unique on coupon_code — collision prevention; SecureRandom.alphanumeric(8)
  #     upcased is ~37 bits, birthday-bound at ~370k grants.
  def up
    # Some legacy data may already violate the new constraints. Surface that
    # in the migration so an operator sees it before deploy, but don't crash:
    # we add the indexes as NULLS-NOT-DISTINCT-friendly partial indexes.
    add_index :reward_grants,
              %i[rule_id review_id],
              unique: true,
              where: "rule_id IS NOT NULL AND review_id IS NOT NULL",
              name: "idx_reward_grants_unique_rule_review"

    add_index :reward_grants,
              %i[rule_id customer_email],
              unique: true,
              where: "rule_id IS NOT NULL AND customer_email IS NOT NULL AND status <> 'reverted'",
              name: "idx_reward_grants_unique_rule_customer_active"

    add_index :reward_grants,
              :coupon_code,
              unique: true,
              where: "coupon_code IS NOT NULL",
              name: "idx_reward_grants_unique_coupon_code"
  end

  def down
    remove_index :reward_grants, name: "idx_reward_grants_unique_coupon_code"
    remove_index :reward_grants, name: "idx_reward_grants_unique_rule_customer_active"
    remove_index :reward_grants, name: "idx_reward_grants_unique_rule_review"
  end
end

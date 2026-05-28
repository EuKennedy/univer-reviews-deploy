class PaymentEvent < ApplicationRecord
  # Idempotency log for the external payment platform webhook
  # (POST /api/v1/webhooks/payment).
  #
  # The row is inserted BEFORE provisioning runs. The unique index on
  # `transaction_id` causes the second delivery of the same event to raise
  # ActiveRecord::RecordNotUnique, which the controller catches and short-
  # circuits with `{ ok: true, idempotent: true }`. This protects us from
  # provider retry storms, double workspace creation, and duplicate magic-
  # link e-mails.
  # Uniqueness is enforced by the DB unique index on transaction_id (see
  # migration). We deliberately DO NOT add a Rails-level uniqueness
  # validator: it would convert a duplicate INSERT into
  # `ActiveRecord::RecordInvalid` instead of `ActiveRecord::RecordNotUnique`,
  # and the webhook controller's idempotent short-circuit specifically
  # catches RecordNotUnique. The Rails validator also races on concurrent
  # inserts (both see no row, both INSERT); the DB index is the only safe
  # enforcement point.
  validates :transaction_id, presence: true
  validates :event,          presence: true

  scope :unprocessed, -> { where(processed_at: nil) }
  scope :processed,   -> { where.not(processed_at: nil) }

  def processed?
    processed_at.present?
  end

  def mark_processed!
    update!(processed_at: Time.current, error: nil)
  end

  def mark_failed!(message)
    update!(error: message.to_s[0, 2_000])
  end
end

class ConnectEvent < ApplicationRecord
  # Idempotency + audit log for inbound Univercart Connect webhooks. See
  # migration 20260529125601 for the rationale on missing RLS.
  #
  # `event_id` is Univercart's `evt_<uuid>`. The unique DB index lets a
  # duplicate delivery raise ActiveRecord::RecordNotUnique, which the
  # webhook controller catches and short-circuits with 200 + idempotent.
  # Rails-level uniqueness validator is INTENTIONALLY omitted — see the
  # comment on PaymentEvent for the same rationale (RecordInvalid vs
  # RecordNotUnique, plus the race in concurrent inserts).
  validates :event_id,    presence: true
  validates :event_type,  presence: true

  belongs_to :workspace, optional: true

  scope :unprocessed, -> { where(processed_at: nil) }
  scope :processed,   -> { where.not(processed_at: nil) }
  scope :livemode,    -> { where(livemode: true) }
  scope :for_subscription, ->(sub_id) { where(external_user_id: sub_id) }

  def processed?
    processed_at.present?
  end

  def mark_processed!(workspace: nil)
    attrs = { processed_at: Time.current, error: nil }
    attrs[:workspace_id] = workspace.id if workspace
    update!(attrs)
  end

  def mark_failed!(message)
    update!(error: message.to_s[0, 2_000])
  end

  # Out-of-order guard: returns the most recent processed event timestamp
  # for the same external_user_id. The caller compares against the current
  # event's `event_created_at` and skips if it's older. Stripe-style
  # webhooks occasionally arrive out of order on retry.
  def self.last_processed_at_for(external_user_id)
    return nil if external_user_id.blank?
    where(external_user_id: external_user_id)
      .where.not(processed_at: nil)
      .maximum(:event_created_at)
  end
end

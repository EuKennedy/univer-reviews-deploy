class StripeEvent < ApplicationRecord
  # Idempotency log for inbound Stripe webhooks. Inserted once per event.id
  # before the event is processed. The unique index on event_id makes a
  # second insert raise ActiveRecord::RecordNotUnique, which the webhook
  # controller catches and short-circuits with 200 OK.
  validates :event_id, presence: true, uniqueness: true
end

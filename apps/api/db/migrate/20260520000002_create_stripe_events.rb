class CreateStripeEvents < ActiveRecord::Migration[8.0]
  # Idempotency log for Stripe webhooks.
  # Stripe officially redelivers events on 5xx for up to 3 days. Without
  # idempotency, a replayed `customer.subscription.deleted` could downgrade
  # a workspace that already re-subscribed; a replayed `checkout.session.completed`
  # could trigger double-upgrades.
  #
  # We INSERT a row keyed by event.id BEFORE processing; the unique index
  # raises on the second delivery and the controller returns 200 immediately.
  def up
    create_table :stripe_events, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string   :event_id,    null: false
      t.string   :event_type
      t.datetime :received_at, null: false, default: -> { "NOW()" }
      t.datetime :processed_at
      t.text     :error
    end

    add_index :stripe_events, :event_id, unique: true
    add_index :stripe_events, :received_at
  end

  def down
    drop_table :stripe_events
  end
end

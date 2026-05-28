class CreatePaymentEvents < ActiveRecord::Migration[8.0]
  # Idempotency log for inbound payment webhooks (external platform).
  #
  # The external payment processor re-delivers events on 5xx — without this
  # guard, a replayed `payment.succeeded` would double-provision (new
  # workspace, second magic-link e-mail, duplicate audit row).
  #
  # We INSERT a row keyed by `transaction_id` BEFORE processing; a unique
  # index lets a second delivery raise ActiveRecord::RecordNotUnique, which
  # the webhook controller catches and returns 200 + `idempotent: true`.
  #
  # No `workspace_id` on this table: provisioning happens *from* this row,
  # so the workspace may not exist yet. RLS is intentionally skipped — this
  # table is pre-provisioning and is accessed only from the webhook
  # controller and (later) a super-admin audit screen.
  def up
    create_table :payment_events, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.text       :transaction_id, null: false
      t.text       :event,          null: false
      t.jsonb      :payload,        null: false, default: {}
      t.datetime   :processed_at
      t.text       :error
      t.datetime   :created_at,     null: false, default: -> { "NOW()" }
    end

    add_index :payment_events, :transaction_id, unique: true
    add_index :payment_events, :created_at
    add_index :payment_events, :processed_at
  end

  def down
    drop_table :payment_events
  end
end

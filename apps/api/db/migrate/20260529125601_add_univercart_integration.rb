class AddUnivercartIntegration < ActiveRecord::Migration[8.0]
  # Univercart Connect integration.
  #
  # Univercart is the payment platform where the founder sells UniverReviews
  # subscriptions. When someone buys a plan there, Univercart fires
  # `entitlement.*` webhooks at us. We listen + auto-provision a workspace
  # and link the buyer's account.
  #
  # Two schema changes:
  #
  # 1. `workspaces.univercart_*` columns — pin one Univercart subscription
  #    to one of our workspaces. The `subscription_id` is the external
  #    join key (also lives in JWT claims + every webhook payload).
  #    Unique index so a replayed `entitlement.granted` for the same sub
  #    can't double-provision.
  #
  # 2. `connect_events` table — idempotency log for inbound webhooks.
  #    Keyed by `event_id` (Univercart's `evt_<uuid>`, also mirrored in
  #    the `Idempotency-Key` HTTP header). A retried delivery hits the
  #    unique index and short-circuits with HTTP 200 + idempotent=true.
  #
  #    No RLS on this table: provisioning happens FROM it, so the
  #    workspace may not exist when the row is written. Access is limited
  #    to the webhook controller (which strips RLS context anyway) and
  #    the future super-admin Deliveries panel.
  def up
    add_column :workspaces, :univercart_subscription_id, :text
    add_column :workspaces, :univercart_email,           :text
    add_column :workspaces, :univercart_valid_until,     :datetime
    execute "ALTER TABLE workspaces ALTER COLUMN univercart_valid_until TYPE TIMESTAMPTZ"

    add_index :workspaces, :univercart_subscription_id,
              unique: true,
              where:  "univercart_subscription_id IS NOT NULL",
              name:   "idx_workspaces_univercart_sub"

    create_table :connect_events, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.text     :event_id,        null: false                # evt_<uuid> from Univercart
      t.text     :event_type,      null: false                # entitlement.granted, etc.
      t.jsonb    :payload,         null: false, default: {}   # raw event body
      t.boolean  :livemode,        null: false, default: false
      t.text     :external_user_id                            # data.externalUserId (the Univercart sub id)
      t.uuid     :workspace_id                                # filled once provisioning runs
      t.datetime :event_created_at                            # data.created (unix) → ts; used for out-of-order guard
      t.datetime :processed_at
      t.text     :error
      t.datetime :created_at,      null: false, default: -> { "NOW()" }
    end
    execute "ALTER TABLE connect_events ALTER COLUMN event_created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE connect_events ALTER COLUMN processed_at     TYPE TIMESTAMPTZ"
    execute "ALTER TABLE connect_events ALTER COLUMN created_at       TYPE TIMESTAMPTZ"

    add_index :connect_events, :event_id, unique: true
    add_index :connect_events, :external_user_id
    add_index :connect_events, :workspace_id
    add_index :connect_events, :created_at

    add_foreign_key :connect_events, :workspaces, on_delete: :nullify
  end

  def down
    drop_table :connect_events, if_exists: true
    remove_index :workspaces, name: "idx_workspaces_univercart_sub", if_exists: true
    remove_column :workspaces, :univercart_valid_until
    remove_column :workspaces, :univercart_email
    remove_column :workspaces, :univercart_subscription_id
  end
end

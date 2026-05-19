class CreatePlatformEventsAndExtendSends < ActiveRecord::Migration[8.0]
  def up
    # ─── platform_events ──────────────────────────────────────────────────────
    create_table :platform_events, id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
      t.column   :workspace_id,        :uuid,    null: false
      t.string   :platform,            null: false
      t.string   :event_type,          null: false
      t.string   :external_order_id,   null: false
      t.string   :customer_email
      t.string   :customer_name
      t.decimal  :order_total,         precision: 10, scale: 2
      t.string   :currency
      t.jsonb    :product_handles,     default: []
      t.jsonb    :raw_payload,         default: {}
      t.datetime :received_at,         null: false, default: -> { "NOW()" }
      t.datetime :processed_at
      t.datetime :created_at,          null: false, default: -> { "NOW()" }
      t.datetime :updated_at,          null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE platform_events ALTER COLUMN received_at  TYPE TIMESTAMPTZ"
    execute "ALTER TABLE platform_events ALTER COLUMN processed_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE platform_events ALTER COLUMN created_at   TYPE TIMESTAMPTZ"
    execute "ALTER TABLE platform_events ALTER COLUMN updated_at   TYPE TIMESTAMPTZ"

    execute <<~SQL
      ALTER TABLE platform_events
        ADD CONSTRAINT platform_events_platform_check
        CHECK (platform IN ('woocommerce','shopify','generic'))
    SQL
    execute <<~SQL
      ALTER TABLE platform_events
        ADD CONSTRAINT platform_events_event_type_check
        CHECK (event_type IN ('order_completed','order_delivered','order_paid','order_refunded'))
    SQL

    add_index :platform_events, %i[workspace_id external_order_id], name: "idx_platform_events_ws_order"
    add_index :platform_events, %i[workspace_id event_type received_at],
              order: { received_at: :desc },
              name: "idx_platform_events_ws_type_received"
    add_index :platform_events, %i[workspace_id platform event_type external_order_id],
              unique: true,
              name: "idx_platform_events_dedupe"

    add_foreign_key :platform_events, :workspaces, on_delete: :cascade

    # ─── campaign_sends extensions ────────────────────────────────────────────
    add_column :campaign_sends, :external_order_id,  :string
    add_column :campaign_sends, :scheduled_at,       :timestamptz
    add_column :campaign_sends, :platform_event_id,  :uuid
    add_column :campaign_sends, :bounced_at,         :timestamptz
    add_column :campaign_sends, :complained_at,      :timestamptz
    add_column :campaign_sends, :resend_message_id,  :string
    add_column :campaign_sends, :subject,            :string
    add_column :campaign_sends, :recipient_email,    :string
    add_column :campaign_sends, :recipient_name,     :string
    add_column :campaign_sends, :rendered_html,      :text
    add_column :campaign_sends, :opened_count,       :integer, default: 0, null: false
    add_column :campaign_sends, :clicked_count,      :integer, default: 0, null: false
    add_column :campaign_sends, :last_event_at,      :timestamptz

    add_foreign_key :campaign_sends, :platform_events,
                    column: :platform_event_id, on_delete: :nullify

    add_index :campaign_sends, :scheduled_at
    add_index :campaign_sends, :external_order_id
    add_index :campaign_sends, :resend_message_id
    add_index :campaign_sends, :platform_event_id

    # Anti-dup: one send per (workspace, campaign, external_order_id, recipient_email).
    # Partial index — only enforced when recipient_email present (manual sends without
    # an external_order_id are exempt).
    execute <<~SQL
      CREATE UNIQUE INDEX idx_campaign_sends_dedupe
        ON campaign_sends (workspace_id, campaign_id, external_order_id, recipient_email)
        WHERE recipient_email IS NOT NULL
    SQL

    # Bring status_check in line with the expanded status set.
    execute "ALTER TABLE campaign_sends DROP CONSTRAINT IF EXISTS campaign_sends_status_check"
    execute <<~SQL
      ALTER TABLE campaign_sends ADD CONSTRAINT campaign_sends_status_check
        CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','complained','converted'))
    SQL

    # ─── campaigns extensions ─────────────────────────────────────────────────
    add_column :campaigns, :trigger_after_minutes, :integer, default: 0, null: false
    add_column :campaigns, :from_name,             :string
    add_column :campaigns, :from_email,            :string, default: "noreply@univerreviews.com"
    add_column :campaigns, :reply_to,              :string, default: "suporte@univerreviews.com"
    add_column :campaigns, :subject_template,      :string
    add_column :campaigns, :html_template,         :text

    # Postgres varchar[] with default ARRAY['order_completed']
    execute <<~SQL
      ALTER TABLE campaigns
        ADD COLUMN trigger_events varchar[] NOT NULL DEFAULT ARRAY['order_completed']::varchar[]
    SQL

    execute "CREATE INDEX idx_campaigns_trigger_events ON campaigns USING gin (trigger_events)"

    # ─── Row Level Security ───────────────────────────────────────────────────
    execute "ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY"
    execute <<~SQL
      CREATE POLICY platform_events_workspace_isolation ON platform_events
        USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
    SQL
    execute "ALTER TABLE platform_events FORCE ROW LEVEL SECURITY"
  end

  def down
    execute "DROP POLICY IF EXISTS platform_events_workspace_isolation ON platform_events"

    execute "DROP INDEX IF EXISTS idx_campaigns_trigger_events"
    remove_column :campaigns, :trigger_events,        if_exists: true
    remove_column :campaigns, :html_template,         if_exists: true
    remove_column :campaigns, :subject_template,      if_exists: true
    remove_column :campaigns, :reply_to,              if_exists: true
    remove_column :campaigns, :from_email,            if_exists: true
    remove_column :campaigns, :from_name,             if_exists: true
    remove_column :campaigns, :trigger_after_minutes, if_exists: true

    execute "DROP INDEX IF EXISTS idx_campaign_sends_dedupe"

    remove_foreign_key :campaign_sends, column: :platform_event_id rescue nil
    %i[last_event_at clicked_count opened_count rendered_html recipient_name
       recipient_email subject resend_message_id complained_at bounced_at
       platform_event_id scheduled_at external_order_id].each do |col|
      remove_column :campaign_sends, col, if_exists: true
    end

    execute "ALTER TABLE campaign_sends DROP CONSTRAINT IF EXISTS campaign_sends_status_check"
    execute <<~SQL
      ALTER TABLE campaign_sends ADD CONSTRAINT campaign_sends_status_check
        CHECK (status IN ('queued','sent','opened','clicked','converted','bounced'))
    SQL

    drop_table :platform_events, if_exists: true
  end
end

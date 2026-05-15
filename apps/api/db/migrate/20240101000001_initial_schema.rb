class InitialSchema < ActiveRecord::Migration[8.0]
  def up
    # Extensions
    execute "CREATE EXTENSION IF NOT EXISTS pgcrypto"
    execute "CREATE EXTENSION IF NOT EXISTS vector"
    execute "CREATE EXTENSION IF NOT EXISTS pg_trgm"

    # ─── workspaces ───────────────────────────────────────────────────────────
    create_table :workspaces, id: false, force: :cascade do |t|
      t.column  :id,                    :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.string  :slug,                  null: false
      t.string  :name,                  null: false
      t.string  :brand_logo
      t.string  :brand_color,           default: "#d4a850"
      t.string  :rating_icon_filled
      t.string  :rating_icon_empty
      t.string  :rating_icon_preset,    default: "star"
      t.text    :brand_voice_md
      t.string  :default_locale,        default: "pt-BR", null: false
      t.string  :default_currency,      default: "BRL", null: false
      t.string  :plan,                  default: "free", null: false
      t.string  :status,                default: "trial", null: false
      t.timestamps null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE workspaces ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE workspaces ALTER COLUMN updated_at TYPE TIMESTAMPTZ"

    add_index :workspaces, :slug, unique: true
    add_index :workspaces, :status
    add_index :workspaces, :plan

    execute "ALTER TABLE workspaces ADD CONSTRAINT workspaces_plan_check CHECK (plan IN ('free','starter','pro','enterprise'))"
    execute "ALTER TABLE workspaces ADD CONSTRAINT workspaces_status_check CHECK (status IN ('active','suspended','trial'))"

    # ─── workspace_users ──────────────────────────────────────────────────────
    create_table :workspace_users, id: false, force: :cascade do |t|
      t.column  :id,            :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,  :uuid, null: false
      t.string  :email,         null: false
      t.string  :name,          null: false
      t.string  :role,          null: false, default: "viewer"
      t.string  :password_hash
      t.datetime :last_login_at
      t.timestamps null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE workspace_users ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE workspace_users ALTER COLUMN updated_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE workspace_users ALTER COLUMN last_login_at TYPE TIMESTAMPTZ"

    add_index :workspace_users, :workspace_id
    add_index :workspace_users, %i[workspace_id email], unique: true
    add_index :workspace_users, :email

    execute "ALTER TABLE workspace_users ADD CONSTRAINT workspace_users_role_check CHECK (role IN ('owner','admin','editor','moderator','viewer'))"
    add_foreign_key :workspace_users, :workspaces, on_delete: :cascade

    # ─── workspace_api_keys ───────────────────────────────────────────────────
    create_table :workspace_api_keys, id: false, force: :cascade do |t|
      t.column  :id,           :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id, :uuid, null: false
      t.string  :key_hash,     null: false
      t.string  :key_prefix,   null: false, limit: 8
      t.string  :label
      t.string  :scopes,       default: "read,write"
      t.datetime :last_used_at
      t.datetime :expires_at
      t.datetime :revoked_at
      t.datetime :created_at,  null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE workspace_api_keys ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE workspace_api_keys ALTER COLUMN last_used_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE workspace_api_keys ALTER COLUMN expires_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE workspace_api_keys ALTER COLUMN revoked_at TYPE TIMESTAMPTZ"

    add_index :workspace_api_keys, :key_hash, unique: true
    add_index :workspace_api_keys, :workspace_id
    add_foreign_key :workspace_api_keys, :workspaces, on_delete: :cascade

    # ─── workspace_domains ────────────────────────────────────────────────────
    create_table :workspace_domains, id: false, force: :cascade do |t|
      t.column  :id,            :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,  :uuid, null: false
      t.string  :domain,        null: false
      t.string  :platform,      null: false, default: "generic"
      t.jsonb   :platform_meta, default: {}
      t.datetime :verified_at
      t.datetime :created_at,  null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE workspace_domains ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE workspace_domains ALTER COLUMN verified_at TYPE TIMESTAMPTZ"

    add_index :workspace_domains, :domain, unique: true
    add_index :workspace_domains, :workspace_id
    add_index :workspace_domains, :platform_meta, using: :gin

    execute "ALTER TABLE workspace_domains ADD CONSTRAINT workspace_domains_platform_check CHECK (platform IN ('woocommerce','shopify','generic'))"
    add_foreign_key :workspace_domains, :workspaces, on_delete: :cascade

    # ─── products ─────────────────────────────────────────────────────────────
    create_table :products, id: false, force: :cascade do |t|
      t.column  :id,                  :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,        :uuid, null: false
      t.string  :platform,            null: false, default: "generic"
      t.string  :platform_product_id
      t.string  :handle
      t.string  :title,               null: false
      t.string  :image_url
      t.decimal :price,               precision: 10, scale: 2
      t.string  :currency,            default: "BRL"
      t.boolean :active,              default: true, null: false
      t.jsonb   :metadata,            default: {}
      t.datetime :last_synced_at
      t.datetime :created_at,         null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE products ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE products ALTER COLUMN last_synced_at TYPE TIMESTAMPTZ"

    add_index :products, :workspace_id
    add_index :products, %i[workspace_id platform platform_product_id], unique: true, name: "idx_products_workspace_platform_pid"
    add_index :products, :active
    add_index :products, :handle
    add_index :products, :metadata, using: :gin

    add_foreign_key :products, :workspaces, on_delete: :cascade

    # ─── reviews ──────────────────────────────────────────────────────────────
    create_table :reviews, id: false, force: :cascade do |t|
      t.column  :id,                  :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,        :uuid, null: false
      t.column  :product_id,          :uuid
      t.string  :external_id
      t.integer :rating,              null: false
      t.string  :title
      t.text    :body
      t.string  :author_name
      t.string  :author_email
      t.string  :author_country
      t.string  :source,              null: false, default: "manual"
      t.string  :status,              null: false, default: "pending"
      t.boolean :is_featured,         default: false, null: false
      t.boolean :is_verified_purchase, default: false, null: false
      t.string  :order_id
      t.string  :ip_address
      t.text    :user_agent
      t.integer :ai_quality_score
      t.string  :ai_sentiment
      t.jsonb   :ai_topics,           default: []
      t.string  :ai_dup_hash
      t.uuid    :ai_dup_cluster_id
      t.boolean :ai_is_synthetic,     default: false
      t.text    :ai_flagged_reason
      t.string  :language,            default: "pt-BR"
      t.column  :embedding,           :vector, limit: 1536
      t.jsonb   :metadata,            default: {}
      t.datetime :created_at,         null: false, default: -> { "NOW()" }
      t.datetime :updated_at,         null: false, default: -> { "NOW()" }
      t.datetime :approved_at
      t.datetime :imported_at
    end

    execute "ALTER TABLE reviews ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE reviews ALTER COLUMN updated_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE reviews ALTER COLUMN approved_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE reviews ALTER COLUMN imported_at TYPE TIMESTAMPTZ"

    execute "ALTER TABLE reviews ADD CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5)"
    execute "ALTER TABLE reviews ADD CONSTRAINT reviews_source_check CHECK (source IN ('manual','csv','woo','shopify','ryviu_import','email','whatsapp','widget'))"
    execute "ALTER TABLE reviews ADD CONSTRAINT reviews_status_check CHECK (status IN ('pending','approved','rejected','hidden','spam'))"
    execute "ALTER TABLE reviews ADD CONSTRAINT reviews_sentiment_check CHECK (ai_sentiment IS NULL OR ai_sentiment IN ('positive','negative','neutral','mixed'))"

    add_index :reviews, :workspace_id
    add_index :reviews, :product_id
    add_index :reviews, :status
    add_index :reviews, :rating
    add_index :reviews, :source
    add_index :reviews, :created_at
    add_index :reviews, :ai_dup_cluster_id
    add_index :reviews, :ai_dup_hash
    add_index :reviews, %i[workspace_id status]
    add_index :reviews, %i[workspace_id product_id status]
    add_index :reviews, :ai_topics, using: :gin
    add_index :reviews, :metadata, using: :gin
    execute "CREATE INDEX idx_reviews_embedding ON reviews USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"

    add_foreign_key :reviews, :workspaces, on_delete: :cascade
    add_foreign_key :reviews, :products, on_delete: :nullify

    # ─── review_media ─────────────────────────────────────────────────────────
    create_table :review_media, id: false, force: :cascade do |t|
      t.column  :id,           :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :review_id,    :uuid, null: false
      t.column  :workspace_id, :uuid, null: false
      t.string  :type,         null: false
      t.string  :storage_key,  null: false
      t.string  :url
      t.string  :thumb_url
      t.integer :width
      t.integer :height
      t.integer :duration_sec
      t.string  :mime_type
      t.bigint  :size_bytes
      t.datetime :created_at,  null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE review_media ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE review_media ADD CONSTRAINT review_media_type_check CHECK (type IN ('image','video'))"

    add_index :review_media, :review_id
    add_index :review_media, :workspace_id

    add_foreign_key :review_media, :reviews, on_delete: :cascade
    add_foreign_key :review_media, :workspaces, on_delete: :cascade

    # ─── replies ──────────────────────────────────────────────────────────────
    create_table :replies, id: false, force: :cascade do |t|
      t.column  :id,              :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :review_id,       :uuid, null: false
      t.column  :workspace_id,    :uuid, null: false
      t.column  :author_user_id,  :uuid
      t.string  :author_name
      t.text    :body,            null: false
      t.boolean :is_ai_generated, default: false, null: false
      t.boolean :is_published,    default: true, null: false
      t.timestamps null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE replies ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE replies ALTER COLUMN updated_at TYPE TIMESTAMPTZ"

    add_index :replies, :review_id
    add_index :replies, :workspace_id

    add_foreign_key :replies, :reviews, on_delete: :cascade
    add_foreign_key :replies, :workspaces, on_delete: :cascade

    # ─── campaigns ────────────────────────────────────────────────────────────
    create_table :campaigns, id: false, force: :cascade do |t|
      t.column  :id,                   :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,         :uuid, null: false
      t.string  :name,                 null: false
      t.string  :type,                 null: false
      t.string  :status,               null: false, default: "draft"
      t.string  :trigger_type,         null: false, default: "manual"
      t.integer :trigger_delay_hours,  default: 168
      t.string  :template_subject
      t.text    :template_body
      t.column  :reward_rule_id,       :uuid
      t.integer :sent_count,           default: 0, null: false
      t.integer :open_count,           default: 0, null: false
      t.integer :click_count,          default: 0, null: false
      t.integer :review_count,         default: 0, null: false
      t.timestamps null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE campaigns ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE campaigns ALTER COLUMN updated_at TYPE TIMESTAMPTZ"

    execute "ALTER TABLE campaigns ADD CONSTRAINT campaigns_type_check CHECK (type IN ('email','whatsapp','push','nps'))"
    execute "ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check CHECK (status IN ('draft','active','paused','archived'))"
    execute "ALTER TABLE campaigns ADD CONSTRAINT campaigns_trigger_check CHECK (trigger_type IN ('order_completed','order_delivered','manual'))"

    add_index :campaigns, :workspace_id
    add_index :campaigns, :status

    add_foreign_key :campaigns, :workspaces, on_delete: :cascade

    # ─── campaign_sends ───────────────────────────────────────────────────────
    create_table :campaign_sends, id: false, force: :cascade do |t|
      t.column  :id,                   :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :campaign_id,          :uuid, null: false
      t.column  :workspace_id,         :uuid, null: false
      t.string  :customer_email
      t.string  :customer_phone
      t.string  :order_id
      t.jsonb   :product_ids,          default: []
      t.string  :status,               null: false, default: "queued"
      t.datetime :sent_at
      t.datetime :opened_at
      t.datetime :clicked_at
      t.column  :converted_review_id,  :uuid
      t.datetime :created_at,          null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE campaign_sends ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE campaign_sends ALTER COLUMN sent_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE campaign_sends ALTER COLUMN opened_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE campaign_sends ALTER COLUMN clicked_at TYPE TIMESTAMPTZ"

    execute "ALTER TABLE campaign_sends ADD CONSTRAINT campaign_sends_status_check CHECK (status IN ('queued','sent','opened','clicked','converted','bounced'))"

    add_index :campaign_sends, :campaign_id
    add_index :campaign_sends, :workspace_id
    add_index :campaign_sends, :status
    add_index :campaign_sends, :customer_email

    add_foreign_key :campaign_sends, :campaigns, on_delete: :cascade
    add_foreign_key :campaign_sends, :workspaces, on_delete: :cascade

    # ─── reward_rules ─────────────────────────────────────────────────────────
    create_table :reward_rules, id: false, force: :cascade do |t|
      t.column  :id,                          :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,                :uuid, null: false
      t.string  :name,                        null: false
      t.boolean :active,                      default: true, null: false
      t.string  :trigger_event,              null: false
      t.integer :min_body_length,            default: 30
      t.boolean :require_purchase,           default: true
      t.string  :reward_type,               null: false
      t.decimal :reward_amount,             precision: 10, scale: 2
      t.string  :reward_currency
      t.string  :coupon_template
      t.integer :bonus_with_photo_pct,      default: 50
      t.integer :bonus_with_video_pct,      default: 100
      t.integer :bonus_long_review_pct,     default: 25
      t.integer :max_per_customer_per_product, default: 1
      t.integer :max_per_customer_per_month
      t.integer :max_total_grants
      t.integer :total_grants_count,        default: 0, null: false
      t.datetime :starts_at
      t.datetime :ends_at
      t.timestamps null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE reward_rules ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE reward_rules ALTER COLUMN updated_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE reward_rules ALTER COLUMN starts_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE reward_rules ALTER COLUMN ends_at TYPE TIMESTAMPTZ"

    execute "ALTER TABLE reward_rules ADD CONSTRAINT reward_rules_trigger_check CHECK (trigger_event IN ('review_submitted','review_approved'))"
    execute "ALTER TABLE reward_rules ADD CONSTRAINT reward_rules_type_check CHECK (reward_type IN ('points','coupon','cashback','gift'))"

    add_index :reward_rules, :workspace_id
    add_index :reward_rules, :active

    add_foreign_key :reward_rules, :workspaces, on_delete: :cascade

    # FK from campaigns to reward_rules
    add_foreign_key :campaigns, :reward_rules

    # ─── reward_grants ────────────────────────────────────────────────────────
    create_table :reward_grants, id: false, force: :cascade do |t|
      t.column  :id,                    :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,          :uuid, null: false
      t.column  :rule_id,               :uuid
      t.column  :review_id,             :uuid
      t.string  :customer_email
      t.string  :customer_id_external
      t.string  :reward_type,           null: false
      t.decimal :amount_total,          precision: 10, scale: 2
      t.decimal :amount_base,           precision: 10, scale: 2
      t.jsonb   :bonuses_applied,       default: {}
      t.string  :coupon_code
      t.string  :status,                null: false, default: "pending"
      t.datetime :granted_at
      t.datetime :consumed_at
      t.datetime :expires_at
      t.text    :notes
      t.datetime :created_at,           null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE reward_grants ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE reward_grants ALTER COLUMN granted_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE reward_grants ALTER COLUMN consumed_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE reward_grants ALTER COLUMN expires_at TYPE TIMESTAMPTZ"

    execute "ALTER TABLE reward_grants ADD CONSTRAINT reward_grants_status_check CHECK (status IN ('pending','granted','consumed','expired','reverted'))"

    add_index :reward_grants, :workspace_id
    add_index :reward_grants, :rule_id
    add_index :reward_grants, :review_id
    add_index :reward_grants, :customer_email
    add_index :reward_grants, :status

    add_foreign_key :reward_grants, :workspaces, on_delete: :cascade
    add_foreign_key :reward_grants, :reward_rules, column: :rule_id
    add_foreign_key :reward_grants, :reviews

    # ─── imports ──────────────────────────────────────────────────────────────
    create_table :imports, id: false, force: :cascade do |t|
      t.column  :id,           :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id, :uuid, null: false
      t.string  :source,       null: false
      t.string  :filename
      t.integer :total_rows
      t.integer :ok_rows,      default: 0
      t.integer :error_rows,   default: 0
      t.string  :status,       null: false, default: "queued"
      t.jsonb   :log,          default: []
      t.datetime :started_at
      t.datetime :finished_at
      t.datetime :created_at,  null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE imports ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE imports ALTER COLUMN started_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE imports ALTER COLUMN finished_at TYPE TIMESTAMPTZ"

    execute "ALTER TABLE imports ADD CONSTRAINT imports_source_check CHECK (source IN ('ryviu','yotpo','trustvox','csv','api','woocommerce','judge_me','loox','stamped','reviews_io'))"
    execute "ALTER TABLE imports ADD CONSTRAINT imports_status_check CHECK (status IN ('queued','processing','done','failed'))"

    add_index :imports, :workspace_id
    add_index :imports, :status

    add_foreign_key :imports, :workspaces, on_delete: :cascade

    # ─── ai_jobs ──────────────────────────────────────────────────────────────
    create_table :ai_jobs, id: false, force: :cascade do |t|
      t.column  :id,                :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,      :uuid, null: false
      t.string  :job_type,          null: false
      t.string  :model
      t.integer :input_tokens,      default: 0
      t.integer :output_tokens,     default: 0
      t.decimal :cost_usd,          precision: 10, scale: 6
      t.column  :target_review_id,  :uuid
      t.string  :status,            null: false, default: "pending"
      t.jsonb   :result
      t.text    :error
      t.integer :duration_ms
      t.datetime :created_at,       null: false, default: -> { "NOW()" }
      t.datetime :finished_at
    end

    execute "ALTER TABLE ai_jobs ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE ai_jobs ALTER COLUMN finished_at TYPE TIMESTAMPTZ"

    execute "ALTER TABLE ai_jobs ADD CONSTRAINT ai_jobs_type_check CHECK (job_type IN ('moderate','generate','reply','sentiment','translate','dedup','embed'))"
    execute "ALTER TABLE ai_jobs ADD CONSTRAINT ai_jobs_status_check CHECK (status IN ('pending','running','done','failed'))"

    add_index :ai_jobs, :workspace_id
    add_index :ai_jobs, :job_type
    add_index :ai_jobs, :status
    add_index :ai_jobs, :created_at

    add_foreign_key :ai_jobs, :workspaces, on_delete: :cascade

    # ─── billing_plans ────────────────────────────────────────────────────────
    create_table :billing_plans, id: false, force: :cascade do |t|
      t.column  :id,                   :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.string  :slug,                 null: false
      t.string  :name,                 null: false
      t.integer :price_monthly_cents,  null: false, default: 0
      t.integer :price_yearly_cents,   null: false, default: 0
      t.integer :max_reviews
      t.integer :max_products
      t.integer :max_users
      t.jsonb   :features,             default: {}
      t.boolean :active,               default: true, null: false
      t.datetime :created_at,          null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE billing_plans ALTER COLUMN created_at TYPE TIMESTAMPTZ"

    add_index :billing_plans, :slug, unique: true
    add_index :billing_plans, :active

    # ─── subscriptions ────────────────────────────────────────────────────────
    create_table :subscriptions, id: false, force: :cascade do |t|
      t.column  :id,                    :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,          :uuid, null: false
      t.column  :plan_id,               :uuid
      t.string  :status,                null: false, default: "trialing"
      t.string  :external_id
      t.datetime :current_period_start
      t.datetime :current_period_end
      t.datetime :trial_ends_at
      t.datetime :canceled_at
      t.timestamps null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE subscriptions ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE subscriptions ALTER COLUMN updated_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE subscriptions ALTER COLUMN current_period_start TYPE TIMESTAMPTZ"
    execute "ALTER TABLE subscriptions ALTER COLUMN current_period_end TYPE TIMESTAMPTZ"
    execute "ALTER TABLE subscriptions ALTER COLUMN trial_ends_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE subscriptions ALTER COLUMN canceled_at TYPE TIMESTAMPTZ"

    execute "ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('trialing','active','past_due','canceled'))"

    add_index :subscriptions, :workspace_id, unique: true
    add_index :subscriptions, :plan_id
    add_index :subscriptions, :status
    add_index :subscriptions, :external_id

    add_foreign_key :subscriptions, :workspaces, on_delete: :cascade
    add_foreign_key :subscriptions, :billing_plans, column: :plan_id

    # ─── audit_logs ───────────────────────────────────────────────────────────
    create_table :audit_logs, id: false, force: :cascade do |t|
      t.column  :id,           :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id, :uuid, null: false
      t.column  :user_id,      :uuid
      t.string  :action,       null: false
      t.string  :entity_type
      t.string  :entity_id
      t.jsonb   :metadata,     default: {}
      t.string  :ip_address
      t.text    :user_agent
      t.datetime :created_at,  null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE audit_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ"

    add_index :audit_logs, :workspace_id
    add_index :audit_logs, :user_id
    add_index :audit_logs, :entity_type
    add_index :audit_logs, :created_at
    add_index :audit_logs, %i[workspace_id entity_type entity_id], name: "idx_audit_logs_entity"

    add_foreign_key :audit_logs, :workspaces, on_delete: :cascade

    # ─── questions ────────────────────────────────────────────────────────────
    create_table :questions, id: false, force: :cascade do |t|
      t.column  :id,                  :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_id,        :uuid, null: false
      t.column  :product_id,          :uuid
      t.string  :author_name
      t.string  :author_email
      t.text    :body,                null: false
      t.text    :answer
      t.column  :answered_by_user_id, :uuid
      t.integer :helpful_count,       default: 0, null: false
      t.string  :status,              null: false, default: "pending"
      t.timestamps null: false, default: -> { "NOW()" }
      t.datetime :answered_at
    end

    execute "ALTER TABLE questions ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE questions ALTER COLUMN updated_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE questions ALTER COLUMN answered_at TYPE TIMESTAMPTZ"

    execute "ALTER TABLE questions ADD CONSTRAINT questions_status_check CHECK (status IN ('pending','published','rejected'))"

    add_index :questions, :workspace_id
    add_index :questions, :product_id
    add_index :questions, :status

    add_foreign_key :questions, :workspaces, on_delete: :cascade
    add_foreign_key :questions, :products, on_delete: :nullify

    # ─── magic_link_tokens ────────────────────────────────────────────────────
    create_table :magic_link_tokens, id: false, force: :cascade do |t|
      t.column  :id,                :uuid, primary_key: true, default: -> { "gen_random_uuid()" }, null: false
      t.column  :workspace_user_id, :uuid, null: false
      t.string  :token_hash,        null: false
      t.datetime :expires_at,       null: false
      t.datetime :used_at
      t.datetime :created_at,       null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE magic_link_tokens ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE magic_link_tokens ALTER COLUMN expires_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE magic_link_tokens ALTER COLUMN used_at TYPE TIMESTAMPTZ"

    add_index :magic_link_tokens, :token_hash, unique: true
    add_index :magic_link_tokens, :workspace_user_id
    add_index :magic_link_tokens, :expires_at

    add_foreign_key :magic_link_tokens, :workspace_users, on_delete: :cascade

    # ─── Row Level Security ───────────────────────────────────────────────────
    %w[
      workspace_users workspace_api_keys workspace_domains
      products reviews review_media replies
      campaigns campaign_sends
      reward_rules reward_grants
      imports ai_jobs
      subscriptions audit_logs questions
    ].each do |table|
      execute "ALTER TABLE #{table} ENABLE ROW LEVEL SECURITY"
      execute <<~SQL
        CREATE POLICY #{table}_workspace_isolation ON #{table}
          USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
      SQL
      execute "ALTER TABLE #{table} FORCE ROW LEVEL SECURITY"
    end
  end

  def down
    %w[
      magic_link_tokens questions audit_logs subscriptions billing_plans
      ai_jobs imports reward_grants reward_rules campaign_sends campaigns
      replies review_media reviews products workspace_domains
      workspace_api_keys workspace_users workspaces
    ].each { |t| drop_table t, if_exists: true }

    execute "DROP EXTENSION IF EXISTS vector"
    execute "DROP EXTENSION IF EXISTS pg_trgm"
    execute "DROP EXTENSION IF EXISTS pgcrypto"
  end
end

class CreateAiSummaryTopics < ActiveRecord::Migration[8.0]
  # "Sumário de IA" feature — merchants curate 3-6 topical groupings of
  # their reviews ("Cabelo fica brilhoso", "Demora pra aparecer resultado")
  # that the storefront widget renders as multiple horizontal carousels.
  #
  # Two tables:
  #   - ai_summary_topics:  one row per (product, topic) — owns title +
  #     stars_avg + review_count + ordering + source ('manual' | 'ai')
  #   - ai_summary_topic_reviews: join table (topic_id, review_id)
  #
  # Topics belong to a product (not a ProductGroup) — the merchant chose
  # to keep curation per-SKU even when reviews are aggregated via group.
  # If they want shared topics across a group later, we can add a nullable
  # product_group_id sibling FK without breaking this schema.

  def up
    # ─── ai_summary_topics ────────────────────────────────────────────────────
    create_table :ai_summary_topics, id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
      t.column   :workspace_id,    :uuid, null: false
      t.column   :product_id,      :uuid, null: false
      t.string   :title,           null: false
      t.integer  :position,        null: false, default: 0
      t.integer  :review_count,    null: false, default: 0
      t.decimal  :stars_avg,       precision: 3, scale: 2 # nil when no reviews attached
      t.string   :source,          null: false, default: "manual" # manual | ai
      t.text     :ai_summary       # short paragraph summary written by Claude (preset 2 may render it)
      t.datetime :generated_at     # last time AI populated/refreshed this topic
      t.datetime :created_at,      null: false, default: -> { "NOW()" }
      t.datetime :updated_at,      null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE ai_summary_topics ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE ai_summary_topics ALTER COLUMN updated_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE ai_summary_topics ALTER COLUMN generated_at TYPE TIMESTAMPTZ"

    add_index :ai_summary_topics, :workspace_id
    add_index :ai_summary_topics, :product_id
    add_index :ai_summary_topics, %i[product_id position]
    add_foreign_key :ai_summary_topics, :workspaces, on_delete: :cascade
    add_foreign_key :ai_summary_topics, :products,   on_delete: :cascade

    execute <<~SQL
      ALTER TABLE ai_summary_topics
        ADD CONSTRAINT ai_summary_topics_source_check
        CHECK (source IN ('manual', 'ai'))
    SQL

    # ─── ai_summary_topic_reviews (join) ──────────────────────────────────────
    create_table :ai_summary_topic_reviews, id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
      t.column   :workspace_id,         :uuid, null: false
      t.column   :ai_summary_topic_id,  :uuid, null: false
      t.column   :review_id,            :uuid, null: false
      t.integer  :position,             null: false, default: 0
      t.boolean  :pinned,               null: false, default: false # featured card in carousel
      t.datetime :created_at,           null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE ai_summary_topic_reviews ALTER COLUMN created_at TYPE TIMESTAMPTZ"

    add_index :ai_summary_topic_reviews, :workspace_id
    add_index :ai_summary_topic_reviews, :ai_summary_topic_id, name: "idx_ai_summ_topic_rev_topic"
    add_index :ai_summary_topic_reviews, %i[ai_summary_topic_id review_id], unique: true, name: "idx_ai_summ_topic_rev_unique"
    add_index :ai_summary_topic_reviews, :review_id, name: "idx_ai_summ_topic_rev_review"

    add_foreign_key :ai_summary_topic_reviews, :workspaces,         on_delete: :cascade
    add_foreign_key :ai_summary_topic_reviews, :ai_summary_topics,  on_delete: :cascade
    add_foreign_key :ai_summary_topic_reviews, :reviews,            on_delete: :cascade

    # ─── Row-Level Security ──────────────────────────────────────────────────
    %w[ai_summary_topics ai_summary_topic_reviews].each do |table|
      execute "ALTER TABLE #{table} ENABLE ROW LEVEL SECURITY"
      execute <<~SQL
        CREATE POLICY #{table}_workspace_isolation ON #{table}
          USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
      SQL
      execute "ALTER TABLE #{table} FORCE ROW LEVEL SECURITY"
    end
  end

  def down
    %w[ai_summary_topic_reviews ai_summary_topics].each do |t|
      execute "DROP POLICY IF EXISTS #{t}_workspace_isolation ON #{t}"
    end
    drop_table :ai_summary_topic_reviews, if_exists: true
    drop_table :ai_summary_topics,        if_exists: true
  end
end

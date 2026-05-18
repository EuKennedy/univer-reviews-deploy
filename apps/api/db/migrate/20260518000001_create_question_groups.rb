class CreateQuestionGroups < ActiveRecord::Migration[8.0]
  def up
    # ─── question_groups ──────────────────────────────────────────────────────
    create_table :question_groups, id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
      t.column :workspace_id, :uuid, null: false
      t.string :name,         null: false
      t.text   :description
      t.datetime :created_at, null: false, default: -> { "NOW()" }
      t.datetime :updated_at, null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE question_groups ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE question_groups ALTER COLUMN updated_at TYPE TIMESTAMPTZ"

    add_index :question_groups, :workspace_id
    add_foreign_key :question_groups, :workspaces, on_delete: :cascade

    # ─── question_group_products (join table) ─────────────────────────────────
    create_table :question_group_products, id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
      t.column :workspace_id,      :uuid, null: false
      t.column :question_group_id, :uuid, null: false
      t.column :product_id,        :uuid, null: false
      t.datetime :created_at,      null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE question_group_products ALTER COLUMN created_at TYPE TIMESTAMPTZ"

    add_index :question_group_products, :workspace_id
    add_index :question_group_products, %i[question_group_id product_id], unique: true, name: "idx_qgp_group_product_unique"
    add_index :question_group_products, :product_id

    add_foreign_key :question_group_products, :workspaces,       on_delete: :cascade
    add_foreign_key :question_group_products, :question_groups,  on_delete: :cascade
    add_foreign_key :question_group_products, :products,         on_delete: :cascade

    # ─── questions.question_group_id ──────────────────────────────────────────
    add_column :questions, :question_group_id, :uuid
    add_index  :questions, :question_group_id
    add_foreign_key :questions, :question_groups, on_delete: :nullify

    # ─── Row Level Security ───────────────────────────────────────────────────
    %w[question_groups question_group_products].each do |table|
      execute "ALTER TABLE #{table} ENABLE ROW LEVEL SECURITY"
      execute <<~SQL
        CREATE POLICY #{table}_workspace_isolation ON #{table}
          USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
      SQL
      execute "ALTER TABLE #{table} FORCE ROW LEVEL SECURITY"
    end
  end

  def down
    %w[question_group_products question_groups].each do |t|
      execute "DROP POLICY IF EXISTS #{t}_workspace_isolation ON #{t}"
    end
    remove_foreign_key :questions, :question_groups rescue nil
    remove_index  :questions, :question_group_id rescue nil
    remove_column :questions, :question_group_id rescue nil
    drop_table :question_group_products, if_exists: true
    drop_table :question_groups,         if_exists: true
  end
end

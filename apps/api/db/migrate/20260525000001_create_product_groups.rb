class CreateProductGroups < ActiveRecord::Migration[8.0]
  def up
    create_table :product_groups, id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
      t.column   :workspace_id,       :uuid, null: false
      t.string   :name,               null: false
      t.string   :slug,               null: false
      t.text     :description
      t.uuid     :primary_product_id
      t.datetime :created_at,         null: false, default: -> { "NOW()" }
      t.datetime :updated_at,         null: false, default: -> { "NOW()" }
    end

    execute "ALTER TABLE product_groups ALTER COLUMN created_at TYPE TIMESTAMPTZ"
    execute "ALTER TABLE product_groups ALTER COLUMN updated_at TYPE TIMESTAMPTZ"

    add_index :product_groups, :workspace_id
    add_index :product_groups, %i[workspace_id slug], unique: true, name: "idx_product_groups_workspace_slug_unique"
    add_foreign_key :product_groups, :workspaces, on_delete: :cascade
    # primary_product_id intentionally NOT FK-enforced — product can be deleted
    # without taking the group with it; group falls back to picking any member.

    # ─── products.product_group_id ────────────────────────────────────────────
    add_column :products, :product_group_id, :uuid
    add_index  :products, :product_group_id
    add_foreign_key :products, :product_groups, on_delete: :nullify

    # ─── Row Level Security ───────────────────────────────────────────────────
    execute "ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY"
    execute <<~SQL
      CREATE POLICY product_groups_workspace_isolation ON product_groups
        USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
    SQL
    execute "ALTER TABLE product_groups FORCE ROW LEVEL SECURITY"
  end

  def down
    execute "DROP POLICY IF EXISTS product_groups_workspace_isolation ON product_groups"
    remove_foreign_key :products, :product_groups rescue nil
    remove_index  :products, :product_group_id rescue nil
    remove_column :products, :product_group_id rescue nil
    drop_table :product_groups, if_exists: true
  end
end

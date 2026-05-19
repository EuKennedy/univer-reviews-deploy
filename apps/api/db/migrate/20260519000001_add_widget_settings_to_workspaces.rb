class AddWidgetSettingsToWorkspaces < ActiveRecord::Migration[8.0]
  # Adds storefront-widget customization columns to `workspaces`.
  #
  # Design note — we deliberately reuse three columns that already model the
  # same concept rather than duplicate them:
  #
  #   widget_theme_color  → brand_color          (workspace-level brand hue)
  #   widget_locale       → default_locale       (workspace-level language)
  #   widget_star_shape   → rating_icon_preset   (star | heart | flame | …)
  #
  # The new columns are widget-specific surface controls that have no
  # analogue elsewhere in the schema.
  def up
    add_column :workspaces, :widget_default_layout,    :string,  default: "default", null: false
    add_column :workspaces, :widget_star_color,        :string,  default: "#fbbf24", null: false
    add_column :workspaces, :widget_show_qa,           :boolean, default: true,      null: false
    add_column :workspaces, :widget_show_write_review, :boolean, default: true,      null: false
    add_column :workspaces, :widget_per_page,          :integer, default: 10,        null: false
    add_column :workspaces, :widget_custom_css,        :text

    execute <<~SQL
      ALTER TABLE workspaces
        ADD CONSTRAINT workspaces_widget_layout_check
        CHECK (widget_default_layout IN ('default','compact','grid','carousel'))
    SQL

    execute <<~SQL
      ALTER TABLE workspaces
        ADD CONSTRAINT workspaces_widget_per_page_check
        CHECK (widget_per_page BETWEEN 1 AND 100)
    SQL

    execute <<~SQL
      ALTER TABLE workspaces
        ADD CONSTRAINT workspaces_widget_star_color_check
        CHECK (widget_star_color ~* '^#[0-9a-f]{6}$')
    SQL
  end

  def down
    execute "ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_widget_star_color_check"
    execute "ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_widget_per_page_check"
    execute "ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_widget_layout_check"

    remove_column :workspaces, :widget_custom_css,        if_exists: true
    remove_column :workspaces, :widget_per_page,          if_exists: true
    remove_column :workspaces, :widget_show_write_review, if_exists: true
    remove_column :workspaces, :widget_show_qa,           if_exists: true
    remove_column :workspaces, :widget_star_color,        if_exists: true
    remove_column :workspaces, :widget_default_layout,    if_exists: true
  end
end

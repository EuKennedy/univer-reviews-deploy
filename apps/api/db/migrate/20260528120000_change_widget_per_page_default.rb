class ChangeWidgetPerPageDefault < ActiveRecord::Migration[8.0]
  # Para o MVP público o default escolhido é 5 reviews/página — mais
  # leve no first paint do widget + menos scroll vertical em mobile,
  # alinhado com Judge.me/Yotpo padrão de mercado. Workspaces já
  # existentes mantêm o valor que configuraram (não tocamos rows).
  def up
    change_column_default :workspaces, :widget_per_page, from: 10, to: 5
  end

  def down
    change_column_default :workspaces, :widget_per_page, from: 5, to: 10
  end
end

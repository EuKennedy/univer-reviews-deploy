class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # Disable STI table_name_prefix that conflicts with type columns
  self.inheritance_column = "_sti_disabled"
end

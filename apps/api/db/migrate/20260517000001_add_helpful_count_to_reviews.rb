class AddHelpfulCountToReviews < ActiveRecord::Migration[8.0]
  def change
    add_column :reviews, :helpful_count,   :integer, default: 0, null: false
    add_column :reviews, :unhelpful_count, :integer, default: 0, null: false
    add_index  :reviews, :helpful_count
  end
end

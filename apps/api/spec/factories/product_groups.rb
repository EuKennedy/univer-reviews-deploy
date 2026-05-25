FactoryBot.define do
  factory :product_group do
    workspace
    sequence(:name) { |n| "Group #{n}" }
    sequence(:slug) { |n| "group-#{n}" }
    description     { Faker::Lorem.sentence }
  end
end

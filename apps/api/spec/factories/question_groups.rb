FactoryBot.define do
  factory :question_group do
    workspace
    sequence(:name) { |n| "FAQ #{n}" }
    description     { Faker::Lorem.sentence }
  end
end

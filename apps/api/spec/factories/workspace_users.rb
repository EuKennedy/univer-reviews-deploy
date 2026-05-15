FactoryBot.define do
  factory :workspace_user do
    workspace
    sequence(:email) { |n| "user#{n}@example.com" }
    name  { Faker::Name.name }
    role  { "admin" }

    trait :owner do
      role { "owner" }
    end

    trait :viewer do
      role { "viewer" }
    end
  end
end

FactoryBot.define do
  factory :workspace do
    sequence(:slug) { |n| "ws-#{n}-#{SecureRandom.hex(3)}" }
    name     { Faker::Company.name }
    plan     { "pro" }
    status   { "active" }
    brand_color { "#d4a850" }
    default_locale   { "pt-BR" }
    default_currency { "BRL" }

    trait :free do
      plan { "free" }
    end

    trait :suspended do
      status { "suspended" }
    end
  end
end

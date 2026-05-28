FactoryBot.define do
  factory :workspace do
    sequence(:slug) { |n| "ws-#{n}-#{SecureRandom.hex(3)}" }
    name     { Faker::Company.name }
    # Default to the middle tier so plan-feature-gated specs that need a
    # "normal paying merchant" don't have to override; the floor / ceiling
    # tiers are still reachable via traits.
    plan     { "medium" }
    status   { "active" }
    brand_color { "#d4a850" }
    default_locale   { "pt-BR" }
    default_currency { "BRL" }

    trait :entry do
      plan { "entry" }
    end

    trait :medium do
      plan { "medium" }
    end

    trait :ultra do
      plan { "ultra" }
    end

    trait :suspended do
      status { "suspended" }
    end
  end
end

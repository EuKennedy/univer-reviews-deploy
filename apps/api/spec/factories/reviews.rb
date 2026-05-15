FactoryBot.define do
  factory :review do
    workspace
    product
    rating      { rand(1..5) }
    title       { Faker::Lorem.sentence(word_count: 4) }
    body        { Faker::Lorem.paragraph(sentence_count: 3) }
    author_name { Faker::Name.name }
    author_email { Faker::Internet.email }
    source      { "widget" }
    status      { "pending" }
    language    { "pt-BR" }

    trait :approved do
      status      { "approved" }
      approved_at { Time.current }
    end

    trait :rejected do
      status { "rejected" }
    end

    trait :spam do
      status { "spam" }
    end

    trait :five_star do
      rating { 5 }
    end

    trait :one_star do
      rating { 1 }
    end

    trait :verified do
      is_verified_purchase { true }
    end
  end
end

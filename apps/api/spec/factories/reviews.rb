FactoryBot.define do
  factory :review do
    # Force :create for the associations so `build(:review)` still has a
    # persisted workspace_id / product_id. FactoryBot 5+ defaults to the parent
    # strategy for nested associations, so a bare `workspace` line under
    # `build(:review)` would only build (not save) the workspace, leaving
    # workspace_id nil — which fails the explicit
    # `validates :workspace_id, presence: true` on the Review model.
    association :workspace, strategy: :create
    association :product,   strategy: :create
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

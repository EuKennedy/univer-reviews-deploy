FactoryBot.define do
  factory :question do
    workspace
    product
    author_name  { Faker::Name.name }
    author_email { Faker::Internet.email }
    body         { Faker::Lorem.sentence(word_count: 8) + "?" }
    status       { "pending" }

    trait :published do
      status      { "published" }
      answer      { Faker::Lorem.paragraph(sentence_count: 2) }
      answered_at { Time.current }
    end

    trait :rejected do
      status { "rejected" }
    end
  end
end

FactoryBot.define do
  factory :ai_summary_topic do
    workspace
    product { association :product, workspace: workspace }
    sequence(:title) { |n| "Tópico #{n}" }
    sequence(:position) { |n| n }
    source { "manual" }
    review_count { 0 }
    stars_avg { nil }

    trait :ai do
      source { "ai" }
      generated_at { Time.current }
      ai_summary { "Resumo gerado por IA descrevendo o que clientes falam." }
    end
  end
end

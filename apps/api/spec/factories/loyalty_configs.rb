FactoryBot.define do
  factory :loyalty_config do
    workspace
    sequence(:source_campaign_id) { |n| n }
    name           { "Avaliação com pontos" }
    description    { "Pontos por avaliação aprovada" }
    is_active      { true }
    base_points    { 50 }
    min_chars      { 50 }
    only_logged_in { true }
    bonus_photo    { 10 }
    bonus_video    { 25 }
    bonus_verified { 15 }
    priority       { 0 }
  end
end

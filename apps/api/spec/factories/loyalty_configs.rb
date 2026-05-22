FactoryBot.define do
  factory :loyalty_config do
    workspace
    sequence(:source_campaign_id) { |n| n }
    name           { "Avaliação com pontos" }
    description    { "Pontos por avaliação aprovada" }
    is_active      { true }
    rule_type      { "review_tiers" }
    points_text    { 100 }
    points_photo   { 200 }
    points_video   { 300 }
    base_points    { 100 }
    min_chars      { 50 }
    only_logged_in { true }
    bonus_photo    { 0 }
    bonus_video    { 0 }
    bonus_verified { 50 }
    priority       { 0 }
  end
end

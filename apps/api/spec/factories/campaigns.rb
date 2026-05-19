FactoryBot.define do
  factory :campaign do
    workspace
    name           { "Pos-compra #{SecureRandom.hex(2)}" }
    type           { "email" }
    status         { "active" }
    trigger_type   { "order_completed" }
    trigger_events { %w[order_completed] }
    trigger_after_minutes { 0 }
    from_name      { "UniverReviews" }
    from_email     { "noreply@univerreviews.com" }
    reply_to       { "suporte@univerreviews.com" }
    subject_template { "Avalie sua compra em {{store_name}}" }
    html_template    { "<p>Olá {{customer_name}}, avalie em <a href=\"{{review_link}}\">aqui</a>.</p>" }

    trait :listens_for_delivered do
      trigger_events { %w[order_delivered] }
    end

    trait :listens_for_both do
      trigger_events { %w[order_completed order_delivered] }
    end

    trait :draft do
      status { "draft" }
    end
  end
end

FactoryBot.define do
  factory :platform_event do
    workspace
    platform          { "woocommerce" }
    event_type        { "order_completed" }
    sequence(:external_order_id) { |n| "ORD-#{n}" }
    customer_email    { "buyer-#{SecureRandom.hex(2)}@example.com" }
    customer_name     { "Buyer Person" }
    order_total       { 99.90 }
    currency          { "BRL" }
    product_handles   { ["sample-product"] }
    raw_payload       { {} }
    received_at       { Time.current }

    trait :delivered do
      event_type { "order_delivered" }
    end

    trait :processed do
      processed_at { Time.current }
    end
  end
end

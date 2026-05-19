FactoryBot.define do
  factory :campaign_send do
    transient do
      # When the caller doesn't pass workspace, derive it from campaign so both
      # ends of the FK point to the same row.
    end

    campaign        { association :campaign }
    workspace       { campaign.workspace }
    recipient_email { "to-#{SecureRandom.hex(2)}@example.com" }
    recipient_name  { "Recipient" }
    customer_email  { recipient_email }
    sequence(:external_order_id) { |n| "ORD-#{n}" }
    status          { "queued" }
    scheduled_at    { Time.current }
    product_ids     { [] }
  end
end

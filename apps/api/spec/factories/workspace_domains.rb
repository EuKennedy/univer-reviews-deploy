FactoryBot.define do
  factory :workspace_domain do
    workspace
    sequence(:domain) { |n| "store-#{n}.example.com" }
    platform { "woocommerce" }
    platform_meta do
      {
        "store_url"       => "https://#{domain}",
        "consumer_key"    => "ck_test",
        "consumer_secret" => "cs_test"
      }
    end

    trait :shopify do
      platform { "shopify" }
    end

    trait :generic do
      platform { "generic" }
    end

    trait :verified do
      verified_at { Time.current }
    end

    trait :with_webhook_secret do
      platform_meta do
        {
          "store_url"       => "https://#{domain}",
          "consumer_key"    => "ck_test",
          "consumer_secret" => "cs_test",
          "webhook_secret"  => SecureRandom.hex(16)
        }
      end
    end
  end
end

FactoryBot.define do
  factory :workspace_api_key do
    workspace
    sequence(:key_prefix) { |n| "unvr_#{n.to_s.rjust(6, '0')}" }
    key_hash { Digest::SHA256.hexdigest(SecureRandom.hex(32)) }
    label    { "Test Key" }
    scopes   { "read,write" }

    trait :read_only do
      scopes { "read" }
    end

    trait :revoked do
      revoked_at { 1.hour.ago }
    end

    trait :expired do
      expires_at { 1.hour.ago }
    end
  end
end

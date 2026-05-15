require "digest"
require "securerandom"

puts "Seeding billing plans..."

plans = [
  {
    slug: "free",
    name: "Free",
    price_monthly_cents: 0,
    price_yearly_cents: 0,
    max_reviews: 100,
    max_products: 10,
    max_users: 1,
    features: {
      ai_moderation: false,
      ai_replies: false,
      campaigns: false,
      rewards: false,
      widget: true,
      api_access: false,
      csv_import: true,
      analytics: "basic"
    }
  },
  {
    slug: "starter",
    name: "Starter",
    price_monthly_cents: 1900,
    price_yearly_cents: 19_000,
    max_reviews: 1_000,
    max_products: 50,
    max_users: 3,
    features: {
      ai_moderation: true,
      ai_replies: false,
      campaigns: true,
      rewards: false,
      widget: true,
      api_access: true,
      csv_import: true,
      analytics: "standard"
    }
  },
  {
    slug: "pro",
    name: "Pro",
    price_monthly_cents: 4900,
    price_yearly_cents: 49_000,
    max_reviews: 10_000,
    max_products: 500,
    max_users: 10,
    features: {
      ai_moderation: true,
      ai_replies: true,
      campaigns: true,
      rewards: true,
      widget: true,
      api_access: true,
      csv_import: true,
      woocommerce_sync: true,
      analytics: "advanced",
      dedup: true
    }
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price_monthly_cents: 19_900,
    price_yearly_cents: 199_000,
    max_reviews: nil,
    max_products: nil,
    max_users: nil,
    features: {
      ai_moderation: true,
      ai_replies: true,
      campaigns: true,
      rewards: true,
      widget: true,
      api_access: true,
      csv_import: true,
      woocommerce_sync: true,
      shopify_sync: true,
      analytics: "enterprise",
      dedup: true,
      sla: true,
      white_label: true
    }
  }
]

billing_plans = plans.map do |attrs|
  BillingPlan.find_or_create_by!(slug: attrs[:slug]) do |p|
    p.assign_attributes(attrs)
  end
end

puts "  #{billing_plans.size} plans seeded."

puts "Seeding Lizzon workspace..."

lizzon = Workspace.find_or_create_by!(slug: "lizzon") do |w|
  w.name            = "Lizzon"
  w.plan            = "pro"
  w.status          = "active"
  w.brand_color     = "#d4a850"
  w.default_locale  = "pt-BR"
  w.default_currency = "BRL"
  w.brand_voice_md  = <<~MD
    # Voz da marca Lizzon

    Somos calorosos, confiantes e diretos. Falamos como especialistas amigáveis,
    nunca como corporações distantes. Usamos linguagem clara, celebramos o cliente
    e reconhecemos críticas com honestidade.

    ## Tom
    - Positivo: entusiasta, mas não exagerado
    - Negativo: empático, proativo, oferece solução
    - Neutro: informativo, grato pelo feedback

    ## Evitar
    - Jargões técnicos desnecessários
    - Promessas que não podemos cumprir
    - Respostas genéricas copiadas
  MD
end

puts "  Workspace: #{lizzon.name} (#{lizzon.slug})"

# Owner user
owner = WorkspaceUser.find_or_create_by!(workspace: lizzon, email: "diego@lizzon.com.br") do |u|
  u.name = "Diego – Lizzon"
  u.role = "owner"
end

puts "  Owner: #{owner.email}"

# API key
raw_key = "unvr_lizzon_#{SecureRandom.hex(32)}"
key_hash = Digest::SHA256.hexdigest(raw_key)
key_prefix = raw_key[0, 8]

api_key = WorkspaceApiKey.find_or_create_by!(workspace: lizzon, key_prefix: key_prefix) do |k|
  k.key_hash = key_hash
  k.label    = "Default – seed"
  k.scopes   = "read,write"
end

puts "  API key prefix: #{api_key.key_prefix}"
puts "  *** SEED KEY (save this, it won't be shown again): #{raw_key}" if api_key.previously_new_record?

# Domain
domain = WorkspaceDomain.find_or_create_by!(domain: "lizzon.com.br") do |d|
  d.workspace    = lizzon
  d.platform     = "woocommerce"
  d.verified_at  = Time.current
  d.platform_meta = {}
end

puts "  Domain: #{domain.domain}"

# Subscription
pro_plan = BillingPlan.find_by!(slug: "pro")

sub = Subscription.find_or_create_by!(workspace: lizzon) do |s|
  s.plan                = pro_plan
  s.status              = "active"
  s.current_period_start = Time.current.beginning_of_month
  s.current_period_end   = Time.current.end_of_month
end

puts "  Subscription: #{sub.status} on #{pro_plan.name}"
puts "Done."

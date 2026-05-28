require "digest"
require "securerandom"

puts "Seeding billing plans..."

# Three-tier paid ladder (T1.3): entry/medium/ultra. Each slug doubles as
# the canonical Workspace#plan value — the Stripe webhook copies the
# checkout's plan_slug straight into workspaces.plan, so any rename here
# must move with PlanFeatures::TIERS and the workspaces_plan_check CHECK
# constraint or every checkout will silently fail validation.
plans = [
  {
    slug: "entry",
    name: "Entry",
    price_monthly_cents: 2900,
    price_yearly_cents: 29_000,
    max_reviews: 1_000,
    max_products: 100,
    max_users: 1,
    features: {
      ai_moderation: true,
      ai_replies: true,
      ai_generate: true,
      campaigns: true,
      rewards: false,
      widget: true,
      api_access: false,
      csv_import: true,
      analytics: "standard"
    }
  },
  {
    slug: "medium",
    name: "Medium",
    price_monthly_cents: 9900,
    price_yearly_cents: 99_000,
    max_reviews: 10_000,
    max_products: 1_000,
    max_users: 5,
    features: {
      ai_moderation: true,
      ai_replies: true,
      ai_generate: true,
      ai_dedup: true,
      campaigns: true,
      rewards: true,
      widget: true,
      api_access: true,
      csv_import: true,
      woocommerce_sync: true,
      webhook_auto_register: true,
      analytics: "advanced"
    }
  },
  {
    slug: "ultra",
    name: "Ultra",
    price_monthly_cents: 29_900,
    price_yearly_cents: 299_000,
    max_reviews: nil,
    max_products: nil,
    max_users: nil,
    features: {
      ai_moderation: true,
      ai_replies: true,
      ai_generate: true,
      ai_dedup: true,
      ai_bulk_generate: true,
      bulk_qa: true,
      bulk_ai_summary: true,
      campaigns: true,
      rewards: true,
      widget: true,
      api_access: true,
      csv_import: true,
      woocommerce_sync: true,
      shopify_sync: true,
      webhook_auto_register: true,
      analytics: "enterprise",
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
  w.plan            = "medium"
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
default_plan = BillingPlan.find_by!(slug: "medium")

sub = Subscription.find_or_create_by!(workspace: lizzon) do |s|
  s.plan                = default_plan
  s.status              = "active"
  s.current_period_start = Time.current.beginning_of_month
  s.current_period_end   = Time.current.end_of_month
end

puts "  Subscription: #{sub.status} on #{default_plan.name}"
puts "Done."

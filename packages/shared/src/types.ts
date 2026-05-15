// ─── Enums ───────────────────────────────────────────────────────────────────

export enum ReviewStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  NeedsEdit = 'needs_edit',
}

export enum ReviewSource {
  Widget = 'widget',
  Email = 'email',
  Import = 'import',
  Api = 'api',
  WooCommerce = 'woocommerce',
  Manual = 'manual',
}

export enum UserRole {
  Owner = 'owner',
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
}

export enum CampaignStatus {
  Draft = 'draft',
  Scheduled = 'scheduled',
  Sending = 'sending',
  Sent = 'sent',
  Paused = 'paused',
  Failed = 'failed',
}

export enum CampaignType {
  ReviewRequest = 'review_request',
  ThankYou = 'thank_you',
  Reminder = 'reminder',
  RewardNotification = 'reward_notification',
  Custom = 'custom',
}

export enum ImportStatus {
  Pending = 'pending',
  Processing = 'processing',
  Done = 'done',
  Failed = 'failed',
}

export enum ImportSource {
  Csv = 'csv',
  WooCommerce = 'woocommerce',
  Shopify = 'shopify',
  AliExpress = 'aliexpress',
  MercadoLivre = 'mercado_livre',
  Manual = 'manual',
}

export enum AiJobType {
  Moderate = 'moderate',
  GenerateVariants = 'generate_variants',
  SuggestReply = 'suggest_reply',
  Dedup = 'dedup',
  Sentiment = 'sentiment',
  Translate = 'translate',
}

export enum AiJobStatus {
  Queued = 'queued',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}

export enum BillingPlan {
  Starter = 'starter',
  Pro = 'pro',
  Enterprise = 'enterprise',
}

export enum SubscriptionStatus {
  Active = 'active',
  Trialing = 'trialing',
  PastDue = 'past_due',
  Canceled = 'canceled',
  Unpaid = 'unpaid',
}

export enum RewardType {
  Discount = 'discount',
  FreeShipping = 'free_shipping',
  GiftCard = 'gift_card',
  Points = 'points',
}

export enum AuditAction {
  ReviewApproved = 'review.approved',
  ReviewRejected = 'review.rejected',
  ReviewEdited = 'review.edited',
  ReviewReplied = 'review.replied',
  ReviewImported = 'review.imported',
  CampaignSent = 'campaign.sent',
  SettingsUpdated = 'settings.updated',
  ApiKeyCreated = 'api_key.created',
  ApiKeyRevoked = 'api_key.revoked',
  MemberInvited = 'member.invited',
  MemberRemoved = 'member.removed',
  PlanChanged = 'plan.changed',
}

// ─── Workspace ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  slug: string
  logo_url: string | null
  domain: string | null
  plan: BillingPlan
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  settings: WorkspaceSettings
  created_at: string
  updated_at: string
}

export interface WorkspaceSettings {
  brand_color: string
  brand_voice_md: string | null
  auto_approve_threshold: number
  auto_reject_threshold: number
  require_media: boolean
  moderate_with_ai: boolean
  default_locale: string
  timezone: string
  notify_new_review: boolean
  notify_email: string | null
  woocommerce?: WooCommerceConfig
}

export interface WorkspaceUser {
  id: string
  workspace_id: string
  user_id: string
  role: UserRole
  invited_by: string | null
  accepted_at: string | null
  created_at: string
  user: {
    id: string
    name: string
    email: string
    avatar_url: string | null
  }
}

export interface WorkspaceApiKey {
  id: string
  workspace_id: string
  name: string
  key_prefix: string
  key_hash: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  created_by: string
  created_at: string
}

export interface WorkspaceDomain {
  id: string
  workspace_id: string
  domain: string
  verified: boolean
  verification_token: string
  verified_at: string | null
  created_at: string
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  workspace_id: string
  external_id: string
  name: string
  description: string | null
  image_url: string | null
  url: string | null
  sku: string | null
  price: number | null
  currency: string | null
  review_count: number
  average_rating: number
  created_at: string
  updated_at: string
}

// ─── Review ──────────────────────────────────────────────────────────────────

export interface ReviewMedia {
  id: string
  review_id: string
  type: 'image' | 'video'
  url: string
  thumb_url: string
  width: number
  height: number
  duration_s: number | null
  size_bytes: number
  created_at: string
}

export interface Reply {
  id: string
  review_id: string
  body: string
  author_name: string
  author_id: string | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  workspace_id: string
  product_id: string
  rating: number
  title: string
  body: string
  author_name: string
  author_email: string
  author_country: string
  author_ip: string | null
  status: ReviewStatus
  source: ReviewSource
  is_verified_purchase: boolean
  external_id: string | null
  order_id: string | null
  quality_score: number | null
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | null
  is_synthetic: boolean
  topics: string[]
  flagged_issues: string[]
  media: ReviewMedia[]
  reply: Reply | null
  product: Product | null
  created_at: string
  updated_at: string
  published_at: string | null
}

// ─── Review Summary ──────────────────────────────────────────────────────────

export interface ReviewSummary {
  product_id: string
  average_rating: number
  total_count: number
  distribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
  verified_count: number
  with_media_count: number
  with_reply_count: number
  sentiment_breakdown: {
    positive: number
    negative: number
    neutral: number
    mixed: number
  }
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string
  workspace_id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  subject: string
  body_html: string
  from_name: string
  from_email: string
  reply_to: string | null
  delay_days: number
  product_id: string | null
  segment: CampaignSegment | null
  stats: CampaignStats
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface CampaignSegment {
  min_order_value: number | null
  max_order_value: number | null
  product_ids: string[]
  has_reviewed: boolean | null
  locale: string | null
}

export interface CampaignStats {
  total_sent: number
  delivered: number
  opened: number
  clicked: number
  unsubscribed: number
  reviews_generated: number
  open_rate: number
  click_rate: number
  conversion_rate: number
}

export interface CampaignSend {
  id: string
  campaign_id: string
  recipient_email: string
  recipient_name: string
  order_id: string | null
  product_id: string | null
  token: string
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed'
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  review_id: string | null
  created_at: string
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

export interface RewardRule {
  id: string
  workspace_id: string
  name: string
  description: string | null
  type: RewardType
  value: number
  currency: string | null
  code_prefix: string | null
  min_rating: number
  require_media: boolean
  require_verified: boolean
  max_grants_per_customer: number
  total_budget: number | null
  used_budget: number
  is_active: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface RewardGrant {
  id: string
  rule_id: string
  review_id: string
  customer_email: string
  customer_name: string
  type: RewardType
  value: number
  coupon_code: string | null
  claimed_at: string | null
  expires_at: string | null
  created_at: string
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface Import {
  id: string
  workspace_id: string
  source: ImportSource
  status: ImportStatus
  file_url: string | null
  file_name: string | null
  total_rows: number
  processed_rows: number
  imported_count: number
  skipped_count: number
  error_count: number
  error_log: ImportError[]
  started_at: string | null
  finished_at: string | null
  created_by: string
  created_at: string
}

export interface ImportError {
  row: number
  field: string | null
  message: string
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface AiJob {
  id: string
  workspace_id: string
  type: AiJobType
  status: AiJobStatus
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  model: string
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  error: string | null
  review_id: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface ModerationResult {
  quality_score: number
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  is_synthetic: boolean
  topics: string[]
  suggestion: 'approve' | 'review' | 'reject'
  reason: string
  flagged_issues: string[]
}

export interface GeneratedVariant {
  title: string
  body: string
  diff_score: number
}

export interface SentimentResult {
  review_id: string
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  topics: string[]
  confidence: number
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface BillingPlanDetails {
  id: BillingPlan
  name: string
  price_usd_month: number
  price_usd_year: number
  limits: PlanLimits
  features: string[]
}

export interface PlanLimits {
  reviews_per_month: number
  products: number
  team_members: number
  campaigns_per_month: number
  ai_jobs_per_month: number
  storage_gb: number
  custom_domain: boolean
  api_access: boolean
  priority_support: boolean
  white_label: boolean
}

export interface Subscription {
  id: string
  workspace_id: string
  plan: BillingPlan
  status: SubscriptionStatus
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  current_period_start: string
  current_period_end: string
  cancel_at: string | null
  canceled_at: string | null
  trial_start: string | null
  trial_end: string | null
  created_at: string
  updated_at: string
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  workspace_id: string
  actor_id: string | null
  actor_name: string
  actor_email: string
  action: AuditAction
  resource_type: string
  resource_id: string | null
  diff: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface WorkspaceStats {
  total_reviews: number
  pending_reviews: number
  approved_reviews: number
  rejected_reviews: number
  average_rating: number
  reviews_this_month: number
  reviews_last_month: number
  reviews_growth_pct: number
  total_products: number
  products_with_reviews: number
  total_campaigns: number
  campaigns_sent_this_month: number
  ai_jobs_this_month: number
  ai_cost_usd_this_month: number
  storage_used_gb: number
  top_topics: Array<{ topic: string; count: number }>
  rating_trend: Array<{ date: string; avg_rating: number; count: number }>
}

// ─── Dedup ───────────────────────────────────────────────────────────────────

export interface DuplicateCluster {
  id: string
  workspace_id: string
  product_id: string
  review_ids: string[]
  similarity_score: number
  recommendation: 'keep_first' | 'keep_best_quality' | 'rewrite_all' | 'manual_review'
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  reviews?: Review[]
}

// ─── Catalog Health ──────────────────────────────────────────────────────────

export interface CatalogHealth {
  total_products: number
  products_with_reviews: number
  products_without_reviews: number
  products_below_threshold: number
  coverage_pct: number
  average_rating: number
  review_velocity: number
  by_product: CatalogHealthByProduct[]
}

export interface CatalogHealthByProduct {
  product_id: string
  product_name: string
  review_count: number
  average_rating: number
  last_review_at: string | null
  health_score: number
  issues: string[]
}

// ─── WooCommerce ─────────────────────────────────────────────────────────────

export interface WooCommerceConfig {
  site_url: string
  consumer_key: string
  consumer_secret: string
  sync_enabled: boolean
  sync_direction: 'push' | 'pull' | 'bidirectional'
  last_sync_at: string | null
  auto_approve_woo_reviews: boolean
  import_ratings_as_reviews: boolean
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  per_page: number
  total: number
  total_pages: number
}

export interface ApiError {
  error: string
  message: string
  code: string
  status: number
  details?: Record<string, string[]>
}

export interface ApiSuccess<T = void> {
  success: true
  data: T
}

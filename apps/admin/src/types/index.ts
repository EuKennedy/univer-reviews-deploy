// ─── Review ───────────────────────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden' | 'spam'
export type ReviewSource = 'widget' | 'woocommerce' | 'api' | 'import' | 'ai_generated'
export type BulkAction = 'approve' | 'reject' | 'delete' | 'hide' | 'mark_spam'

export interface ReviewMedia {
  id: string
  url: string
  type: 'image' | 'video'
  thumbnail_url?: string
}

export interface ReviewReply {
  id: string
  body: string
  author: string
  created_at: string
  ai_generated: boolean
}

export interface AiAnalysis {
  quality_score: number
  sentiment: 'positive' | 'neutral' | 'negative'
  topics: string[]
  is_synthetic: boolean
  synthetic_confidence: number
  moderation_flags: string[]
}

export interface Review {
  id: string
  workspace_id: string
  product_id: string | null
  product_name: string | null
  author_name: string
  author_email: string | null
  author_avatar_url: string | null
  rating: number
  title: string | null
  body: string
  status: ReviewStatus
  source: ReviewSource
  verified_purchase: boolean
  helpful_count: number
  media: ReviewMedia[]
  replies: ReviewReply[]
  ai_analysis: AiAnalysis | null
  reward_id: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface ReviewListParams {
  page?: number
  per_page?: number
  q?: string
  status?: ReviewStatus | ''
  rating?: number | ''
  source?: ReviewSource | ''
  product_id?: string
  from?: string
  to?: string
  sort?: string
  direction?: 'asc' | 'desc'
}

export interface ReviewVariant {
  id: string
  body: string
  rating: number
  author_name: string
}

export interface CreateReviewInput {
  product_id: string
  author_name: string
  author_email?: string
  rating: number
  title?: string
  body: string
  status?: ReviewStatus
}

export interface AiModerateResult {
  review_id: string
  quality_score: number
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  topics: string[]
  is_synthetic: boolean
  synthetic_confidence: number
  moderation_flags: string[]
  recommendation: 'approve' | 'reject' | 'review'
  reason?: string | null
}

export interface AiHealth {
  configured: boolean
  reason: 'ok' | 'missing' | 'placeholder' | string
  models: { sonnet: string; haiku: string }
}

export interface AiSimilarReview {
  id: string
  title: string | null
  body: string | null
  rating: number
  status: ReviewStatus
  neighbor_distance: number
}

export interface GenerateVariantsInput {
  product_name: string
  rating: number
  tone: string
  count: number
  template?: string
}

export interface DuplicateCluster {
  id: string
  review_ids: string[]
  count: number
  similarity_score: number
  sample_reviews: Pick<Review, 'id' | 'body' | 'author_name' | 'rating'>[]
  product_id: string | null
  product_name: string | null
  created_at: string
}

// ─── Workspace ────────────────────────────────────────────────────────────────

export type RatingIcon = 'star' | 'heart' | 'flame' | 'thumb' | 'diamond'
export type UserRole = 'owner' | 'admin' | 'moderator' | 'viewer'

export interface WorkspaceUser {
  id: string
  email: string
  name: string
  avatar_url: string | null
  role: UserRole
  created_at: string
  last_seen_at: string | null
}

export interface WorkspaceBranding {
  brand_color: string
  rating_icon: RatingIcon
  logo_url: string | null
  brand_voice: string | null
}

/**
 * Storefront `<univer-reviews>` widget customization. The admin "Aparência do
 * Widget" tab edits these fields and the storefront fetches them via
 * GET /api/v1/public/widget-config. Per-element HTML attributes always win
 * over the workspace-level values stored here (precedence:
 * attribute > workspace setting > built-in default).
 */
export type WidgetLayout = 'default' | 'compact' | 'grid' | 'carousel'
export type WidgetLocale = 'pt-BR' | 'en-US' | 'es-AR'
export type WidgetStarShape = 'star' | 'heart' | 'flame' | 'thumb' | 'diamond'

export interface WidgetConfig {
  layout: WidgetLayout
  locale: WidgetLocale
  theme_color: string
  star_color: string
  star_shape: WidgetStarShape
  show_qa: boolean
  show_write_review: boolean
  per_page: number
  custom_css: string
}

export interface WorkspaceDomain {
  id: string
  domain: string
  platform: 'woocommerce' | 'shopify' | 'generic'
  verified: boolean
}

export interface Workspace {
  id: string
  name: string
  slug: string
  default_locale: string
  currency: string
  branding: WorkspaceBranding
  /** Storefront widget customization. Optional so older payloads still type-check. */
  widget?: WidgetConfig
  plan: 'free' | 'starter' | 'pro' | 'enterprise'
  users: WorkspaceUser[]
  domains: WorkspaceDomain[]
  created_at: string
}

/**
 * Snake-case payload accepted by PATCH /api/v1/workspace for the widget
 * "Aparência" tab. Sent as flat keys (no `widget:` envelope) because the
 * Rails controller permits them at the top level of `workspace_params`.
 */
export interface WidgetUpdatePayload {
  brand_color?: string
  default_locale?: WidgetLocale
  rating_icon_preset?: WidgetStarShape
  widget_default_layout?: WidgetLayout
  widget_star_color?: string
  widget_show_qa?: boolean
  widget_show_write_review?: boolean
  widget_per_page?: number
  widget_custom_css?: string
}

export interface WorkspaceStats {
  total_reviews: number
  total_reviews_delta: number
  avg_rating: number
  avg_rating_delta: number
  pending_moderation: number
  pending_moderation_delta: number
  reviews_this_month: number
  reviews_this_month_delta: number
  reviews_over_time: { date: string; count: number }[]
  rating_distribution: { rating: number; count: number }[]
}

// ─── Product ──────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  workspace_id: string
  external_id: string | null
  name: string
  slug: string
  image_url: string | null
  price: number | null
  currency: string
  review_count: number
  avg_rating: number | null
  source: string
  created_at: string
  updated_at: string
}

// ─── Questions & Q&A Groups ───────────────────────────────────────────────────

export type QuestionStatus = 'pending' | 'published' | 'rejected'

export interface Question {
  id: string
  product_id: string | null
  question_group_id: string | null
  author_name: string | null
  body: string
  answer: string | null
  answered_at: string | null
  helpful_count: number
  status: QuestionStatus
  created_at: string
  updated_at: string
}

export interface QuestionGroup {
  id: string
  name: string
  description: string | null
  products_count: number
  questions_count: number
  created_at: string
  updated_at: string
  products?: Array<{
    id: string
    title: string
    handle: string | null
    image_url: string | null
  }>
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived' | 'completed'
export type CampaignType = 'email' | 'sms' | 'whatsapp'
export type CampaignTriggerEvent =
  | 'order_completed'
  | 'order_delivered'
  | 'order_paid'
  | 'order_refunded'

/**
 * Email-first campaign shape. Older shape (subject/body/type/trigger) kept as
 * optional for backwards compatibility with the legacy list view; new fields
 * are authoritative for the post-purchase email automation flow.
 */
export interface Campaign {
  id: string
  workspace_id: string
  name: string
  status: CampaignStatus

  // Triggering + scheduling
  trigger_events: CampaignTriggerEvent[]
  trigger_after_minutes: number

  // From / reply-to
  from_name: string
  from_email: string
  reply_to: string | null

  // Email content
  subject_template: string
  html_template: string

  // Aggregates
  sent_count: number
  open_count: number
  click_count: number
  review_count: number

  created_at: string
  updated_at: string

  // ── Legacy fields (optional — kept so older callers still type-check) ──
  type?: CampaignType
  subject?: string | null
  body?: string
  trigger?: 'manual' | 'post_purchase' | 'scheduled'
}

export type CampaignSendStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'converted'

export interface CampaignSend {
  id: string
  campaign_id: string
  recipient_email: string
  recipient_name: string | null
  status: CampaignSendStatus
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  bounced_at: string | null
  external_order_id: string | null
  opened_count: number
  clicked_count: number
  last_event_at: string | null
  created_at: string
}

export interface CampaignStats {
  sent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
  delivered_rate: number
  open_rate: number
  click_rate: number
  conversion_rate: number
}

export interface CampaignInput {
  name: string
  status?: CampaignStatus
  trigger_events: CampaignTriggerEvent[]
  trigger_after_minutes: number
  from_name?: string
  from_email?: string
  reply_to?: string | null
  subject_template: string
  html_template: string
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export interface WooCommerceConfig {
  store_url: string
  consumer_key: string
  consumer_secret: string
  sync_products: boolean
  sync_reviews: boolean
  auto_sync_interval: number
  connected: boolean
  last_sync_at: string | null
  product_count: number | null
  review_count: number | null
  webhooks?: {
    registered_count: number
    registered_at: string | null
    topics: string[]
  }
}

// ─── Catalog Health ───────────────────────────────────────────────────────────

export interface CatalogHealth {
  health_score: number
  total_products: number
  products_with_reviews: number
  products_without_reviews: number
  avg_reviews_per_product: number
  products_below_threshold: number
}

export interface CatalogHealthByProduct {
  product_id: string
  product_name: string
  review_count: number
  avg_rating: number | null
  health_score: number
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    per_page: number
    total_count: number
    total_pages: number
  }
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}

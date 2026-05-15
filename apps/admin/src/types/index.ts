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
  sentiment: 'positive' | 'neutral' | 'negative'
  topics: string[]
  is_synthetic: boolean
  synthetic_confidence: number
  moderation_flags: string[]
  recommendation: 'approve' | 'reject' | 'review'
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

export interface Workspace {
  id: string
  name: string
  slug: string
  default_locale: string
  currency: string
  branding: WorkspaceBranding
  plan: 'free' | 'starter' | 'pro' | 'enterprise'
  users: WorkspaceUser[]
  domains: string[]
  created_at: string
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

// ─── Campaign ─────────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed'
export type CampaignType = 'email' | 'sms' | 'whatsapp'

export interface Campaign {
  id: string
  workspace_id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  subject: string | null
  body: string
  trigger: 'manual' | 'post_purchase' | 'scheduled'
  sent_count: number
  open_count: number
  click_count: number
  review_count: number
  created_at: string
  updated_at: string
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

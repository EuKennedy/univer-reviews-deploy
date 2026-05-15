import { z } from 'zod'
import {
  ReviewStatus, ReviewSource, UserRole,
  CampaignType, CampaignStatus,
  ImportSource, RewardType, BillingPlan,
} from './types'
import {
  REVIEW_MIN_LENGTH, REVIEW_MAX_LENGTH, REVIEW_TITLE_MAX_LENGTH,
  QUESTION_MIN_LENGTH, QUESTION_MAX_LENGTH, REPLY_MAX_LENGTH,
  MAX_MEDIA_PER_REVIEW, SUPPORTED_LOCALES,
  DEFAULT_AUTO_APPROVE_THRESHOLD, DEFAULT_AUTO_REJECT_THRESHOLD,
} from './constants'

// ─── Primitives ──────────────────────────────────────────────────────────────

const email = z.string().email('E-mail inválido').max(254)
const nonEmpty = (label: string) => z.string().min(1, `${label} é obrigatório`).max(255)
const url = z.string().url('URL inválida').max(2048)
const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor inválida (use hex: #rrggbb)')
const locale = z.enum(SUPPORTED_LOCALES)
const rating = z.number().int().min(1).max(5)
const page = z.number().int().min(1).default(1)
const perPage = z.number().int().min(1).max(100).default(20)

// ─── Public Review Submission ─────────────────────────────────────────────────

export const SubmitReviewSchema = z.object({
  rating: rating,
  title: z.string().max(REVIEW_TITLE_MAX_LENGTH).optional(),
  body: z.string()
    .min(REVIEW_MIN_LENGTH, `A avaliação deve ter pelo menos ${REVIEW_MIN_LENGTH} caracteres`)
    .max(REVIEW_MAX_LENGTH, `A avaliação deve ter no máximo ${REVIEW_MAX_LENGTH} caracteres`),
  author_name: nonEmpty('Nome'),
  author_email: email,
  author_country: z.string().length(2).toUpperCase().optional(),
  order_id: z.string().max(100).optional(),
  locale: locale.optional(),
})
export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>

// ─── Public Question Submission ───────────────────────────────────────────────

export const SubmitQuestionSchema = z.object({
  body: z.string()
    .min(QUESTION_MIN_LENGTH, `A pergunta deve ter pelo menos ${QUESTION_MIN_LENGTH} caracteres`)
    .max(QUESTION_MAX_LENGTH),
  author_name: nonEmpty('Nome'),
  author_email: email,
})
export type SubmitQuestionInput = z.infer<typeof SubmitQuestionSchema>

// ─── Review Moderation ────────────────────────────────────────────────────────

export const ModerateReviewSchema = z.object({
  status: z.nativeEnum(ReviewStatus),
  reason: z.string().max(500).optional(),
  notify_author: z.boolean().default(false),
})
export type ModerateReviewInput = z.infer<typeof ModerateReviewSchema>

export const EditReviewSchema = z.object({
  rating: rating.optional(),
  title: z.string().max(REVIEW_TITLE_MAX_LENGTH).optional(),
  body: z.string().min(REVIEW_MIN_LENGTH).max(REVIEW_MAX_LENGTH).optional(),
  is_verified_purchase: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, 'At least one field must be provided')
export type EditReviewInput = z.infer<typeof EditReviewSchema>

// ─── Reply ───────────────────────────────────────────────────────────────────

export const CreateReplySchema = z.object({
  body: z.string()
    .min(1, 'Resposta não pode ser vazia')
    .max(REPLY_MAX_LENGTH, `Resposta deve ter no máximo ${REPLY_MAX_LENGTH} caracteres`),
  author_name: z.string().max(120).optional(),
})
export type CreateReplyInput = z.infer<typeof CreateReplySchema>

export const UpdateReplySchema = z.object({
  body: z.string().min(1).max(REPLY_MAX_LENGTH),
})
export type UpdateReplyInput = z.infer<typeof UpdateReplySchema>

// ─── Questions ───────────────────────────────────────────────────────────────

export const AnswerQuestionSchema = z.object({
  answer: z.string().min(1).max(QUESTION_MAX_LENGTH),
})
export type AnswerQuestionInput = z.infer<typeof AnswerQuestionSchema>

// ─── Workspace ───────────────────────────────────────────────────────────────

export const CreateWorkspaceSchema = z.object({
  name: nonEmpty('Nome'),
  slug: z.string()
    .min(2).max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  domain: z.string().max(253).optional(),
})
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>

export const UpdateWorkspaceSchema = z.object({
  name: nonEmpty('Nome').optional(),
  logo_url: url.nullable().optional(),
  settings: z.object({
    brand_color: hexColor.optional(),
    brand_voice_md: z.string().max(10000).nullable().optional(),
    auto_approve_threshold: z.number().int().min(0).max(100).default(DEFAULT_AUTO_APPROVE_THRESHOLD).optional(),
    auto_reject_threshold: z.number().int().min(0).max(100).default(DEFAULT_AUTO_REJECT_THRESHOLD).optional(),
    require_media: z.boolean().optional(),
    moderate_with_ai: z.boolean().optional(),
    default_locale: locale.optional(),
    timezone: z.string().max(50).optional(),
    notify_new_review: z.boolean().optional(),
    notify_email: email.nullable().optional(),
  }).optional(),
})
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>

// ─── Team ────────────────────────────────────────────────────────────────────

export const InviteMemberSchema = z.object({
  email: email,
  role: z.nativeEnum(UserRole).exclude([UserRole.Owner]),
})
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>

export const UpdateMemberRoleSchema = z.object({
  role: z.nativeEnum(UserRole).exclude([UserRole.Owner]),
})
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>

// ─── API Keys ────────────────────────────────────────────────────────────────

export const CreateApiKeySchema = z.object({
  name: nonEmpty('Nome da chave'),
  scopes: z.array(z.string()).min(1, 'Selecione pelo menos um escopo'),
  expires_at: z.string().datetime().nullable().optional(),
})
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>

// ─── Products ────────────────────────────────────────────────────────────────

export const UpsertProductSchema = z.object({
  external_id: nonEmpty('ID externo'),
  name: nonEmpty('Nome do produto'),
  description: z.string().max(5000).nullable().optional(),
  image_url: url.nullable().optional(),
  url: url.nullable().optional(),
  sku: z.string().max(100).nullable().optional(),
  price: z.number().positive().nullable().optional(),
  currency: z.string().length(3).toUpperCase().nullable().optional(),
})
export type UpsertProductInput = z.infer<typeof UpsertProductSchema>

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const CreateCampaignSchema = z.object({
  name: nonEmpty('Nome'),
  type: z.nativeEnum(CampaignType),
  subject: nonEmpty('Assunto').max(200),
  body_html: z.string().min(1).max(100000),
  from_name: nonEmpty('Nome do remetente').max(80),
  from_email: email,
  reply_to: email.nullable().optional(),
  delay_days: z.number().int().min(0).max(365).default(3),
  product_id: z.string().uuid().nullable().optional(),
  segment: z.object({
    min_order_value: z.number().positive().nullable().optional(),
    max_order_value: z.number().positive().nullable().optional(),
    product_ids: z.array(z.string().uuid()).optional(),
    has_reviewed: z.boolean().nullable().optional(),
    locale: locale.nullable().optional(),
  }).optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
})
export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>

export const UpdateCampaignSchema = CreateCampaignSchema.partial()
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>

// ─── Rewards ─────────────────────────────────────────────────────────────────

export const CreateRewardRuleSchema = z.object({
  name: nonEmpty('Nome'),
  description: z.string().max(500).nullable().optional(),
  type: z.nativeEnum(RewardType),
  value: z.number().positive('Valor deve ser positivo'),
  currency: z.string().length(3).toUpperCase().nullable().optional(),
  code_prefix: z.string().max(10).regex(/^[A-Z0-9]*$/).nullable().optional(),
  min_rating: rating.default(4),
  require_media: z.boolean().default(false),
  require_verified: z.boolean().default(false),
  max_grants_per_customer: z.number().int().min(1).max(100).default(1),
  total_budget: z.number().positive().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
})
export type CreateRewardRuleInput = z.infer<typeof CreateRewardRuleSchema>

// ─── Imports ─────────────────────────────────────────────────────────────────

export const CreateImportSchema = z.object({
  source: z.nativeEnum(ImportSource),
  file_name: z.string().max(255),
  file_url: url,
})
export type CreateImportInput = z.infer<typeof CreateImportSchema>

// ─── WooCommerce ─────────────────────────────────────────────────────────────

export const WooCommerceConfigSchema = z.object({
  site_url: url,
  consumer_key: nonEmpty('Consumer Key').startsWith('ck_'),
  consumer_secret: nonEmpty('Consumer Secret').startsWith('cs_'),
  sync_direction: z.enum(['push', 'pull', 'bidirectional']).default('bidirectional'),
  auto_approve_woo_reviews: z.boolean().default(false),
  import_ratings_as_reviews: z.boolean().default(true),
})
export type WooCommerceConfigInput = z.infer<typeof WooCommerceConfigSchema>

// ─── Pagination Query ─────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page,
  per_page: perPage,
})
export type PaginationInput = z.infer<typeof PaginationSchema>

export const ReviewsQuerySchema = PaginationSchema.extend({
  status: z.nativeEnum(ReviewStatus).optional(),
  source: z.nativeEnum(ReviewSource).optional(),
  product_id: z.string().uuid().optional(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).optional(),
  is_verified_purchase: z.boolean().optional(),
  with_media: z.boolean().optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(['created_at', 'rating', 'quality_score', 'helpful_count']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
})
export type ReviewsQueryInput = z.infer<typeof ReviewsQuerySchema>

// ─── AI ──────────────────────────────────────────────────────────────────────

export const GenerateVariantsSchema = z.object({
  review_id: z.string().uuid(),
  count: z.number().int().min(1).max(5).default(3),
})
export type GenerateVariantsInput = z.infer<typeof GenerateVariantsSchema>

export const SuggestReplySchema = z.object({
  review_id: z.string().uuid(),
  tone: z.enum(['professional', 'friendly', 'empathetic', 'formal']).default('professional'),
  language: locale.default('pt-BR'),
})
export type SuggestReplyInput = z.infer<typeof SuggestReplySchema>

export const TranslateSchema = z.object({
  review_id: z.string().uuid(),
  target_locale: locale,
})
export type TranslateInput = z.infer<typeof TranslateSchema>

export const BulkSentimentSchema = z.object({
  review_ids: z.array(z.string().uuid()).min(1).max(100),
})
export type BulkSentimentInput = z.infer<typeof BulkSentimentSchema>

// ─── Domains ─────────────────────────────────────────────────────────────────

export const AddDomainSchema = z.object({
  domain: z.string()
    .min(3).max(253)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/, 'Domínio inválido'),
})
export type AddDomainInput = z.infer<typeof AddDomainSchema>

// ─── Media Upload ─────────────────────────────────────────────────────────────

export const MediaUploadSchema = z.object({
  review_id: z.string().uuid(),
  files: z.array(z.object({
    name: z.string().max(255),
    size: z.number().int().positive().max(MAX_MEDIA_PER_REVIEW * 1024 * 1024 * 25),
    type: z.string(),
  })).min(1).max(MAX_MEDIA_PER_REVIEW),
})
export type MediaUploadInput = z.infer<typeof MediaUploadSchema>

// ─── Billing ─────────────────────────────────────────────────────────────────

export const ChangePlanSchema = z.object({
  plan: z.nativeEnum(BillingPlan),
  billing_period: z.enum(['monthly', 'annual']).default('monthly'),
})
export type ChangePlanInput = z.infer<typeof ChangePlanSchema>

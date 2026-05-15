import { ReviewStatus, ReviewSource, UserRole, BillingPlan, AiJobType } from './types'

// ─── Review Status ───────────────────────────────────────────────────────────

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  [ReviewStatus.Pending]: 'Pendente',
  [ReviewStatus.Approved]: 'Aprovada',
  [ReviewStatus.Rejected]: 'Rejeitada',
  [ReviewStatus.NeedsEdit]: 'Precisa de edição',
}

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, { bg: string; text: string; border: string }> = {
  [ReviewStatus.Pending]: { bg: '#fff8e6', text: '#92600a', border: '#f5d78e' },
  [ReviewStatus.Approved]: { bg: '#edf7f1', text: '#1a6b3a', border: '#a3d9b6' },
  [ReviewStatus.Rejected]: { bg: '#fdf0f0', text: '#8b1a1a', border: '#f5b8b8' },
  [ReviewStatus.NeedsEdit]: { bg: '#f0f0ff', text: '#3a3a9b', border: '#b8b8f5' },
}

// ─── Review Source ───────────────────────────────────────────────────────────

export const REVIEW_SOURCE_LABELS: Record<ReviewSource, string> = {
  [ReviewSource.Widget]: 'Widget',
  [ReviewSource.Email]: 'E-mail',
  [ReviewSource.Import]: 'Importação',
  [ReviewSource.Api]: 'API',
  [ReviewSource.WooCommerce]: 'WooCommerce',
  [ReviewSource.Manual]: 'Manual',
}

export const REVIEW_SOURCE_ICONS: Record<ReviewSource, string> = {
  [ReviewSource.Widget]: '🖼️',
  [ReviewSource.Email]: '📧',
  [ReviewSource.Import]: '📥',
  [ReviewSource.Api]: '⚡',
  [ReviewSource.WooCommerce]: '🛒',
  [ReviewSource.Manual]: '✏️',
}

// ─── User Roles ──────────────────────────────────────────────────────────────

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Owner]: 'Proprietário',
  [UserRole.Admin]: 'Administrador',
  [UserRole.Editor]: 'Editor',
  [UserRole.Viewer]: 'Visualizador',
}

export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.Owner]: 'Acesso total, incluindo billing e exclusão da conta.',
  [UserRole.Admin]: 'Acesso total exceto billing e transferência de propriedade.',
  [UserRole.Editor]: 'Pode moderar reviews, responder e criar campanhas.',
  [UserRole.Viewer]: 'Acesso somente leitura ao dashboard.',
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.Owner]: [
    'reviews.*', 'products.*', 'campaigns.*', 'team.*',
    'billing.*', 'settings.*', 'api_keys.*', 'imports.*', 'audit.*',
  ],
  [UserRole.Admin]: [
    'reviews.*', 'products.*', 'campaigns.*', 'team.invite', 'team.remove',
    'settings.*', 'api_keys.*', 'imports.*', 'audit.read',
  ],
  [UserRole.Editor]: [
    'reviews.read', 'reviews.approve', 'reviews.reject', 'reviews.reply', 'reviews.edit',
    'products.read', 'campaigns.read', 'campaigns.create', 'campaigns.send',
    'imports.read', 'imports.create',
  ],
  [UserRole.Viewer]: [
    'reviews.read', 'products.read', 'campaigns.read', 'imports.read',
  ],
}

// ─── Plan Limits ─────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<BillingPlan, {
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
}> = {
  [BillingPlan.Starter]: {
    reviews_per_month: 500,
    products: 50,
    team_members: 2,
    campaigns_per_month: 3,
    ai_jobs_per_month: 200,
    storage_gb: 2,
    custom_domain: false,
    api_access: false,
    priority_support: false,
    white_label: false,
  },
  [BillingPlan.Pro]: {
    reviews_per_month: 5000,
    products: 500,
    team_members: 10,
    campaigns_per_month: 20,
    ai_jobs_per_month: 2000,
    storage_gb: 20,
    custom_domain: true,
    api_access: true,
    priority_support: false,
    white_label: false,
  },
  [BillingPlan.Enterprise]: {
    reviews_per_month: -1, // unlimited
    products: -1,
    team_members: -1,
    campaigns_per_month: -1,
    ai_jobs_per_month: -1,
    storage_gb: 200,
    custom_domain: true,
    api_access: true,
    priority_support: true,
    white_label: true,
  },
}

export const PLAN_PRICES_USD: Record<BillingPlan, { month: number; year: number }> = {
  [BillingPlan.Starter]: { month: 9, year: 79 },
  [BillingPlan.Pro]: { month: 29, year: 249 },
  [BillingPlan.Enterprise]: { month: 99, year: 890 },
}

// ─── AI Models ───────────────────────────────────────────────────────────────

export const AI_MODEL_NAMES: Record<string, string> = {
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
  'claude-opus-4-5': 'Claude Opus 4',
  'claude-sonnet-4-5': 'Claude Sonnet 4',
}

export const AI_JOB_TYPE_LABELS: Record<AiJobType, string> = {
  [AiJobType.Moderate]: 'Moderação',
  [AiJobType.GenerateVariants]: 'Gerar variantes',
  [AiJobType.SuggestReply]: 'Sugerir resposta',
  [AiJobType.Dedup]: 'Deduplicação',
  [AiJobType.Sentiment]: 'Análise de sentimento',
  [AiJobType.Translate]: 'Tradução',
}

// ─── Miscellaneous ───────────────────────────────────────────────────────────

export const DEFAULT_LOCALE = 'pt-BR'
export const DEFAULT_THEME_COLOR = '#d4a850'
export const DEFAULT_AUTO_APPROVE_THRESHOLD = 70
export const DEFAULT_AUTO_REJECT_THRESHOLD = 30
export const REVIEW_MIN_LENGTH = 10
export const REVIEW_MAX_LENGTH = 5000
export const REVIEW_TITLE_MAX_LENGTH = 120
export const QUESTION_MIN_LENGTH = 5
export const QUESTION_MAX_LENGTH = 1000
export const REPLY_MAX_LENGTH = 2000
export const MAX_MEDIA_PER_REVIEW = 8
export const MAX_MEDIA_SIZE_MB = 25
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
export const SUPPORTED_LOCALES = ['pt-BR', 'en-US', 'es-AR'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

export const FLAGGED_ISSUE_LABELS: Record<string, string> = {
  promotional_language: 'Linguagem promocional',
  pii_detected: 'Dados pessoais detectados',
  competitor_mention: 'Menção a concorrente',
  profanity: 'Linguagem inadequada',
  too_short: 'Muito curto',
  all_caps: 'Tudo em maiúsculas',
  repeated_content: 'Conteúdo repetido',
  suspicious_pattern: 'Padrão suspeito',
  external_links: 'Links externos',
  phone_number: 'Número de telefone',
  email_address: 'Endereço de e-mail',
}

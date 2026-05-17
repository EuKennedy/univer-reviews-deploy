// UniverReviews Widget — Vanilla Web Component
// Custom element: <univer-reviews>
// Light-first, zero dependencies, Shadow DOM isolated.

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReviewMedia {
  type: 'image' | 'video'
  url: string
  thumb_url: string
}

interface Reply {
  body: string
  author_name: string
  created_at: string
}

interface Review {
  id: string
  rating: number
  title: string | null
  body: string
  author_name: string
  author_country: string | null
  is_verified_purchase: boolean
  is_featured: boolean
  helpful_count: number
  unhelpful_count: number
  language: string
  created_at: string
  media: ReviewMedia[]
  replies: Reply[]
}

interface ReviewSummary {
  product_id: string
  total_reviews: number
  avg_rating: number
  rating_distribution: { rating: number; count: number; percentage: number }[]
}

interface Question {
  id: string
  body: string
  answer?: string | null
  author_name: string | null
  helpful_count: number
  created_at: string
}

type Layout = 'default' | 'compact' | 'grid' | 'carousel'
type SortMode = 'created_at' | 'helpful' | 'rating' | 'oldest'
type RatingFilter = 0 | 1 | 2 | 3 | 4 | 5
type MediaFilter = 'all' | 'with_photo' | 'with_video' | 'verified'

// ─── i18n ────────────────────────────────────────────────────────────────────

const i18n: Record<string, Record<string, string>> = {
  'pt-BR': {
    reviews: 'Avaliações',
    qa: 'Perguntas',
    write_review: 'ESCREVER UM COMENTÁRIO',
    ask_question: 'Fazer Pergunta',
    no_reviews: 'Nenhuma avaliação ainda. Seja o primeiro!',
    no_questions: 'Nenhuma pergunta ainda.',
    loading: 'Carregando…',
    error: 'Não foi possível carregar as avaliações.',
    verified: 'Compra verificada',
    helpful_q: 'Isso é útil?',
    previous: 'Anterior',
    next: 'Próxima',
    your_name: 'Seu nome',
    your_email: 'Seu e-mail',
    review_title_ph: 'Título (opcional)',
    review_body_ph: 'Conte sua experiência…',
    submit: 'Enviar avaliação',
    cancel: 'Cancelar',
    question_ph: 'Sua pergunta',
    sending: 'Enviando…',
    thank_review: 'Obrigado! Sua avaliação foi enviada e está em moderação.',
    thank_question: 'Obrigado! Sua pergunta foi enviada.',
    select_rating: 'Selecione uma nota',
    name_required: 'Informe seu nome',
    email_required: 'E-mail inválido',
    rating_required: 'Escolha uma nota',
    body_required: 'Escreva pelo menos 10 caracteres',
    store_reply: 'Resposta da loja',
    showing: 'Mostrando',
    of: 'de',
    all_filter: 'Todas',
    with_photo: 'Com foto',
    with_video: 'Com vídeo',
    verified_filter: 'Verificadas',
    star_filter: 'estrelas',
    sort_recent: 'Mais recentes',
    sort_oldest: 'Mais antigas',
    sort_helpful: 'Mais úteis',
    sort_rating_high: 'Maior nota',
    sort_rating_low: 'Menor nota',
    months_ago: 'meses atrás',
    month_ago: 'mês atrás',
    days_ago: 'dias atrás',
    day_ago: 'dia atrás',
    hours_ago: 'horas atrás',
    hour_ago: 'hora atrás',
    just_now: 'agora',
    years_ago: 'anos atrás',
    year_ago: 'ano atrás',
  },
  'en-US': {
    reviews: 'Reviews',
    qa: 'Q&A',
    write_review: 'WRITE A REVIEW',
    ask_question: 'Ask a Question',
    no_reviews: 'No reviews yet. Be the first!',
    no_questions: 'No questions yet.',
    loading: 'Loading…',
    error: 'Could not load reviews.',
    verified: 'Verified Purchase',
    helpful_q: 'Was this helpful?',
    previous: 'Previous',
    next: 'Next',
    your_name: 'Your name',
    your_email: 'Your email',
    review_title_ph: 'Title (optional)',
    review_body_ph: 'Share your experience…',
    submit: 'Submit review',
    cancel: 'Cancel',
    question_ph: 'Your question',
    sending: 'Sending…',
    thank_review: 'Thank you! Your review was submitted and is in moderation.',
    thank_question: 'Thank you! Your question was submitted.',
    select_rating: 'Select a rating',
    name_required: 'Name required',
    email_required: 'Invalid email',
    rating_required: 'Please pick a rating',
    body_required: 'Write at least 10 characters',
    store_reply: 'Store reply',
    showing: 'Showing',
    of: 'of',
    all_filter: 'All',
    with_photo: 'With photo',
    with_video: 'With video',
    verified_filter: 'Verified',
    star_filter: 'stars',
    sort_recent: 'Newest',
    sort_oldest: 'Oldest',
    sort_helpful: 'Most helpful',
    sort_rating_high: 'Highest rating',
    sort_rating_low: 'Lowest rating',
    months_ago: 'months ago',
    month_ago: 'month ago',
    days_ago: 'days ago',
    day_ago: 'day ago',
    hours_ago: 'hours ago',
    hour_ago: 'hour ago',
    just_now: 'just now',
    years_ago: 'years ago',
    year_ago: 'year ago',
  },
}

// ─── Utilities ───────────────────────────────────────────────────────────────

// Deterministic colorful avatar background from author name.
const AVATAR_PALETTE = [
  '#7c3aed', '#2563eb', '#0891b2', '#059669', '#16a34a',
  '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#9333ea',
  '#0284c7', '#65a30d', '#d97706', '#e11d48',
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function initialOf(name: string): string {
  return (name?.trim()[0] || '?').toUpperCase()
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function relativeTime(iso: string, locale: string): string {
  const t = i18n[locale] || i18n['pt-BR']
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const sec = Math.floor((Date.now() - then) / 1000)
  if (sec < 60) return t.just_now
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ${hr === 1 ? t.hour_ago : t.hours_ago}`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} ${day === 1 ? t.day_ago : t.days_ago}`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} ${mo === 1 ? t.month_ago : t.months_ago}`
  const yr = Math.floor(mo / 12)
  return `${yr} ${yr === 1 ? t.year_ago : t.years_ago}`
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const buildCSS = (themeColor: string): string => `
:host {
  --ur-bg: #ffffff;
  --ur-surface: #ffffff;
  --ur-surface-soft: #fafafa;
  --ur-text: #111827;
  --ur-text-soft: #6b7280;
  --ur-text-muted: #9ca3af;
  --ur-border: #e5e7eb;
  --ur-border-soft: #f3f4f6;
  --ur-star: #fbbf24;
  --ur-star-empty: #e5e7eb;
  --ur-verified: #16a34a;
  --ur-accent: ${themeColor};
  --ur-accent-soft: ${themeColor}1A;
  --ur-danger: #dc2626;

  display: block;
  color: var(--ur-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  font-size: 15px;
  line-height: 1.55;
  background: var(--ur-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* { box-sizing: border-box; }
button { font-family: inherit; cursor: pointer; }

.ur-root { max-width: 1280px; margin: 0 auto; padding: 24px 16px; }

/* ── Summary header ───────────────────────────────────────────────────────── */
.ur-summary {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr auto;
  gap: 32px;
  align-items: center;
  padding: 8px 0 24px;
  border-bottom: 1px solid var(--ur-border-soft);
}

.ur-hero { display: flex; flex-direction: column; gap: 4px; }
.ur-hero-rating {
  font-size: 48px; font-weight: 700; line-height: 1; color: var(--ur-text);
  letter-spacing: -0.02em;
}
.ur-hero-stars { display: flex; gap: 2px; margin-top: 4px; }
.ur-hero-count { font-size: 14px; color: var(--ur-text-soft); margin-top: 4px; }

.ur-dist { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ur-dist-row {
  display: grid;
  grid-template-columns: 24px 1fr 36px;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--ur-text-soft);
  transition: opacity 0.15s;
}
.ur-dist-row:hover { opacity: 0.85; }
.ur-dist-row.active { font-weight: 600; color: var(--ur-text); }
.ur-dist-label { display: flex; align-items: center; gap: 4px; }
.ur-dist-star { color: var(--ur-star); font-size: 12px; }
.ur-dist-bar {
  height: 8px; background: var(--ur-border-soft); border-radius: 999px;
  overflow: hidden; position: relative;
}
.ur-dist-fill {
  position: absolute; inset: 0 auto 0 0; background: var(--ur-star);
  border-radius: 999px; transition: width 0.4s ease;
}
.ur-dist-count { font-variant-numeric: tabular-nums; text-align: right; }

.ur-write-btn {
  background: var(--ur-accent);
  color: #fff;
  border: none;
  padding: 14px 28px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
  transition: transform 0.1s, filter 0.15s;
}
.ur-write-btn:hover { filter: brightness(1.05); }
.ur-write-btn:active { transform: translateY(1px); }

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.ur-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--ur-border-soft);
}
.ur-showing { font-size: 13px; color: var(--ur-text-soft); }
.ur-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.ur-chip {
  border: 1px solid var(--ur-border);
  background: var(--ur-surface);
  color: var(--ur-text-soft);
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
}
.ur-chip:hover { border-color: var(--ur-text-muted); color: var(--ur-text); }
.ur-chip.active {
  background: var(--ur-accent-soft);
  border-color: var(--ur-accent);
  color: var(--ur-accent);
  font-weight: 600;
}

.ur-select {
  border: 1px solid var(--ur-border);
  background: var(--ur-surface);
  color: var(--ur-text);
  padding: 6px 30px 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
.ur-tabs {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid var(--ur-border-soft);
  margin-top: 8px;
}
.ur-tab {
  background: none;
  border: none;
  padding: 14px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ur-text-soft);
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.ur-tab:hover { color: var(--ur-text); }
.ur-tab.active {
  color: var(--ur-text);
  border-bottom-color: var(--ur-accent);
}

/* ── Review list layouts ──────────────────────────────────────────────────── */
.ur-list { padding: 20px 0; }
.ur-list.layout-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.ur-list.layout-default { display: flex; flex-direction: column; gap: 12px; }
.ur-list.layout-compact { display: flex; flex-direction: column; gap: 0; }
.ur-list.layout-carousel {
  display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px;
  scroll-snap-type: x mandatory;
}
.ur-list.layout-carousel .ur-card {
  min-width: 320px; max-width: 320px; flex-shrink: 0; scroll-snap-align: start;
}
.ur-list.layout-grid .ur-card-body { -webkit-line-clamp: 4; }

/* ── Card ─────────────────────────────────────────────────────────────────── */
.ur-card {
  background: var(--ur-surface);
  border: 1px solid var(--ur-border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ur-card:hover { border-color: var(--ur-text-muted); }

.ur-list.layout-compact .ur-card {
  border-radius: 0; border-width: 0 0 1px 0; padding: 16px 0; gap: 8px;
}
.ur-list.layout-compact .ur-card:hover { border-color: var(--ur-border); }

.ur-card-head {
  display: flex; align-items: center; gap: 10px;
}
.ur-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; font-size: 13px; flex-shrink: 0;
}
.ur-author {
  display: flex; flex-direction: column; min-width: 0; flex: 1;
}
.ur-author-line {
  display: flex; align-items: center; gap: 6px; font-size: 14px;
  font-weight: 600; color: var(--ur-text);
}
.ur-verified-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%; background: var(--ur-verified);
  color: #fff; font-size: 9px; flex-shrink: 0;
}
.ur-time { font-size: 12px; color: var(--ur-text-muted); }
.ur-country { font-size: 14px; line-height: 1; }

.ur-card-stars { display: flex; gap: 2px; }
.ur-card-title {
  font-size: 14px; font-weight: 600; color: var(--ur-text); margin: 0;
}
.ur-card-body {
  font-size: 14px; color: var(--ur-text); margin: 0;
  display: -webkit-box; -webkit-box-orient: vertical;
  -webkit-line-clamp: 6; overflow: hidden; word-break: break-word;
}

.ur-media-row { display: flex; gap: 6px; flex-wrap: wrap; }
.ur-media-thumb {
  width: 56px; height: 56px; border-radius: 6px; object-fit: cover;
  border: 1px solid var(--ur-border); cursor: pointer; position: relative;
}
.ur-media-thumb.video::after {
  content: '▶'; position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4); color: #fff; border-radius: 6px;
}

.ur-reply {
  background: var(--ur-surface-soft);
  border-left: 3px solid var(--ur-accent);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--ur-text);
}
.ur-reply-label {
  font-size: 11px; font-weight: 700; color: var(--ur-accent);
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
}

.ur-card-foot {
  display: flex; align-items: center; gap: 12px;
  padding-top: 6px; margin-top: 4px; border-top: 1px solid var(--ur-border-soft);
}
.ur-foot-label { font-size: 12px; color: var(--ur-text-soft); margin-right: auto; }
.ur-helpful {
  display: inline-flex; align-items: center; gap: 4px;
  background: transparent; border: 1px solid var(--ur-border);
  padding: 4px 10px; border-radius: 999px; font-size: 12px;
  color: var(--ur-text-soft); transition: all 0.15s;
}
.ur-helpful:hover { background: var(--ur-surface-soft); color: var(--ur-text); }
.ur-helpful.voted { background: var(--ur-accent-soft); color: var(--ur-accent); border-color: var(--ur-accent); }

/* ── Stars ────────────────────────────────────────────────────────────────── */
.ur-star { color: var(--ur-star); font-size: 14px; line-height: 1; }
.ur-star.empty { color: var(--ur-star-empty); }
.ur-hero-stars .ur-star { font-size: 22px; }

/* ── Pagination ───────────────────────────────────────────────────────────── */
.ur-pagination {
  display: flex; justify-content: center; align-items: center;
  gap: 6px; padding: 24px 0;
}
.ur-page-btn {
  background: var(--ur-surface);
  border: 1px solid var(--ur-border);
  color: var(--ur-text);
  min-width: 36px; height: 36px; padding: 0 10px;
  border-radius: 8px; font-size: 13px; font-weight: 500;
  transition: all 0.15s;
}
.ur-page-btn:hover:not(:disabled) { border-color: var(--ur-text-muted); }
.ur-page-btn.active {
  background: var(--ur-accent); color: #fff; border-color: var(--ur-accent);
}
.ur-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Empty / loading ──────────────────────────────────────────────────────── */
.ur-empty, .ur-loading {
  text-align: center; padding: 60px 16px; color: var(--ur-text-soft); font-size: 14px;
}
.ur-spinner {
  width: 24px; height: 24px; margin: 0 auto 12px;
  border: 2.5px solid var(--ur-border); border-top-color: var(--ur-accent);
  border-radius: 50%; animation: ur-spin 0.7s linear infinite;
}
@keyframes ur-spin { to { transform: rotate(360deg); } }

/* ── Form ─────────────────────────────────────────────────────────────────── */
.ur-form-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; padding: 16px;
  z-index: 9999; animation: ur-fade 0.2s;
}
@keyframes ur-fade { from { opacity: 0; } to { opacity: 1; } }
.ur-form {
  background: var(--ur-surface); border-radius: 12px; padding: 24px;
  max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.ur-form-title {
  margin: 0 0 16px; font-size: 18px; font-weight: 700; color: var(--ur-text);
}
.ur-field { margin-bottom: 14px; }
.ur-label {
  display: block; font-size: 12px; font-weight: 600; color: var(--ur-text-soft);
  margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em;
}
.ur-input, .ur-textarea {
  width: 100%; padding: 10px 12px; border: 1px solid var(--ur-border);
  border-radius: 8px; font-size: 14px; color: var(--ur-text);
  background: var(--ur-surface); font-family: inherit;
}
.ur-input:focus, .ur-textarea:focus {
  outline: none; border-color: var(--ur-accent);
  box-shadow: 0 0 0 3px var(--ur-accent-soft);
}
.ur-textarea { min-height: 100px; resize: vertical; }

.ur-rating-picker { display: flex; gap: 4px; margin-bottom: 6px; }
.ur-rating-picker button {
  background: none; border: none; padding: 4px; font-size: 28px;
  color: var(--ur-star-empty); transition: color 0.1s;
}
.ur-rating-picker button.lit { color: var(--ur-star); }

.ur-form-error { color: var(--ur-danger); font-size: 12px; margin-top: -8px; margin-bottom: 12px; }
.ur-form-success {
  background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;
  padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 12px;
}

.ur-form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.ur-btn {
  padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;
  border: 1px solid var(--ur-border); background: var(--ur-surface); color: var(--ur-text);
  transition: all 0.15s;
}
.ur-btn:hover { background: var(--ur-surface-soft); }
.ur-btn.primary { background: var(--ur-accent); color: #fff; border-color: var(--ur-accent); }
.ur-btn.primary:hover { filter: brightness(1.05); }
.ur-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Lightbox ─────────────────────────────────────────────────────────────── */
.ur-lightbox {
  position: fixed; inset: 0; background: rgba(0,0,0,0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 99999; cursor: zoom-out;
}
.ur-lightbox img, .ur-lightbox video {
  max-width: 90%; max-height: 90%; border-radius: 4px;
}

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .ur-summary {
    grid-template-columns: 1fr; gap: 20px; text-align: left;
  }
  .ur-hero { align-items: flex-start; }
  .ur-write-btn { width: 100%; }
  .ur-list.layout-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
}
@media (max-width: 480px) {
  .ur-list.layout-grid { grid-template-columns: 1fr; }
  .ur-toolbar { flex-direction: column; align-items: flex-start; }
}
`

// ─── Component ───────────────────────────────────────────────────────────────

interface VoteState { [reviewId: string]: 'helpful' | 'unhelpful' | undefined }

class UniverReviewsWidget extends HTMLElement {
  private shadow: ShadowRoot
  private workspaceId = ''
  private productId = ''
  private apiUrl = 'https://api.univerreviews.com'
  private layout: Layout = 'default'
  private locale = 'pt-BR'
  private themeColor = '#d4a850'
  private showQa = true
  private showWriteReview = true

  private reviews: Review[] = []
  private summary: ReviewSummary | null = null

  private currentPage = 1
  private totalPages = 1
  private totalCount = 0
  private perPage = 10

  private ratingFilter: RatingFilter = 0
  private mediaFilter: MediaFilter = 'all'
  private sortMode: SortMode = 'created_at'

  private loading = true
  private votes: VoteState = {}

  private showReviewForm = false
  private formSuccess: string | null = null

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  static get observedAttributes(): string[] {
    return [
      'workspace-id', 'product-id', 'api-url', 'layout', 'locale',
      'theme-color', 'show-qa', 'show-write-review', 'per-page',
    ]
  }

  connectedCallback() {
    this.readAttrs()
    this.loadVotes()
    void this.fetchAll()
  }

  attributeChangedCallback() {
    this.readAttrs()
    this.render()
  }

  private readAttrs() {
    this.workspaceId    = this.getAttribute('workspace-id') || ''
    this.productId      = this.getAttribute('product-id') || ''
    this.apiUrl         = this.getAttribute('api-url') || this.apiUrl
    this.layout         = (this.getAttribute('layout') as Layout) || 'default'
    this.locale         = this.getAttribute('locale') || 'pt-BR'
    this.themeColor     = this.getAttribute('theme-color') || '#d4a850'
    this.showQa         = this.getAttribute('show-qa') !== 'false'
    this.showWriteReview = this.getAttribute('show-write-review') !== 'false'
    const pp = parseInt(this.getAttribute('per-page') || '', 10)
    if (pp > 0 && pp <= 100) this.perPage = pp
  }

  private t(key: string): string {
    return i18n[this.locale]?.[key] ?? i18n['pt-BR'][key] ?? key
  }

  // ─── Vote persistence (localStorage) ─────────────────────────────────────
  private voteStorageKey() { return `ur-votes-${this.productId}` }

  private loadVotes() {
    try {
      const raw = localStorage.getItem(this.voteStorageKey())
      if (raw) this.votes = JSON.parse(raw)
    } catch { /* ignore */ }
  }

  private saveVotes() {
    try {
      localStorage.setItem(this.voteStorageKey(), JSON.stringify(this.votes))
    } catch { /* ignore */ }
  }

  // ─── Data fetching ──────────────────────────────────────────────────────
  private async fetchAll() {
    if (!this.productId) {
      this.loading = false
      this.render()
      return
    }
    this.loading = true
    this.render()
    try {
      await Promise.all([this.fetchSummary(), this.fetchReviews()])
    } catch (e) {
      console.warn('[univer-reviews]', e instanceof Error ? e.message : 'unknown')
    }
    this.loading = false
    this.render()
  }

  private async fetchSummary() {
    const r = await fetch(`${this.apiUrl}/api/v1/public/summary/${this.productId}`, {
      headers: { 'X-Univer-Domain': window.location.hostname },
    })
    if (!r.ok) return
    const json = await r.json()
    this.summary = json.data
  }

  private async fetchReviews() {
    const params = new URLSearchParams({
      page: String(this.currentPage),
      per_page: String(this.perPage),
      sort: this.sortMode,
    })
    if (this.ratingFilter > 0) params.set('rating', String(this.ratingFilter))
    if (this.mediaFilter === 'with_photo') params.set('with_photo', 'true')
    if (this.mediaFilter === 'with_video') params.set('with_video', 'true')
    if (this.mediaFilter === 'verified') params.set('verified', 'true')

    const r = await fetch(
      `${this.apiUrl}/api/v1/public/reviews/${this.productId}?${params}`,
      { headers: { 'X-Univer-Domain': window.location.hostname } }
    )
    if (!r.ok) {
      console.warn('[univer-reviews] HTTP', r.status)
      return
    }
    const json = await r.json()
    this.reviews = json.data || []
    this.totalPages = json.meta?.total_pages || 1
    this.totalCount = json.meta?.total_count || 0
  }

  private async refresh() {
    this.loading = true
    this.render()
    try { await this.fetchReviews() }
    catch (e) { this.error = e instanceof Error ? e.message : 'unknown' }
    this.loading = false
    this.render()
  }

  private async voteHelpful(reviewId: string, kind: 'helpful' | 'unhelpful') {
    const prev = this.votes[reviewId]
    // Toggle off if same vote
    if (prev === kind) {
      delete this.votes[reviewId]
      this.saveVotes()
      await fetch(`${this.apiUrl}/api/v1/public/reviews/${reviewId}/${kind}?undo=true`, {
        method: 'POST',
        headers: { 'X-Univer-Domain': window.location.hostname },
      }).catch(() => null)
      const review = this.reviews.find(r => r.id === reviewId)
      if (review) {
        if (kind === 'helpful') review.helpful_count = Math.max(0, review.helpful_count - 1)
        else review.unhelpful_count = Math.max(0, review.unhelpful_count - 1)
      }
      this.render()
      return
    }
    // If switching, undo previous first
    if (prev) {
      await fetch(`${this.apiUrl}/api/v1/public/reviews/${reviewId}/${prev}?undo=true`, {
        method: 'POST',
        headers: { 'X-Univer-Domain': window.location.hostname },
      }).catch(() => null)
      const review = this.reviews.find(r => r.id === reviewId)
      if (review) {
        if (prev === 'helpful') review.helpful_count = Math.max(0, review.helpful_count - 1)
        else review.unhelpful_count = Math.max(0, review.unhelpful_count - 1)
      }
    }
    this.votes[reviewId] = kind
    this.saveVotes()
    await fetch(`${this.apiUrl}/api/v1/public/reviews/${reviewId}/${kind}`, {
      method: 'POST',
      headers: { 'X-Univer-Domain': window.location.hostname },
    }).catch(() => null)
    const review = this.reviews.find(r => r.id === reviewId)
    if (review) {
      if (kind === 'helpful') review.helpful_count += 1
      else review.unhelpful_count += 1
    }
    this.render()
  }

  // ─── Render entrypoint ──────────────────────────────────────────────────
  private render() {
    this.shadow.innerHTML = `<style>${buildCSS(this.themeColor)}</style>${this.renderRoot()}`
    this.attachEvents()
  }

  private renderRoot(): string {
    if (!this.productId) {
      return `<div class="ur-root"><div class="ur-empty">product-id is required</div></div>`
    }
    if (this.loading && this.reviews.length === 0) {
      return `<div class="ur-root">${this.renderSummary()}${this.renderToolbar()}<div class="ur-loading"><div class="ur-spinner"></div>${this.t('loading')}</div></div>`
    }
    return `
<div class="ur-root">
  ${this.renderSummary()}
  ${this.renderToolbar()}
  ${this.renderList()}
  ${this.totalPages > 1 ? this.renderPagination() : ''}
  ${this.showReviewForm ? this.renderForm() : ''}
</div>`
  }

  // ─── Summary header ──────────────────────────────────────────────────────
  private renderSummary(): string {
    const avg = this.summary?.avg_rating ?? 0
    const total = this.summary?.total_reviews ?? 0
    const dist = this.summary?.rating_distribution ?? [5, 4, 3, 2, 1].map(r => ({ rating: r, count: 0, percentage: 0 }))

    return `
<header class="ur-summary">
  <div class="ur-hero">
    <div class="ur-hero-rating">${Number(avg).toFixed(1)}</div>
    <div class="ur-hero-stars">${this.renderStars(avg)}</div>
    <div class="ur-hero-count">${total} ${this.t('reviews')}</div>
  </div>
  <div class="ur-dist">
    ${[5, 4, 3, 2, 1].map(r => {
      const row = dist.find(d => d.rating === r) || { count: 0, percentage: 0 }
      const active = this.ratingFilter === r
      return `
      <div class="ur-dist-row ${active ? 'active' : ''}" data-rating="${r}">
        <span class="ur-dist-label">${r}<span class="ur-dist-star">★</span></span>
        <span class="ur-dist-bar"><span class="ur-dist-fill" style="width:${row.percentage}%"></span></span>
        <span class="ur-dist-count">${row.count}</span>
      </div>`
    }).join('')}
  </div>
  ${this.showWriteReview ? `<button class="ur-write-btn" data-action="open-form">${this.t('write_review')}</button>` : ''}
</header>`
  }

  // ─── Toolbar ─────────────────────────────────────────────────────────────
  private renderToolbar(): string {
    const start = this.totalCount === 0 ? 0 : (this.currentPage - 1) * this.perPage + 1
    const end = Math.min(this.currentPage * this.perPage, this.totalCount)
    return `
<div class="ur-toolbar">
  <div class="ur-showing">
    ${this.t('showing')} ${start}–${end} ${this.t('of')} ${this.totalCount}
  </div>
  <div class="ur-filters">
    <button class="ur-chip ${this.mediaFilter === 'all' && this.ratingFilter === 0 ? 'active' : ''}" data-media="all">
      ${this.t('all_filter')}
    </button>
    <button class="ur-chip ${this.mediaFilter === 'with_photo' ? 'active' : ''}" data-media="with_photo">
      ${this.t('with_photo')}
    </button>
    <button class="ur-chip ${this.mediaFilter === 'with_video' ? 'active' : ''}" data-media="with_video">
      ${this.t('with_video')}
    </button>
    <button class="ur-chip ${this.mediaFilter === 'verified' ? 'active' : ''}" data-media="verified">
      ${this.t('verified_filter')}
    </button>
    <select class="ur-select" data-action="sort">
      <option value="created_at" ${this.sortMode === 'created_at' ? 'selected' : ''}>${this.t('sort_recent')}</option>
      <option value="oldest" ${this.sortMode === 'oldest' ? 'selected' : ''}>${this.t('sort_oldest')}</option>
      <option value="helpful" ${this.sortMode === 'helpful' ? 'selected' : ''}>${this.t('sort_helpful')}</option>
      <option value="rating" ${this.sortMode === 'rating' ? 'selected' : ''}>${this.t('sort_rating_high')}</option>
    </select>
  </div>
</div>`
  }

  // ─── List ────────────────────────────────────────────────────────────────
  private renderList(): string {
    if (this.reviews.length === 0) {
      return `<div class="ur-empty">${this.t('no_reviews')}</div>`
    }
    return `
<div class="ur-list layout-${this.layout}">
  ${this.reviews.map(r => this.renderCard(r)).join('')}
</div>`
  }

  private renderCard(r: Review): string {
    const name = r.author_name || 'Anônimo'
    const color = avatarColor(name)
    const time = relativeTime(r.created_at, this.locale)
    const userVote = this.votes[r.id]

    return `
<article class="ur-card" data-id="${r.id}">
  <div class="ur-card-head">
    <div class="ur-avatar" style="background:${color}">${initialOf(name)}</div>
    <div class="ur-author">
      <div class="ur-author-line">
        <span>${escapeHtml(name)}</span>
        ${r.is_verified_purchase ? `<span class="ur-verified-badge" title="${this.t('verified')}">✓</span>` : ''}
      </div>
      <span class="ur-time">${time}</span>
    </div>
  </div>
  <div class="ur-card-stars">${this.renderStars(r.rating)}</div>
  ${r.title ? `<h3 class="ur-card-title">${escapeHtml(r.title)}</h3>` : ''}
  <p class="ur-card-body">${escapeHtml(r.body || '')}</p>
  ${r.media.length > 0 ? `
    <div class="ur-media-row">
      ${r.media.map(m => `
        <${m.type === 'video' ? 'div' : 'img'}
          class="ur-media-thumb ${m.type === 'video' ? 'video' : ''}"
          ${m.type === 'image' ? `src="${escapeHtml(m.thumb_url || m.url)}" alt="" loading="lazy"` : `style="background:url('${escapeHtml(m.thumb_url || '')}') center/cover"`}
          data-lightbox="${escapeHtml(m.url)}"
          data-type="${m.type}"
        ${m.type === 'video' ? '></div>' : '/>'}
      `).join('')}
    </div>
  ` : ''}
  ${r.replies && r.replies[0] ? `
    <div class="ur-reply">
      <div class="ur-reply-label">${this.t('store_reply')}</div>
      ${escapeHtml(r.replies[0].body)}
    </div>
  ` : ''}
  <div class="ur-card-foot">
    <span class="ur-foot-label">${this.t('helpful_q')}</span>
    <button class="ur-helpful ${userVote === 'helpful' ? 'voted' : ''}" data-vote="helpful" data-id="${r.id}">
      <span>👍</span><span>${r.helpful_count || 0}</span>
    </button>
    <button class="ur-helpful ${userVote === 'unhelpful' ? 'voted' : ''}" data-vote="unhelpful" data-id="${r.id}">
      <span>👎</span><span>${r.unhelpful_count || 0}</span>
    </button>
  </div>
</article>`
  }

  // ─── Stars ───────────────────────────────────────────────────────────────
  private renderStars(rating: number): string {
    const r = Math.max(0, Math.min(5, Number(rating) || 0))
    const full = Math.round(r)
    let out = ''
    for (let i = 1; i <= 5; i++) {
      out += `<span class="ur-star ${i > full ? 'empty' : ''}">★</span>`
    }
    return out
  }

  // ─── Pagination ──────────────────────────────────────────────────────────
  private renderPagination(): string {
    const pages: (number | '…')[] = []
    const total = this.totalPages
    const cur = this.currentPage
    const push = (p: number | '…') => pages.push(p)

    if (total <= 7) {
      for (let i = 1; i <= total; i++) push(i)
    } else {
      push(1)
      if (cur > 3) push('…')
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) push(i)
      if (cur < total - 2) push('…')
      push(total)
    }

    return `
<nav class="ur-pagination">
  <button class="ur-page-btn" data-page="${cur - 1}" ${cur === 1 ? 'disabled' : ''}>${this.t('previous')}</button>
  ${pages.map(p => p === '…'
    ? `<span class="ur-page-btn" style="border:none;background:none">…</span>`
    : `<button class="ur-page-btn ${p === cur ? 'active' : ''}" data-page="${p}">${p}</button>`
  ).join('')}
  <button class="ur-page-btn" data-page="${cur + 1}" ${cur === total ? 'disabled' : ''}>${this.t('next')}</button>
</nav>`
  }

  // ─── Write review form ──────────────────────────────────────────────────
  private renderForm(): string {
    return `
<div class="ur-form-overlay" data-action="close-form">
  <form class="ur-form" data-action="submit-form" id="ur-form">
    <h3 class="ur-form-title">${this.t('write_review')}</h3>
    ${this.formSuccess ? `<div class="ur-form-success">${this.formSuccess}</div>` : ''}
    <div class="ur-field">
      <label class="ur-label">${this.t('select_rating')}</label>
      <div class="ur-rating-picker" data-picker="rating">
        ${[1, 2, 3, 4, 5].map(i => `<button type="button" data-rating="${i}">★</button>`).join('')}
      </div>
      <input type="hidden" name="rating" value="0" />
    </div>
    <div class="ur-field">
      <label class="ur-label">${this.t('your_name')}</label>
      <input class="ur-input" name="author_name" required />
    </div>
    <div class="ur-field">
      <label class="ur-label">${this.t('your_email')}</label>
      <input class="ur-input" name="author_email" type="email" required />
    </div>
    <div class="ur-field">
      <input class="ur-input" name="title" placeholder="${this.t('review_title_ph')}" />
    </div>
    <div class="ur-field">
      <textarea class="ur-textarea" name="body" placeholder="${this.t('review_body_ph')}" required minlength="10"></textarea>
    </div>
    <div class="ur-form-actions">
      <button type="button" class="ur-btn" data-action="close-form">${this.t('cancel')}</button>
      <button type="submit" class="ur-btn primary">${this.t('submit')}</button>
    </div>
  </form>
</div>`
  }

  // ─── Events ──────────────────────────────────────────────────────────────
  private attachEvents() {
    const root = this.shadow.querySelector('.ur-root')
    if (!root) return

    root.querySelectorAll<HTMLElement>('[data-rating]').forEach(el => {
      // Only the distribution rows in summary — picker handled separately
      if (el.closest('.ur-dist-row')) {
        el.addEventListener('click', () => {
          const r = parseInt(el.dataset.rating || '0', 10) as RatingFilter
          this.ratingFilter = this.ratingFilter === r ? 0 : r
          this.currentPage = 1
          void this.refresh()
        })
      }
    })

    root.querySelectorAll<HTMLButtonElement>('[data-media]').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.media as MediaFilter
        if (m === 'all') {
          this.mediaFilter = 'all'
          this.ratingFilter = 0
        } else {
          this.mediaFilter = this.mediaFilter === m ? 'all' : m
        }
        this.currentPage = 1
        void this.refresh()
      })
    })

    root.querySelector<HTMLSelectElement>('[data-action="sort"]')?.addEventListener('change', e => {
      this.sortMode = (e.target as HTMLSelectElement).value as SortMode
      this.currentPage = 1
      void this.refresh()
    })

    root.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page || '0', 10)
        if (p >= 1 && p <= this.totalPages) {
          this.currentPage = p
          void this.refresh()
        }
      })
    })

    root.querySelectorAll<HTMLButtonElement>('[data-vote]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id!
        const kind = btn.dataset.vote as 'helpful' | 'unhelpful'
        void this.voteHelpful(id, kind)
      })
    })

    root.querySelectorAll<HTMLElement>('[data-lightbox]').forEach(el => {
      el.addEventListener('click', () => {
        this.openLightbox(el.dataset.lightbox!, el.dataset.type as 'image' | 'video')
      })
    })

    root.querySelector('[data-action="open-form"]')?.addEventListener('click', () => {
      this.showReviewForm = true
      this.formSuccess = null
      this.render()
    })

    root.querySelectorAll('[data-action="close-form"]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName !== 'BUTTON') return
        this.showReviewForm = false
        this.render()
      })
    })

    const form = root.querySelector<HTMLFormElement>('#ur-form')
    if (form) {
      const picker = form.querySelector<HTMLElement>('[data-picker="rating"]')
      const ratingInput = form.querySelector<HTMLInputElement>('input[name="rating"]')
      picker?.querySelectorAll<HTMLButtonElement>('button').forEach((btn, idx) => {
        btn.addEventListener('click', () => {
          const v = idx + 1
          ratingInput!.value = String(v)
          picker.querySelectorAll('button').forEach((b, i) => b.classList.toggle('lit', i < v))
        })
      })

      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(form)
        const payload = {
          product_id: this.productId,
          rating: Number(fd.get('rating')),
          title: fd.get('title') || null,
          body: fd.get('body'),
          author_name: fd.get('author_name'),
          author_email: fd.get('author_email'),
        }
        if (payload.rating < 1) { alert(this.t('rating_required')); return }
        const r = await fetch(`${this.apiUrl}/api/v1/public/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Univer-Domain': window.location.hostname,
          },
          body: JSON.stringify(payload),
        })
        if (r.ok) {
          this.formSuccess = this.t('thank_review')
          this.render()
          setTimeout(() => { this.showReviewForm = false; this.render() }, 2200)
        } else {
          const err = await r.json().catch(() => ({}))
          alert(err.message || this.t('error'))
        }
      })
    }
  }

  private openLightbox(url: string, type: 'image' | 'video') {
    const lb = document.createElement('div')
    lb.className = 'ur-lightbox'
    lb.innerHTML = type === 'video'
      ? `<video src="${url}" controls autoplay></video>`
      : `<img src="${url}" alt="" />`
    lb.addEventListener('click', () => lb.remove())
    document.body.appendChild(lb)
    const style = document.createElement('style')
    style.textContent = `
      .ur-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:99999;cursor:zoom-out}
      .ur-lightbox img,.ur-lightbox video{max-width:90%;max-height:90%;border-radius:4px}
    `
    lb.appendChild(style)
  }
}

if (!customElements.get('univer-reviews')) {
  customElements.define('univer-reviews', UniverReviewsWidget)
}

export {}

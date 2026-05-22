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

interface PublicQuestion {
  id: string
  body: string
  author_name: string | null
  answer: string | null
  answered_at: string | null
  helpful_count: number
  created_at: string
}

type Layout = 'default' | 'compact' | 'grid' | 'carousel'
type SortMode = 'created_at' | 'helpful' | 'rating' | 'oldest'
type RatingFilter = 0 | 1 | 2 | 3 | 4 | 5
type MediaFilter = 'all' | 'with_photo' | 'with_video' | 'verified'
type ActiveTab = 'reviews' | 'qa'
type StarShape = 'star' | 'heart' | 'flame' | 'thumb' | 'diamond'

interface WidgetConfig {
  layout?: Layout
  locale?: string
  theme_color?: string
  star_color?: string
  star_shape?: StarShape
  show_qa?: boolean
  show_write_review?: boolean
  per_page?: number
  custom_css?: string
}

// The glyph used for a single star. Exposed as a top-level function so the
// rating picker (interactive) and the rendered cards (read-only) stay in
// sync when the workspace switches shapes.
function starGlyph(shape: StarShape): string {
  switch (shape) {
    case 'heart':   return '\u2665'  // ♥
    case 'flame':   return '\uD83D\uDD25' // 🔥
    case 'thumb':   return '\uD83D\uDC4D' // 👍
    case 'diamond': return '\u2666'  // ♦
    case 'star':
    default:        return '\u2605'  // ★
  }
}

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
    add_photos: 'Adicionar fotos ou vídeo',
    file_hint: 'Até 5 arquivos · imagem ou vídeo',
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
    add_photos: 'Add photos or video',
    file_hint: 'Up to 5 files · image or video',
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

const buildCSS = (themeColor: string, starColor: string): string => `
:host {
  --ur-bg: #ffffff;
  --ur-surface: #ffffff;
  --ur-surface-soft: #fafafa;
  --ur-text: #111827;
  --ur-text-soft: #6b7280;
  --ur-text-muted: #9ca3af;
  --ur-border: #e5e7eb;
  --ur-border-soft: #f3f4f6;
  --ur-star: ${starColor};
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
  /* Desktop: fixed 4-column grid. Tablet/mobile breakpoints below collapse
     to 2 and 1 columns respectively. */
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.ur-file-trigger {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px; border: 1px dashed var(--ur-border);
  border-radius: 8px; cursor: pointer; transition: all 0.15s;
}
.ur-file-trigger:hover { border-color: var(--ur-accent); background: var(--ur-surface-soft); }
.ur-file-cta { font-size: 13px; font-weight: 600; color: var(--ur-accent); }
.ur-file-hint { font-size: 11px; color: var(--ur-text-muted); }

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

/* ── Q&A ──────────────────────────────────────────────────────────────────── */
.ur-qa-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 16px 0; border-bottom: 1px solid var(--ur-border-soft);
}
.ur-qa-title { font-size: 16px; font-weight: 700; color: var(--ur-text); margin: 0; }
.ur-qa-sub { font-size: 13px; color: var(--ur-text-soft); margin-top: 2px; }
.ur-qa-ask-btn {
  background: var(--ur-accent); color: #fff; border: none;
  padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 700;
  letter-spacing: 0.04em; transition: filter 0.15s, transform 0.1s; white-space: nowrap;
}
.ur-qa-ask-btn:hover { filter: brightness(1.05); }
.ur-qa-ask-btn:active { transform: translateY(1px); }

.ur-qa-list { display: flex; flex-direction: column; gap: 12px; padding: 20px 0; }
.ur-qa-card {
  background: var(--ur-surface);
  border: 1px solid var(--ur-border);
  border-radius: 12px;
  padding: 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.ur-qa-q {
  display: flex; align-items: flex-start; gap: 10px; font-size: 14px;
}
.ur-qa-q-mark {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  background: var(--ur-accent); color: #fff; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.ur-qa-q-body { color: var(--ur-text); flex: 1; }
.ur-qa-meta { font-size: 12px; color: var(--ur-text-muted); margin-top: 4px; }
.ur-qa-a {
  margin-left: 32px; padding: 10px 12px;
  background: var(--ur-surface-soft);
  border-left: 3px solid var(--ur-accent);
  border-radius: 6px;
  font-size: 13px; color: var(--ur-text);
}
.ur-qa-a-label {
  font-size: 11px; font-weight: 700; color: var(--ur-accent);
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
}
.ur-qa-pending {
  margin-left: 32px; font-size: 12px; font-style: italic; color: var(--ur-text-muted);
}

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
/* Tablet: 2 columns */
@media (max-width: 1023px) {
  .ur-list.layout-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
}
/* Mobile: 1 column (vertical stack) */
@media (max-width: 640px) {
  .ur-summary {
    grid-template-columns: 1fr; gap: 20px; text-align: left;
  }
  .ur-hero { align-items: flex-start; }
  .ur-write-btn { width: 100%; }
  .ur-list.layout-grid { grid-template-columns: 1fr; gap: 12px; }
  .ur-toolbar { flex-direction: column; align-items: flex-start; }
}
`

// ─── Component ───────────────────────────────────────────────────────────────

interface VoteState { [reviewId: string]: 'helpful' | 'unhelpful' | undefined }

class UniverReviewsWidget extends HTMLElement {
  private shadow: ShadowRoot
  private productId = ''
  private apiUrl = 'https://api.univerreviews.com'
  private layout: Layout = 'default'
  private locale = 'pt-BR'
  private themeColor = '#d4a850'
  private starColor  = '#fbbf24'
  private starShape: StarShape = 'star'
  private showWriteReview = true
  private showQa = true
  private customCss = ''

  // Per-attribute precedence flags — set true the moment the host page
  // ships an explicit attribute. The remote widget-config is then merged
  // in only for the keys the page did NOT override (attribute > workspace
  // setting > built-in default).
  private attrSet = {
    layout: false,
    locale: false,
    themeColor: false,
    starColor: false,
    starShape: false,
    perPage: false,
    showQa: false,
    showWriteReview: false,
    showReviews: false,
    customCss: false,
  }

  // Q&A-only mode. When show-reviews="false" we hide the reviews tab AND
  // default activeTab to 'qa' so the host can drop <univer-reviews show-reviews="false">
  // (or use the [univer_qa] shortcode) to render just the question panel.
  private showReviews = true

  private reviews: Review[] = []
  private summary: ReviewSummary | null = null
  private questions: PublicQuestion[] = []
  private questionsLoaded = false

  private activeTab: ActiveTab = 'reviews'

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
  private showQuestionForm = false
  private formSuccess: string | null = null

  // Cached workspace config so we only fetch once per element instance.
  private workspaceConfigLoaded = false

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  static get observedAttributes(): string[] {
    return [
      'workspace-id', 'product-id', 'api-url', 'layout', 'locale',
      'theme-color', 'star-color', 'star-shape', 'show-qa', 'show-reviews',
      'show-write-review', 'per-page', 'featured', 'limit', 'min-rating',
    ]
  }

  private featuredMode = false
  private featuredLimit = 30
  private featuredMinRating = 4

  connectedCallback() {
    this.readAttrs()
    this.loadVotes()
    // Fire workspace config + data fetch in parallel. Config result is
    // applied before render() inside fetchAll so the storefront ends up
    // painted exactly once with the merged settings.
    void this.fetchWorkspaceConfig().then(() => this.fetchAll())
  }

  attributeChangedCallback() {
    this.readAttrs()
    this.render()
  }

  private readAttrs() {
    this.productId      = this.getAttribute('product-id') || ''
    this.apiUrl         = this.getAttribute('api-url') || this.apiUrl

    const layoutAttr = this.getAttribute('layout')
    if (layoutAttr) { this.layout = layoutAttr as Layout; this.attrSet.layout = true }

    const localeAttr = this.getAttribute('locale')
    if (localeAttr) { this.locale = localeAttr; this.attrSet.locale = true }

    const themeAttr = this.getAttribute('theme-color')
    if (themeAttr) { this.themeColor = themeAttr; this.attrSet.themeColor = true }

    // Star color and shape are now per-element attributes too (in addition to
    // the workspace-config fetch). Lets the host page override stars without
    // touching the theme accent color used on buttons/links.
    const starColorAttr = this.getAttribute('star-color')
    if (starColorAttr) { this.starColor = starColorAttr; this.attrSet.starColor = true }
    const starShapeAttr = this.getAttribute('star-shape') as StarShape | null
    if (starShapeAttr && ['star','heart','flame','thumb','diamond'].includes(starShapeAttr)) {
      this.starShape = starShapeAttr
      this.attrSet.starShape = true
    }

    // Custom CSS — host page can inject site-specific styles via a child
    // <template data-custom-css>…</template> element OR via the custom-css
    // attribute (capped at 20 KB by the WP plugin). Both override the
    // workspace-wide custom CSS from the dashboard config.
    const customCssTpl = this.querySelector('template[data-custom-css]') as HTMLTemplateElement | null
    if (customCssTpl?.content) {
      const css = customCssTpl.innerHTML.trim()
      if (css) {
        this.customCss = css
        this.attrSet.customCss = true
      }
    } else {
      const customCssAttr = this.getAttribute('custom-css')
      if (customCssAttr && customCssAttr.length > 0) {
        this.customCss = customCssAttr
        this.attrSet.customCss = true
      }
    }

    if (this.hasAttribute('show-write-review')) {
      this.showWriteReview = this.getAttribute('show-write-review') !== 'false'
      this.attrSet.showWriteReview = true
    }
    if (this.hasAttribute('show-qa')) {
      this.showQa = this.getAttribute('show-qa') !== 'false'
      this.attrSet.showQa = true
    }
    if (this.hasAttribute('show-reviews')) {
      this.showReviews = this.getAttribute('show-reviews') !== 'false'
      this.attrSet.showReviews = true
      // Q&A-only: hiding reviews must imply showing Q&A; otherwise the
      // widget would render an empty shell.
      if (!this.showReviews) {
        this.showQa = true
        this.activeTab = 'qa'
      }
    }
    const pp = parseInt(this.getAttribute('per-page') || '', 10)
    if (pp > 0 && pp <= 100) { this.perPage = pp; this.attrSet.perPage = true }
    this.featuredMode = this.getAttribute('featured') === 'true'
    const lim = parseInt(this.getAttribute('limit') || '', 10)
    if (lim > 0) this.featuredLimit = Math.min(lim, 100)
    const mr = parseInt(this.getAttribute('min-rating') || '', 10)
    if (mr >= 1 && mr <= 5) this.featuredMinRating = mr
  }

  // Fetch workspace-level customization from the API and merge it into the
  // current settings, respecting per-attribute precedence: any attribute
  // the host page set explicitly is preserved; everything else picks up
  // the workspace value. Theme/star color and custom CSS always come from
  // the workspace if it provides them (those have no per-element override).
  private async fetchWorkspaceConfig(): Promise<void> {
    if (this.workspaceConfigLoaded) return
    try {
      const r = await fetch(`${this.apiUrl}/api/v1/public/widget-config`, {
        headers: { 'X-Univer-Domain': window.location.hostname },
      })
      if (!r.ok) { this.workspaceConfigLoaded = true; return }
      const json = await r.json()
      const cfg: WidgetConfig = json?.data || {}

      if (!this.attrSet.layout && cfg.layout)         this.layout         = cfg.layout
      if (!this.attrSet.locale && cfg.locale)         this.locale         = cfg.locale
      if (!this.attrSet.themeColor && cfg.theme_color) this.themeColor    = cfg.theme_color
      if (!this.attrSet.showQa && typeof cfg.show_qa === 'boolean')
        this.showQa = cfg.show_qa
      if (!this.attrSet.showWriteReview && typeof cfg.show_write_review === 'boolean')
        this.showWriteReview = cfg.show_write_review
      if (!this.attrSet.perPage && typeof cfg.per_page === 'number' && cfg.per_page > 0)
        this.perPage = Math.min(cfg.per_page, 100)

      // Star color + shape now have per-element attribute overrides — the
      // workspace config is the fallback when the host page didn't set them.
      if (!this.attrSet.starColor && cfg.star_color) this.starColor = cfg.star_color
      if (!this.attrSet.starShape && cfg.star_shape) this.starShape = cfg.star_shape
      if (!this.attrSet.customCss && cfg.custom_css) this.customCss = cfg.custom_css
    } catch (e) {
      console.warn('[univer-reviews] widget-config', e instanceof Error ? e.message : 'unknown')
    } finally {
      this.workspaceConfigLoaded = true
    }
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
    if (this.featuredMode) {
      this.loading = true
      this.render()
      try { await this.fetchFeatured() }
      catch (e) { console.warn('[univer-reviews]', e instanceof Error ? e.message : 'unknown') }
      this.loading = false
      this.render()
      return
    }

    if (!this.productId) {
      this.loading = false
      this.render()
      return
    }
    this.loading = true
    this.render()
    try {
      // Q&A-only mode: skip review/summary fetches so the panel doesn't
      // spin or surface unrelated network errors.
      const tasks: Promise<void>[] = this.showReviews
        ? [this.fetchSummary(), this.fetchReviews()]
        : []
      if (this.showQa) tasks.push(this.fetchQuestions())
      await Promise.all(tasks)
    } catch (e) {
      console.warn('[univer-reviews]', e instanceof Error ? e.message : 'unknown')
    }
    this.loading = false
    this.render()
  }

  private async fetchFeatured() {
    const params = new URLSearchParams({
      limit: String(this.featuredLimit),
      min_rating: String(this.featuredMinRating),
    })
    const r = await fetch(`${this.apiUrl}/api/v1/public/featured?${params}`, {
      headers: { 'X-Univer-Domain': window.location.hostname },
    })
    if (!r.ok) return
    const json = await r.json()
    this.reviews = json.data || []
    this.totalCount = json.meta?.total || this.reviews.length
    this.totalPages = 1
    this.summary = null
  }

  private async fetchQuestions() {
    if (!this.productId) return
    const r = await fetch(`${this.apiUrl}/api/v1/public/questions/${this.productId}`, {
      headers: { 'X-Univer-Domain': window.location.hostname },
    })
    if (!r.ok) {
      this.questionsLoaded = true
      return
    }
    const json = await r.json()
    this.questions = json.data || []
    this.questionsLoaded = true
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
    catch (e) { console.warn('[univer-reviews]', e instanceof Error ? e.message : 'unknown') }
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
    // The custom CSS override is appended *after* the built-in stylesheet
    // so workspace overrides win cascade-wise without us trying to merge
    // selectors. We still HTML-escape only the closing-style sequence to
    // keep the workspace from breaking out of the <style> block.
    const safeCustom = this.customCss
      ? `<style data-ur="custom">${this.customCss.replace(/<\/style>/gi, '<\\/style>')}</style>`
      : ''
    this.shadow.innerHTML = `<style>${buildCSS(this.themeColor, this.starColor)}</style>${safeCustom}${this.renderRoot()}`
    this.attachEvents()
  }

  private renderRoot(): string {
    if (this.featuredMode) {
      if (this.loading) {
        return `<div class="ur-root"><div class="ur-loading"><div class="ur-spinner"></div>${this.t('loading')}</div></div>`
      }
      return `
<div class="ur-root">
  ${this.renderList()}
</div>`
    }
    if (!this.productId) {
      return `<div class="ur-root"><div class="ur-empty">product-id is required</div></div>`
    }
    if (this.loading && this.reviews.length === 0 && this.activeTab === 'reviews') {
      return `<div class="ur-root">${this.renderSummary()}${this.renderTabs()}${this.renderToolbar()}<div class="ur-loading"><div class="ur-spinner"></div>${this.t('loading')}</div></div>`
    }
    const body = this.activeTab === 'qa'
      ? this.renderQa()
      : `${this.renderToolbar()}${this.renderList()}${this.totalPages > 1 ? this.renderPagination() : ''}`
    return `
<div class="ur-root">
  ${this.renderSummary()}
  ${this.renderTabs()}
  ${body}
  ${this.showReviewForm ? this.renderForm() : ''}
  ${this.showQuestionForm ? this.renderQuestionForm() : ''}
</div>`
  }

  // ─── Tabs ────────────────────────────────────────────────────────────────
  private renderTabs(): string {
    // Hide tab bar when only one panel is visible (either show-qa=false or
    // show-reviews=false). With only one tab there is nothing to switch to.
    if (!this.showQa) return ''
    if (!this.showReviews) return ''
    return `
<div class="ur-tabs">
  <button class="ur-tab ${this.activeTab === 'reviews' ? 'active' : ''}" data-tab="reviews">${this.t('reviews')}</button>
  <button class="ur-tab ${this.activeTab === 'qa' ? 'active' : ''}" data-tab="qa">${this.t('qa')}</button>
</div>`
  }

  // ─── Q&A ─────────────────────────────────────────────────────────────────
  private renderQa(): string {
    if (this.loading && !this.questionsLoaded) {
      return `<div class="ur-loading"><div class="ur-spinner"></div>${this.t('loading')}</div>`
    }
    const items = this.questions
    return `
<div class="ur-qa-head">
  <div>
    <h3 class="ur-qa-title">${this.t('qa')}</h3>
    <p class="ur-qa-sub">${items.length} ${this.t('qa').toLowerCase()}</p>
  </div>
  <button class="ur-qa-ask-btn" data-action="open-question-form">${this.t('ask_question')}</button>
</div>
${items.length === 0
  ? `<div class="ur-empty">${this.t('no_questions')}</div>`
  : `<div class="ur-qa-list">${items.map(q => this.renderQaCard(q)).join('')}</div>`}`
  }

  private renderQaCard(q: PublicQuestion): string {
    const time = relativeTime(q.created_at, this.locale)
    const author = q.author_name?.trim() || ''
    return `
<article class="ur-qa-card">
  <div class="ur-qa-q">
    <div class="ur-qa-q-mark">Q</div>
    <div class="ur-qa-q-body">
      ${escapeHtml(q.body)}
      <div class="ur-qa-meta">${author ? escapeHtml(author) + ' · ' : ''}${time}</div>
    </div>
  </div>
  ${q.answer
    ? `<div class="ur-qa-a">
         <div class="ur-qa-a-label">${this.t('store_reply')}</div>
         ${escapeHtml(q.answer)}
       </div>`
    : ''}
</article>`
  }

  private renderQuestionForm(): string {
    return `
<div class="ur-form-overlay" data-action="close-question-form">
  <form class="ur-form" data-action="submit-question-form" id="ur-q-form">
    <h3 class="ur-form-title">${this.t('ask_question')}</h3>
    ${this.formSuccess ? `<div class="ur-form-success">${this.formSuccess}</div>` : ''}
    <div class="ur-field">
      <label class="ur-label">${this.t('your_name')}</label>
      <input class="ur-input" name="author_name" required />
    </div>
    <div class="ur-field">
      <label class="ur-label">${this.t('your_email')}</label>
      <input class="ur-input" name="author_email" type="email" required />
    </div>
    <div class="ur-field">
      <label class="ur-label">${this.t('question_ph')}</label>
      <textarea class="ur-textarea" name="body" placeholder="${this.t('question_ph')}" required minlength="6"></textarea>
    </div>
    <div class="ur-form-actions">
      <button type="button" class="ur-btn" data-action="close-question-form">${this.t('cancel')}</button>
      <button type="submit" class="ur-btn primary">${this.t('submit')}</button>
    </div>
  </form>
</div>`
  }

  // ─── Summary header ──────────────────────────────────────────────────────
  private renderSummary(): string {
    // Q&A-only mode: no rating summary to display.
    if (!this.showReviews) return ''

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
        <span class="ur-dist-label">${r}<span class="ur-dist-star">${starGlyph(this.starShape)}</span></span>
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
    const glyph = starGlyph(this.starShape)
    let out = ''
    for (let i = 1; i <= 5; i++) {
      out += `<span class="ur-star ${i > full ? 'empty' : ''}">${glyph}</span>`
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
        ${[1, 2, 3, 4, 5].map(i => `<button type="button" data-rating="${i}">${starGlyph(this.starShape)}</button>`).join('')}
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
    <div class="ur-field">
      <label class="ur-label">${this.t('add_photos')}</label>
      <label class="ur-file-trigger">
        <input type="file" name="media" accept="image/*,video/*" multiple hidden />
        <span class="ur-file-cta">📎 ${this.t('add_photos')}</span>
        <span class="ur-file-hint">${this.t('file_hint')}</span>
      </label>
      <div class="ur-media-row" data-preview></div>
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

    // Tab switching
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as ActiveTab
        if (tab === this.activeTab) return
        this.activeTab = tab
        if (tab === 'qa' && !this.questionsLoaded && this.showQa) {
          void this.fetchQuestions().then(() => this.render())
        }
        this.render()
      })
    })

    // Open question form
    root.querySelector('[data-action="open-question-form"]')?.addEventListener('click', () => {
      this.showQuestionForm = true
      this.formSuccess = null
      this.render()
    })

    // Close question form (overlay click or cancel button)
    root.querySelectorAll('[data-action="close-question-form"]').forEach(el => {
      el.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        const isOverlay = target === el
        const isCancelBtn = target.dataset?.action === 'close-question-form'
        if (!isOverlay && !isCancelBtn) return
        this.showQuestionForm = false
        this.render()
      })
    })

    // Submit question form
    const qForm = root.querySelector<HTMLFormElement>('#ur-q-form')
    if (qForm) {
      qForm.addEventListener('click', (e) => e.stopPropagation())
      qForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(qForm)
        const body = String(fd.get('body') || '').trim()
        if (body.length < 6) { alert(this.t('body_required')); return }

        const payload = {
          author_name:  fd.get('author_name'),
          author_email: fd.get('author_email'),
          body,
        }
        const r = await fetch(`${this.apiUrl}/api/v1/public/questions/${this.productId}`, {
          method: 'POST',
          headers: {
            'X-Univer-Domain': window.location.hostname,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        if (r.ok) {
          this.formSuccess = this.t('thank_question')
          this.render()
          setTimeout(() => {
            this.showQuestionForm = false
            this.questionsLoaded = false
            void this.fetchQuestions().then(() => this.render())
          }, 2000)
        } else {
          const err = await r.json().catch(() => ({}))
          alert(err.message || this.t('error'))
        }
      })
    }

    // Form close: only when user clicks the overlay backdrop or the
    // explicit Cancel button. Star picker / inputs / submit no longer trigger
    // close because we check data-action instead of tagName.
    root.querySelectorAll('[data-action="close-form"]').forEach(el => {
      el.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        const isOverlay = target === el
        const isCancelBtn = target.dataset?.action === 'close-form'
        if (!isOverlay && !isCancelBtn) return
        this.showReviewForm = false
        this.render()
      })
    })

    const form = root.querySelector<HTMLFormElement>('#ur-form')
    if (form) {
      // Stop any click inside form from bubbling up to the overlay close handler.
      form.addEventListener('click', (e) => e.stopPropagation())

      const picker = form.querySelector<HTMLElement>('[data-picker="rating"]')
      const ratingInput = form.querySelector<HTMLInputElement>('input[name="rating"]')
      picker?.querySelectorAll<HTMLButtonElement>('button').forEach((btn, idx) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          const v = idx + 1
          ratingInput!.value = String(v)
          picker.querySelectorAll('button').forEach((b, i) => b.classList.toggle('lit', i < v))
        })
      })

      // Media preview thumbnails as user picks files
      const fileInput = form.querySelector<HTMLInputElement>('input[name="media"]')
      const previewRow = form.querySelector<HTMLElement>('[data-preview]')
      fileInput?.addEventListener('change', () => {
        if (!previewRow || !fileInput.files) return
        previewRow.innerHTML = ''
        Array.from(fileInput.files).forEach((f) => {
          const url = URL.createObjectURL(f)
          const isVideo = f.type.startsWith('video/')
          previewRow.insertAdjacentHTML(
            'beforeend',
            isVideo
              ? `<div class="ur-media-thumb video" style="background:#1f2937"></div>`
              : `<img class="ur-media-thumb" src="${url}" alt="" />`
          )
        })
      })

      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        const rating = Number(ratingInput?.value || 0)
        if (rating < 1) { alert(this.t('rating_required')); return }

        const fd = new FormData(form)
        fd.set('product_id', this.productId)
        fd.set('rating', String(rating))
        // Remove the hidden helper field so backend reads the right key
        fd.delete('media') // re-append below as media[]
        const files = fileInput?.files
        if (files && files.length > 0) {
          Array.from(files).slice(0, 5).forEach(f => fd.append('media[]', f, f.name))
        }
        const r = await fetch(`${this.apiUrl}/api/v1/public/submit`, {
          method: 'POST',
          headers: { 'X-Univer-Domain': window.location.hostname },
          body: fd,
        })
        if (r.ok) {
          this.formSuccess = this.t('thank_review')
          this.render()
          setTimeout(() => { this.showReviewForm = false; this.render(); void this.fetchAll() }, 2200)
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

// ─── Compact summary element ────────────────────────────────────────────────
// <univer-reviews-summary product-id="123" workspace-id="..."> →
//    ★★★★★ 4.8 (123)
// Used in shop loops / product cards.

class UniverReviewsSummary extends HTMLElement {
  private shadow: ShadowRoot
  private productId = ''
  private apiUrl = 'https://api.univerreviews.com'
  private themeColor = '#d4a850'

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  static get observedAttributes() {
    return ['product-id', 'api-url', 'theme-color', 'workspace-id']
  }

  connectedCallback() {
    this.productId = this.getAttribute('product-id') || ''
    this.apiUrl    = this.getAttribute('api-url') || this.apiUrl
    this.themeColor = this.getAttribute('theme-color') || this.themeColor
    if (!this.productId) return
    void this.fetchAndRender()
  }

  private async fetchAndRender() {
    try {
      const r = await fetch(`${this.apiUrl}/api/v1/public/summary/${this.productId}`, {
        headers: { 'X-Univer-Domain': window.location.hostname },
      })
      if (!r.ok) return
      const json = await r.json()
      const avg = Number(json.data?.avg_rating || 0)
      const total = Number(json.data?.total_reviews || 0)
      this.render(avg, total)
    } catch { /* ignore */ }
  }

  private render(avg: number, total: number) {
    if (total === 0) { this.shadow.innerHTML = ''; return }
    const full = Math.round(avg)
    let stars = ''
    for (let i = 1; i <= 5; i++) {
      stars += `<span class="s${i > full ? ' empty' : ''}">★</span>`
    }
    this.shadow.innerHTML = `
<style>
  :host { display: inline-flex; align-items: center; gap: 6px; font-family: inherit; font-size: 13px; }
  .stars { display: inline-flex; gap: 1px; color: #fbbf24; }
  .stars .empty { color: #e5e7eb; }
  .rating { font-weight: 600; color: #111827; }
  .count { color: #6b7280; }
</style>
<span class="stars">${stars}</span>
<span class="rating">${avg.toFixed(1)}</span>
<span class="count">(${total})</span>
`
  }
}

if (!customElements.get('univer-reviews-summary')) {
  customElements.define('univer-reviews-summary', UniverReviewsSummary)
}

export {}

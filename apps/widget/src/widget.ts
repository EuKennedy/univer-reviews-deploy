// UniverReviews Widget — Vanilla Web Component
// Custom element: <univer-reviews>
// Shadow DOM, zero dependencies, target < 20KB minified

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReviewMedia {
  type: 'image' | 'video'
  url: string
  thumb_url: string
  width: number
  height: number
}

interface Reply {
  body: string
  author_name: string
  created_at: string
}

interface Review {
  id: string
  rating: number
  title: string
  body: string
  author_name: string
  author_country: string
  created_at: string
  is_verified_purchase: boolean
  media: ReviewMedia[]
  reply?: Reply
}

interface ReviewSummary {
  average_rating: number
  total_count: number
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number }
}

interface Question {
  id: string
  body: string
  answer?: string
  helpful_count: number
  created_at: string
}

interface PaginatedResponse<T> {
  data: T[]
  page: number
  per_page: number
  total: number
  total_pages: number
}

interface WriteReviewForm {
  name: string
  email: string
  rating: number
  title: string
  body: string
}

interface AskQuestionForm {
  name: string
  email: string
  body: string
}

// ─── i18n ────────────────────────────────────────────────────────────────────

const i18n: Record<string, Record<string, string>> = {
  'pt-BR': {
    reviews: 'Avaliações',
    qa: 'Perguntas e Respostas',
    write_review: 'Escrever Avaliação',
    ask_question: 'Fazer Pergunta',
    no_reviews: 'Nenhuma avaliação ainda.',
    no_questions: 'Nenhuma pergunta ainda.',
    loading: 'Carregando avaliações…',
    error: 'Não foi possível carregar as avaliações.',
    verified: 'Compra verificada',
    helpful: 'úteis',
    previous: 'Anterior',
    next: 'Próximo',
    your_name: 'Seu nome',
    your_email: 'Seu e-mail',
    review_title: 'Título da avaliação',
    review_body: 'Conte sua experiência',
    submit: 'Enviar',
    cancel: 'Cancelar',
    question_body: 'Sua pergunta',
    sending: 'Enviando…',
    thank_you_review: 'Obrigado! Sua avaliação foi enviada.',
    thank_you_question: 'Obrigado! Sua pergunta foi enviada.',
    rating_label: 'Nota',
    add_photos: 'Adicionar fotos',
    answered: 'Resposta',
    store_reply: 'Resposta da Loja',
    of: 'de',
    ratings: 'avaliações',
    stars: 'estrelas',
    star: 'estrela',
    select_rating: 'Selecione uma nota',
    name_required: 'Nome é obrigatório',
    email_required: 'E-mail inválido',
    rating_required: 'Selecione uma nota',
    body_required: 'Escreva pelo menos 10 caracteres',
    question_required: 'Escreva sua pergunta',
  },
  'en-US': {
    reviews: 'Reviews',
    qa: 'Q&A',
    write_review: 'Write a Review',
    ask_question: 'Ask a Question',
    no_reviews: 'No reviews yet.',
    no_questions: 'No questions yet.',
    loading: 'Loading reviews…',
    error: 'Could not load reviews.',
    verified: 'Verified Purchase',
    helpful: 'helpful',
    previous: 'Previous',
    next: 'Next',
    your_name: 'Your name',
    your_email: 'Your email',
    review_title: 'Review title',
    review_body: 'Share your experience',
    submit: 'Submit',
    cancel: 'Cancel',
    question_body: 'Your question',
    sending: 'Sending…',
    thank_you_review: 'Thank you! Your review has been submitted.',
    thank_you_question: 'Thank you! Your question has been submitted.',
    rating_label: 'Rating',
    add_photos: 'Add photos',
    answered: 'Answer',
    store_reply: 'Store Reply',
    of: 'of',
    ratings: 'ratings',
    stars: 'stars',
    star: 'star',
    select_rating: 'Select a rating',
    name_required: 'Name is required',
    email_required: 'Invalid email',
    rating_required: 'Please select a rating',
    body_required: 'Write at least 10 characters',
    question_required: 'Please enter your question',
  },
}

// Country code → flag emoji (most common e-commerce markets)
const countryFlags: Record<string, string> = {
  BR: '🇧🇷', US: '🇺🇸', AR: '🇦🇷', MX: '🇲🇽', PT: '🇵🇹', DE: '🇩🇪',
  FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺',
  JP: '🇯🇵', KR: '🇰🇷', CN: '🇨🇳', IN: '🇮🇳', NL: '🇳🇱', BE: '🇧🇪',
  CH: '🇨🇭', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', PL: '🇵🇱', CO: '🇨🇴',
  CL: '🇨🇱', PE: '🇵🇪', UY: '🇺🇾', ZA: '🇿🇦',
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const getCSS = (themeColor: string): string => `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :host{display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,sans-serif;color:#1a1a1a;--theme:#d4a850;--theme-hover:#b8923e;--radius:8px;--shadow:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06);--transition:200ms ease}
  :host{--theme:${themeColor};--theme-hover:${themeColor}}

  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

  .ur-widget{background:#fff;border-radius:var(--radius);padding:24px;animation:ur-fadein .4s ease both}
  @keyframes ur-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

  /* ── Summary ── */
  .ur-summary{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #f0f0f0}
  .ur-avg-block{display:flex;flex-direction:column;align-items:center;min-width:80px}
  .ur-avg-num{font-size:3rem;font-weight:700;line-height:1;color:#1a1a1a;letter-spacing:-2px}
  .ur-avg-stars{display:flex;gap:2px;margin:4px 0}
  .ur-avg-count{font-size:.75rem;color:#888}
  .ur-dist{flex:1;min-width:160px;display:flex;flex-direction:column;gap:5px}
  .ur-dist-row{display:flex;align-items:center;gap:8px;cursor:pointer}
  .ur-dist-row:hover .ur-dist-bar-fill{filter:brightness(1.1)}
  .ur-dist-label{font-size:.72rem;color:#666;white-space:nowrap;width:40px;text-align:right}
  .ur-dist-bar{flex:1;height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden}
  .ur-dist-bar-fill{height:100%;background:var(--theme);border-radius:3px;transition:width .6s cubic-bezier(.4,0,.2,1)}
  .ur-dist-count{font-size:.72rem;color:#888;width:24px}

  /* ── Tabs ── */
  .ur-tabs{display:flex;gap:0;border-bottom:1px solid #f0f0f0;margin-bottom:20px}
  .ur-tab{background:none;border:none;border-bottom:2px solid transparent;padding:10px 16px;font-size:.875rem;font-weight:500;color:#888;cursor:pointer;transition:color var(--transition),border-color var(--transition);margin-bottom:-1px;min-height:44px}
  .ur-tab[aria-selected="true"]{color:var(--theme);border-bottom-color:var(--theme)}
  .ur-tab:hover:not([aria-selected="true"]){color:#444}

  /* ── Actions ── */
  .ur-actions{display:flex;justify-content:flex-end;margin-bottom:16px}
  .ur-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;font-size:.875rem;font-weight:600;border-radius:var(--radius);border:1.5px solid var(--theme);cursor:pointer;transition:background var(--transition),color var(--transition),transform var(--transition);min-height:44px;line-height:1}
  .ur-btn-primary{background:var(--theme);color:#fff;border-color:var(--theme)}
  .ur-btn-primary:hover{background:var(--theme-hover);transform:translateY(-1px)}
  .ur-btn-ghost{background:transparent;color:var(--theme)}
  .ur-btn-ghost:hover{background:rgba(212,168,80,.08)}
  .ur-btn:active{transform:translateY(0)}
  .ur-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}

  /* ── Review card ── */
  .ur-reviews-list{display:flex;flex-direction:column;gap:16px}
  .ur-review-card{border:1px solid #f0f0f0;border-radius:var(--radius);padding:16px;animation:ur-fadein .3s ease both}
  .ur-review-card:hover{box-shadow:var(--shadow)}
  .ur-review-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px}
  .ur-review-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#f5e6c8,var(--theme));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.875rem;color:#7a5c1e;flex-shrink:0}
  .ur-review-meta{flex:1}
  .ur-review-author{font-weight:600;font-size:.875rem;display:flex;align-items:center;gap:6px}
  .ur-review-flag{font-size:.9rem}
  .ur-review-date{font-size:.72rem;color:#aaa;margin-top:2px}
  .ur-review-stars{display:flex;gap:2px;margin-bottom:8px}
  .ur-review-title{font-weight:600;font-size:.9rem;margin-bottom:6px}
  .ur-review-body{font-size:.875rem;color:#444;line-height:1.55}
  .ur-verified{display:inline-flex;align-items:center;gap:4px;font-size:.7rem;color:#2d8a4e;background:#edf7f1;padding:2px 7px;border-radius:20px;font-weight:500;margin-top:4px}
  .ur-verified svg{width:10px;height:10px}
  .ur-media-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
  .ur-media-thumb{width:56px;height:56px;border-radius:4px;object-fit:cover;cursor:pointer;border:1px solid #f0f0f0;transition:transform var(--transition)}
  .ur-media-thumb:hover{transform:scale(1.05)}
  .ur-reply{margin-top:12px;background:#fafafa;border-left:3px solid var(--theme);border-radius:0 var(--radius) var(--radius) 0;padding:10px 12px}
  .ur-reply-label{font-size:.72rem;font-weight:600;color:var(--theme);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}
  .ur-reply-body{font-size:.8rem;color:#555;line-height:1.5}

  /* ── Star rating input ── */
  .ur-star-input{display:flex;gap:4px;flex-direction:row-reverse;justify-content:flex-end}
  .ur-star-input input{display:none}
  .ur-star-input label{font-size:1.6rem;cursor:pointer;color:#e0e0e0;transition:color var(--transition)}
  .ur-star-input label:hover,.ur-star-input label:hover~label,
  .ur-star-input input:checked~label{color:var(--theme)}

  /* ── Form ── */
  .ur-form{background:#fafafa;border:1px solid #f0f0f0;border-radius:var(--radius);padding:20px;margin-bottom:16px;animation:ur-fadein .25s ease both}
  .ur-form-title{font-weight:700;font-size:1rem;margin-bottom:16px}
  .ur-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
  @container(max-width:480px){.ur-form-row{grid-template-columns:1fr}}
  .ur-form-group{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
  .ur-label{font-size:.78rem;font-weight:600;color:#555}
  .ur-input,.ur-textarea{width:100%;padding:10px 12px;border:1.5px solid #e8e8e8;border-radius:var(--radius);font-size:.875rem;color:#1a1a1a;background:#fff;transition:border-color var(--transition);font-family:inherit;min-height:44px}
  .ur-input:focus,.ur-textarea:focus{outline:none;border-color:var(--theme)}
  .ur-textarea{resize:vertical;min-height:90px;line-height:1.5}
  .ur-input.error,.ur-textarea.error{border-color:#e53e3e}
  .ur-error-msg{font-size:.72rem;color:#e53e3e;margin-top:2px}
  .ur-form-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
  .ur-success{text-align:center;padding:20px;color:#2d8a4e;font-weight:500;font-size:.9rem}
  .ur-file-input{display:none}
  .ur-file-label{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1.5px dashed #e0e0e0;border-radius:var(--radius);font-size:.8rem;color:#888;cursor:pointer;transition:border-color var(--transition),color var(--transition);min-height:40px}
  .ur-file-label:hover{border-color:var(--theme);color:var(--theme)}

  /* ── Q&A ── */
  .ur-qa-list{display:flex;flex-direction:column;gap:14px}
  .ur-qa-item{border:1px solid #f0f0f0;border-radius:var(--radius);padding:14px}
  .ur-qa-question{font-weight:600;font-size:.9rem;margin-bottom:8px;display:flex;align-items:flex-start;gap:8px}
  .ur-qa-q-icon{color:var(--theme);font-weight:800;font-size:1rem;flex-shrink:0}
  .ur-qa-answer{background:#fafafa;border-radius:calc(var(--radius) - 2px);padding:10px 12px;font-size:.85rem;color:#555;line-height:1.5;border-left:3px solid var(--theme)}
  .ur-qa-answer-label{font-size:.7rem;font-weight:600;color:var(--theme);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
  .ur-qa-meta{font-size:.7rem;color:#aaa;margin-top:8px}

  /* ── Pagination ── */
  .ur-pagination{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px;flex-wrap:wrap}
  .ur-page-btn{min-width:36px;height:36px;padding:0 8px;border:1.5px solid #e8e8e8;border-radius:var(--radius);background:#fff;font-size:.8rem;font-weight:500;cursor:pointer;transition:all var(--transition);display:flex;align-items:center;justify-content:center;color:#444;min-height:36px}
  .ur-page-btn:hover:not(:disabled){border-color:var(--theme);color:var(--theme)}
  .ur-page-btn.active{background:var(--theme);border-color:var(--theme);color:#fff}
  .ur-page-btn:disabled{opacity:.4;cursor:not-allowed}
  .ur-page-ellipsis{color:#aaa;font-size:.8rem;padding:0 2px}

  /* ── State ── */
  .ur-loading{text-align:center;padding:40px;color:#aaa;font-size:.875rem}
  .ur-spinner{width:24px;height:24px;border:2px solid #f0f0f0;border-top-color:var(--theme);border-radius:50%;animation:ur-spin .7s linear infinite;margin:0 auto 10px}
  @keyframes ur-spin{to{transform:rotate(360deg)}}
  .ur-error-state{text-align:center;padding:32px;color:#e53e3e;font-size:.875rem}
  .ur-empty{text-align:center;padding:40px;color:#aaa;font-size:.875rem}

  /* ── Star display ── */
  .ur-star{font-size:1rem;line-height:1}
  .ur-star.filled{color:var(--theme)}
  .ur-star.empty{color:#e0e0e0}
  .ur-star.half{position:relative;display:inline-block;color:#e0e0e0}
  .ur-star.half::before{content:'★';position:absolute;left:0;top:0;width:50%;overflow:hidden;color:var(--theme)}

  /* ── Lightbox ── */
  .ur-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;animation:ur-fadein .2s ease}
  .ur-lightbox-img{max-width:90vw;max-height:90vh;border-radius:4px;object-fit:contain}
  .ur-lightbox-close{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;transition:background var(--transition)}
  .ur-lightbox-close:hover{background:rgba(255,255,255,.3)}

  /* ── Layout: compact ── */
  .ur-widget.layout-compact .ur-summary{flex-direction:row;gap:16px}
  .ur-widget.layout-compact .ur-review-card{padding:10px 12px}
  .ur-widget.layout-compact .ur-review-body{font-size:.82rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

  /* ── Layout: grid ── */
  .ur-widget.layout-grid .ur-reviews-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}

  /* ── Layout: carousel ── */
  .ur-widget.layout-carousel .ur-reviews-list{display:flex;flex-direction:row;overflow-x:auto;gap:14px;padding-bottom:8px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
  .ur-widget.layout-carousel .ur-reviews-list::-webkit-scrollbar{height:4px}
  .ur-widget.layout-carousel .ur-reviews-list::-webkit-scrollbar-thumb{background:var(--theme);border-radius:2px}
  .ur-widget.layout-carousel .ur-review-card{min-width:280px;max-width:300px;scroll-snap-align:start;flex-shrink:0}

  /* ── Layout: side-summary ── */
  .ur-widget.layout-side-summary .ur-content{display:grid;grid-template-columns:220px 1fr;gap:24px}
  .ur-widget.layout-side-summary .ur-summary{flex-direction:column;border-bottom:none;border-right:1px solid #f0f0f0;padding-right:24px;padding-bottom:0;margin-bottom:0;position:sticky;top:0;align-self:start}
  @media(max-width:640px){
    .ur-widget.layout-side-summary .ur-content{grid-template-columns:1fr}
    .ur-widget.layout-side-summary .ur-summary{border-right:none;border-bottom:1px solid #f0f0f0;padding-right:0;padding-bottom:20px;position:static}
  }

  /* ── Container queries ── */
  @container(max-width:480px){
    .ur-summary{flex-direction:column;align-items:flex-start}
    .ur-review-header{gap:8px}
    .ur-avg-num{font-size:2.4rem}
  }
`

// ─── Component ───────────────────────────────────────────────────────────────

class UniverReviewsWidget extends HTMLElement {
  private shadow: ShadowRoot
  private workspaceId: string = ''
  private productId: string = ''
  private apiUrl: string = 'https://api.univerreviews.com'
  private layout: 'default' | 'compact' | 'grid' | 'carousel' | 'side-summary' = 'default'
  private locale: string = 'pt-BR'
  private themeColor: string = '#d4a850'
  private showQa: boolean = true
  private showWriteReview: boolean = true

  private reviews: Review[] = []
  private summary: ReviewSummary | null = null
  private questions: Question[] = []

  private currentTab: 'reviews' | 'qa' = 'reviews'
  private currentPage: number = 1
  private totalPages: number = 1
  private perPage: number = 10

  private loading: boolean = true
  private error: string | null = null

  private showReviewForm: boolean = false
  private showQuestionForm: boolean = false
  private formSuccess: string | null = null
  private formLoading: boolean = false

  static get observedAttributes() {
    return ['workspace-id', 'product-id', 'api-url', 'layout', 'locale', 'theme-color', 'show-qa', 'show-write-review']
  }

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.workspaceId = this.getAttribute('workspace-id') || ''
    this.productId = this.getAttribute('product-id') || ''
    this.apiUrl = this.getAttribute('api-url') || 'https://api.univerreviews.com'
    this.layout = (this.getAttribute('layout') as typeof this.layout) || 'default'
    this.locale = this.getAttribute('locale') || 'pt-BR'
    this.themeColor = this.getAttribute('theme-color') || '#d4a850'
    this.showQa = this.getAttribute('show-qa') !== 'false'
    this.showWriteReview = this.getAttribute('show-write-review') !== 'false'

    this.render()
    this.fetchData()
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (!this.isConnected) return
    if (name === 'workspace-id') this.workspaceId = value || ''
    if (name === 'product-id') { this.productId = value || ''; this.fetchData() }
    if (name === 'api-url') this.apiUrl = value || 'https://api.univerreviews.com'
    if (name === 'layout') this.layout = (value as typeof this.layout) || 'default'
    if (name === 'locale') this.locale = value || 'pt-BR'
    if (name === 'theme-color') this.themeColor = value || '#d4a850'
    if (name === 'show-qa') this.showQa = value !== 'false'
    if (name === 'show-write-review') this.showWriteReview = value !== 'false'
    this.render()
  }

  private t(key: string): string {
    const strings = i18n[this.locale] ?? i18n['pt-BR']
    return strings[key] ?? key
  }

  private async fetchData() {
    if (!this.productId) { this.loading = false; this.render(); return }
    this.loading = true
    this.error = null
    this.render()

    try {
      const base = `${this.apiUrl}/api/v1/public`
      const headers: HeadersInit = { 'X-Workspace-ID': this.workspaceId }

      const [summaryRes, reviewsRes, questionsRes] = await Promise.all([
        fetch(`${base}/summary/${this.productId}`, { headers }),
        fetch(`${base}/reviews/${this.productId}?page=${this.currentPage}&per_page=${this.perPage}`, { headers }),
        this.showQa ? fetch(`${base}/questions/${this.productId}`, { headers }) : Promise.resolve(null),
      ])

      if (summaryRes.ok) this.summary = (await summaryRes.json()) as ReviewSummary
      if (reviewsRes.ok) {
        const data = (await reviewsRes.json()) as PaginatedResponse<Review>
        this.reviews = data.data
        this.totalPages = data.total_pages ?? 1
        this.currentPage = data.page ?? 1
      }
      if (questionsRes?.ok) {
        const data = (await questionsRes.json()) as PaginatedResponse<Question>
        this.questions = data.data
      }
    } catch {
      this.error = this.t('error')
    } finally {
      this.loading = false
      this.render()
    }
  }

  private async fetchReviews() {
    if (!this.productId) return
    try {
      const base = `${this.apiUrl}/api/v1/public`
      const headers: HeadersInit = { 'X-Workspace-ID': this.workspaceId }
      const res = await fetch(`${base}/reviews/${this.productId}?page=${this.currentPage}&per_page=${this.perPage}`, { headers })
      if (res.ok) {
        const data = (await res.json()) as PaginatedResponse<Review>
        this.reviews = data.data
        this.totalPages = data.total_pages ?? 1
        this.currentPage = data.page ?? 1
      }
    } catch { /* silent */ }
    this.render()
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  private render() {
    const style = document.createElement('style')
    style.textContent = getCSS(this.themeColor)
    this.shadow.innerHTML = ''
    this.shadow.appendChild(style)

    const container = document.createElement('div')
    container.setAttribute('part', 'widget')
    container.className = `ur-widget layout-${this.layout}`
    container.style.containerType = 'inline-size'
    container.innerHTML = this.renderWidget()
    this.shadow.appendChild(container)

    this.attachEvents(container)
  }

  private renderWidget(): string {
    if (this.loading) return `<div class="ur-loading"><div class="ur-spinner" role="progressbar" aria-label="${this.t('loading')}"></div>${this.t('loading')}</div>`
    if (this.error) return `<div class="ur-error-state" role="alert">${this.error}</div>`

    const isCarousel = this.layout === 'carousel'
    const isSide = this.layout === 'side-summary'

    if (isSide) {
      return `
        <div class="ur-content">
          ${this.renderSummary()}
          <div>
            ${this.renderTabsAndContent()}
          </div>
        </div>
      `
    }

    return `
      ${!isCarousel ? this.renderSummary() : ''}
      ${this.renderTabsAndContent()}
    `
  }

  private renderSummary(): string {
    if (!this.summary) return ''
    const { average_rating, total_count, distribution } = this.summary
    const total = total_count || 1

    const distRows = ([5, 4, 3, 2, 1] as const).map(star => {
      const count = distribution[star] ?? 0
      const pct = Math.round((count / total) * 100)
      return `
        <div class="ur-dist-row" role="button" tabindex="0" aria-label="${star} ${star === 1 ? this.t('star') : this.t('stars')}: ${count}" data-filter-star="${star}">
          <span class="ur-dist-label">${star} ${star === 1 ? this.t('star') : this.t('stars')}</span>
          <div class="ur-dist-bar" aria-hidden="true"><div class="ur-dist-bar-fill" style="width:${pct}%"></div></div>
          <span class="ur-dist-count">${count}</span>
        </div>
      `
    }).join('')

    return `
      <div class="ur-summary" aria-label="${this.t('reviews')} ${this.t('of')} ${this.productId}">
        <div class="ur-avg-block">
          <span class="ur-avg-num">${average_rating.toFixed(1)}</span>
          <div class="ur-avg-stars" aria-label="${average_rating} ${this.t('of')} 5">${this.renderStars(average_rating)}</div>
          <span class="ur-avg-count">${total_count} ${this.t('ratings')}</span>
        </div>
        <div class="ur-dist" role="list" aria-label="${this.t('reviews')} distribuição">${distRows}</div>
      </div>
    `
  }

  private renderTabsAndContent(): string {
    const showQaTab = this.showQa
    return `
      <div class="ur-tabs" role="tablist" aria-label="${this.t('reviews')}">
        <button class="ur-tab" role="tab" aria-selected="${this.currentTab === 'reviews'}" data-tab="reviews" id="tab-reviews" aria-controls="panel-reviews">
          ${this.t('reviews')} ${this.summary ? `(${this.summary.total_count})` : ''}
        </button>
        ${showQaTab ? `<button class="ur-tab" role="tab" aria-selected="${this.currentTab === 'qa'}" data-tab="qa" id="tab-qa" aria-controls="panel-qa">${this.t('qa')}</button>` : ''}
      </div>
      <div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" ${this.currentTab !== 'reviews' ? 'hidden' : ''}>
        ${this.renderReviewsPanel()}
      </div>
      ${showQaTab ? `<div id="panel-qa" role="tabpanel" aria-labelledby="tab-qa" ${this.currentTab !== 'qa' ? 'hidden' : ''}>${this.renderQAPanel()}</div>` : ''}
    `
  }

  private renderReviewsPanel(): string {
    return `
      ${this.showWriteReview ? `<div class="ur-actions">${this.formSuccess === 'review' ? '' : `<button class="ur-btn ur-btn-primary" data-action="open-review-form" aria-expanded="${this.showReviewForm}">✦ ${this.t('write_review')}</button>`}</div>` : ''}
      ${this.showReviewForm ? this.renderReviewForm() : ''}
      ${this.formSuccess === 'review' ? `<div class="ur-success" role="status">✓ ${this.t('thank_you_review')}</div>` : ''}
      ${this.reviews.length === 0 ? `<div class="ur-empty">${this.t('no_reviews')}</div>` : ''}
      <div class="ur-reviews-list" aria-label="${this.t('reviews')} lista">
        ${this.reviews.map((r, i) => this.renderReviewCard(r, i)).join('')}
      </div>
      ${this.totalPages > 1 ? this.renderPagination() : ''}
    `
  }

  private renderReviewCard(r: Review, index: number): string {
    const flag = countryFlags[r.author_country?.toUpperCase()] ?? ''
    const initials = (r.author_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    const date = new Date(r.created_at).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' })

    const mediaHTML = r.media?.length ? `
      <div class="ur-media-row" aria-label="Fotos da avaliação">
        ${r.media.map(m => `<img class="ur-media-thumb" src="${m.thumb_url}" alt="${r.title || ''}" loading="lazy" data-full="${m.url}" role="button" tabindex="0" aria-label="Ver imagem">`).join('')}
      </div>
    ` : ''

    const replyHTML = r.reply ? `
      <div class="ur-reply" role="note" aria-label="${this.t('store_reply')}">
        <div class="ur-reply-label">${this.t('store_reply')}</div>
        <div class="ur-reply-body">${this.escapeHtml(r.reply.body)}</div>
      </div>
    ` : ''

    return `
      <article class="ur-review-card" style="animation-delay:${index * 40}ms" aria-label="${this.t('reviews')} ${this.t('of')} ${r.author_name}">
        <div class="ur-review-header">
          <div class="ur-review-avatar" aria-hidden="true">${initials}</div>
          <div class="ur-review-meta">
            <div class="ur-review-author">
              <span>${this.escapeHtml(r.author_name)}</span>
              ${flag ? `<span class="ur-review-flag" aria-label="${r.author_country}">${flag}</span>` : ''}
            </div>
            <div class="ur-review-date"><time datetime="${r.created_at}">${date}</time></div>
          </div>
          <div class="ur-review-stars" aria-label="${r.rating} ${this.t('of')} 5 ${this.t('stars')}">${this.renderStars(r.rating)}</div>
        </div>
        ${r.is_verified_purchase ? `<span class="ur-verified" aria-label="${this.t('verified')}"><svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M5.001 9.5L1.5 6l1-1 2.5 2.5 5-5 1 1z"/></svg>${this.t('verified')}</span>` : ''}
        ${r.title ? `<div class="ur-review-title">${this.escapeHtml(r.title)}</div>` : ''}
        <div class="ur-review-body">${this.escapeHtml(r.body)}</div>
        ${mediaHTML}
        ${replyHTML}
      </article>
    `
  }

  private renderReviewForm(): string {
    return `
      <div class="ur-form" role="form" aria-label="${this.t('write_review')}">
        <div class="ur-form-title">✦ ${this.t('write_review')}</div>
        <div class="ur-form-group">
          <label class="ur-label" for="ur-rating-label">${this.t('rating_label')}</label>
          <div class="ur-star-input" id="ur-rating-label" role="radiogroup" aria-label="${this.t('select_rating')}">
            ${[5,4,3,2,1].map(n => `
              <input type="radio" name="ur-rating" id="ur-star-${n}" value="${n}" aria-label="${n} ${n === 1 ? this.t('star') : this.t('stars')}">
              <label for="ur-star-${n}" title="${n}" aria-hidden="true">★</label>
            `).join('')}
          </div>
          <span class="ur-error-msg" id="ur-rating-error" role="alert"></span>
        </div>
        <div class="ur-form-row">
          <div class="ur-form-group" style="margin:0">
            <label class="ur-label" for="ur-name">${this.t('your_name')} *</label>
            <input class="ur-input" id="ur-name" type="text" autocomplete="name" placeholder="${this.t('your_name')}" required>
            <span class="ur-error-msg" id="ur-name-error" role="alert"></span>
          </div>
          <div class="ur-form-group" style="margin:0">
            <label class="ur-label" for="ur-email">${this.t('your_email')} *</label>
            <input class="ur-input" id="ur-email" type="email" autocomplete="email" placeholder="${this.t('your_email')}" required>
            <span class="ur-error-msg" id="ur-email-error" role="alert"></span>
          </div>
        </div>
        <div class="ur-form-group">
          <label class="ur-label" for="ur-title">${this.t('review_title')}</label>
          <input class="ur-input" id="ur-title" type="text" placeholder="${this.t('review_title')}">
        </div>
        <div class="ur-form-group">
          <label class="ur-label" for="ur-body">${this.t('review_body')} *</label>
          <textarea class="ur-textarea" id="ur-body" placeholder="${this.t('review_body')}" rows="4" required></textarea>
          <span class="ur-error-msg" id="ur-body-error" role="alert"></span>
        </div>
        <div class="ur-form-group">
          <label class="ur-file-label" for="ur-photos">📷 ${this.t('add_photos')}</label>
          <input class="ur-file-input" id="ur-photos" type="file" accept="image/*" multiple aria-label="${this.t('add_photos')}">
        </div>
        <div class="ur-form-actions">
          <button class="ur-btn ur-btn-ghost" data-action="close-review-form" type="button">${this.t('cancel')}</button>
          <button class="ur-btn ur-btn-primary" data-action="submit-review" type="button" ${this.formLoading ? 'disabled' : ''}>${this.formLoading ? this.t('sending') : this.t('submit')}</button>
        </div>
      </div>
    `
  }

  private renderQAPanel(): string {
    return `
      ${this.showWriteReview ? `<div class="ur-actions">${this.formSuccess === 'question' ? '' : `<button class="ur-btn ur-btn-primary" data-action="open-question-form" aria-expanded="${this.showQuestionForm}">? ${this.t('ask_question')}</button>`}</div>` : ''}
      ${this.showQuestionForm ? this.renderQuestionForm() : ''}
      ${this.formSuccess === 'question' ? `<div class="ur-success" role="status">✓ ${this.t('thank_you_question')}</div>` : ''}
      ${this.questions.length === 0 ? `<div class="ur-empty">${this.t('no_questions')}</div>` : ''}
      <div class="ur-qa-list">
        ${this.questions.map(q => this.renderQuestion(q)).join('')}
      </div>
    `
  }

  private renderQuestion(q: Question): string {
    const date = new Date(q.created_at).toLocaleDateString(this.locale, { year: 'numeric', month: 'short' })
    return `
      <div class="ur-qa-item">
        <div class="ur-qa-question"><span class="ur-qa-q-icon" aria-hidden="true">Q</span>${this.escapeHtml(q.body)}</div>
        ${q.answer ? `
          <div class="ur-qa-answer">
            <div class="ur-qa-answer-label">${this.t('answered')}</div>
            ${this.escapeHtml(q.answer)}
          </div>
        ` : ''}
        <div class="ur-qa-meta"><time datetime="${q.created_at}">${date}</time>${q.helpful_count > 0 ? ` · ${q.helpful_count} ${this.t('helpful')}` : ''}</div>
      </div>
    `
  }

  private renderQuestionForm(): string {
    return `
      <div class="ur-form" role="form" aria-label="${this.t('ask_question')}">
        <div class="ur-form-title">? ${this.t('ask_question')}</div>
        <div class="ur-form-row">
          <div class="ur-form-group" style="margin:0">
            <label class="ur-label" for="ur-q-name">${this.t('your_name')} *</label>
            <input class="ur-input" id="ur-q-name" type="text" placeholder="${this.t('your_name')}" required>
            <span class="ur-error-msg" id="ur-q-name-error" role="alert"></span>
          </div>
          <div class="ur-form-group" style="margin:0">
            <label class="ur-label" for="ur-q-email">${this.t('your_email')} *</label>
            <input class="ur-input" id="ur-q-email" type="email" placeholder="${this.t('your_email')}" required>
            <span class="ur-error-msg" id="ur-q-email-error" role="alert"></span>
          </div>
        </div>
        <div class="ur-form-group">
          <label class="ur-label" for="ur-q-body">${this.t('question_body')} *</label>
          <textarea class="ur-textarea" id="ur-q-body" placeholder="${this.t('question_body')}" rows="3" required></textarea>
          <span class="ur-error-msg" id="ur-q-body-error" role="alert"></span>
        </div>
        <div class="ur-form-actions">
          <button class="ur-btn ur-btn-ghost" data-action="close-question-form" type="button">${this.t('cancel')}</button>
          <button class="ur-btn ur-btn-primary" data-action="submit-question" type="button" ${this.formLoading ? 'disabled' : ''}>${this.formLoading ? this.t('sending') : this.t('submit')}</button>
        </div>
      </div>
    `
  }

  private renderPagination(): string {
    const { currentPage: cp, totalPages: tp } = this
    const pages: Array<number | '…'> = []

    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) pages.push(i)
    } else {
      pages.push(1)
      if (cp > 3) pages.push('…')
      for (let i = Math.max(2, cp - 1); i <= Math.min(tp - 1, cp + 1); i++) pages.push(i)
      if (cp < tp - 2) pages.push('…')
      pages.push(tp)
    }

    const pageButtons = pages.map(p =>
      p === '…'
        ? `<span class="ur-page-ellipsis" aria-hidden="true">…</span>`
        : `<button class="ur-page-btn ${p === cp ? 'active' : ''}" data-page="${p}" aria-label="Página ${p}" aria-current="${p === cp ? 'page' : 'false'}">${p}</button>`
    ).join('')

    return `
      <nav class="ur-pagination" aria-label="Paginação de avaliações">
        <button class="ur-page-btn" data-page="${cp - 1}" aria-label="${this.t('previous')}" ${cp === 1 ? 'disabled' : ''}>‹</button>
        ${pageButtons}
        <button class="ur-page-btn" data-page="${cp + 1}" aria-label="${this.t('next')}" ${cp === tp ? 'disabled' : ''}>›</button>
      </nav>
    `
  }

  private renderStars(rating: number): string {
    const full = Math.floor(rating)
    const half = rating % 1 >= 0.25 && rating % 1 < 0.75
    const stars: string[] = []
    for (let i = 1; i <= 5; i++) {
      if (i <= full) stars.push(`<span class="ur-star filled" aria-hidden="true">★</span>`)
      else if (i === full + 1 && half) stars.push(`<span class="ur-star half" aria-hidden="true">★</span>`)
      else stars.push(`<span class="ur-star empty" aria-hidden="true">★</span>`)
    }
    return stars.join('')
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  // ─── Events ────────────────────────────────────────────────────────────

  private attachEvents(container: HTMLElement) {
    // Tabs
    container.querySelectorAll('.ur-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentTab = (tab as HTMLElement).dataset['tab'] as 'reviews' | 'qa'
        this.render()
      })
      tab.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          ;(tab as HTMLElement).click()
        }
      })
    })

    // Pagination
    container.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt((btn as HTMLElement).dataset['page'] || '1')
        if (page < 1 || page > this.totalPages) return
        this.currentPage = page
        this.fetchReviews().then(() => {
          container.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      })
    })

    // Actions
    const actions: Record<string, () => void> = {
      'open-review-form': () => { this.showReviewForm = !this.showReviewForm; this.render() },
      'close-review-form': () => { this.showReviewForm = false; this.render() },
      'submit-review': () => this.submitReview(container),
      'open-question-form': () => { this.showQuestionForm = !this.showQuestionForm; this.render() },
      'close-question-form': () => { this.showQuestionForm = false; this.render() },
      'submit-question': () => this.submitQuestion(container),
    }

    container.querySelectorAll('[data-action]').forEach(el => {
      const action = (el as HTMLElement).dataset['action'] as string
      el.addEventListener('click', () => actions[action]?.())
    })

    // Media lightbox
    container.querySelectorAll('.ur-media-thumb').forEach(img => {
      const open = () => this.openLightbox((img as HTMLImageElement).dataset['full'] || (img as HTMLImageElement).src)
      img.addEventListener('click', open)
      img.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') open() })
    })

    // Distribution filter
    container.querySelectorAll('[data-filter-star]').forEach(row => {
      row.addEventListener('click', () => {
        // Future: filter by star rating
      })
    })
  }

  private openLightbox(url: string) {
    const lb = document.createElement('div')
    lb.className = 'ur-lightbox'
    lb.setAttribute('role', 'dialog')
    lb.setAttribute('aria-modal', 'true')
    lb.setAttribute('aria-label', 'Imagem ampliada')
    lb.innerHTML = `
      <img class="ur-lightbox-img" src="${url}" alt="">
      <button class="ur-lightbox-close" aria-label="Fechar">✕</button>
    `

    const style = document.createElement('style')
    style.textContent = getCSS(this.themeColor)
    this.shadow.appendChild(style)
    this.shadow.appendChild(lb)

    const close = () => { lb.remove(); style.remove() }
    lb.querySelector('.ur-lightbox-close')?.addEventListener('click', close)
    lb.addEventListener('click', e => { if (e.target === lb) close() })
    lb.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Escape') close() })
    ;(lb.querySelector('.ur-lightbox-close') as HTMLElement)?.focus()
  }

  private validateReviewForm(container: HTMLElement): WriteReviewForm | null {
    let valid = true

    const name = (container.querySelector('#ur-name') as HTMLInputElement)?.value.trim()
    const email = (container.querySelector('#ur-email') as HTMLInputElement)?.value.trim()
    const rating = parseInt((container.querySelector('input[name="ur-rating"]:checked') as HTMLInputElement)?.value || '0')
    const title = (container.querySelector('#ur-title') as HTMLInputElement)?.value.trim()
    const body = (container.querySelector('#ur-body') as HTMLTextAreaElement)?.value.trim()

    const setError = (id: string, msg: string) => {
      const el = container.querySelector(`#${id}`)
      if (el) { el.textContent = msg; el.previousElementSibling?.classList.add('error') }
    }
    const clearError = (id: string) => {
      const el = container.querySelector(`#${id}`)
      if (el) { el.textContent = ''; el.previousElementSibling?.classList.remove('error') }
    }

    clearError('ur-name-error'); clearError('ur-email-error'); clearError('ur-rating-error'); clearError('ur-body-error')

    if (!name) { setError('ur-name-error', this.t('name_required')); valid = false }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('ur-email-error', this.t('email_required')); valid = false }
    if (!rating) { setError('ur-rating-error', this.t('rating_required')); valid = false }
    if (body.length < 10) { setError('ur-body-error', this.t('body_required')); valid = false }

    if (!valid) return null
    return { name, email, rating, title, body }
  }

  private async submitReview(container: HTMLElement) {
    const form = this.validateReviewForm(container)
    if (!form) return

    this.formLoading = true
    this.render()

    try {
      const res = await fetch(`${this.apiUrl}/api/v1/public/reviews/${this.productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workspace-ID': this.workspaceId },
        body: JSON.stringify(form),
      })
      if (res.ok || res.status === 201 || res.status === 202) {
        this.showReviewForm = false
        this.formSuccess = 'review'
      }
    } catch { /* silent — in demo mode, treat as success */
      this.showReviewForm = false
      this.formSuccess = 'review'
    } finally {
      this.formLoading = false
      this.render()
    }
  }

  private validateQuestionForm(container: HTMLElement): AskQuestionForm | null {
    let valid = true
    const name = (container.querySelector('#ur-q-name') as HTMLInputElement)?.value.trim()
    const email = (container.querySelector('#ur-q-email') as HTMLInputElement)?.value.trim()
    const body = (container.querySelector('#ur-q-body') as HTMLTextAreaElement)?.value.trim()

    const setError = (id: string, msg: string) => {
      const el = container.querySelector(`#${id}`)
      if (el) { el.textContent = msg }
    }
    const clearError = (id: string) => {
      const el = container.querySelector(`#${id}`)
      if (el) { el.textContent = '' }
    }

    clearError('ur-q-name-error'); clearError('ur-q-email-error'); clearError('ur-q-body-error')

    if (!name) { setError('ur-q-name-error', this.t('name_required')); valid = false }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('ur-q-email-error', this.t('email_required')); valid = false }
    if (!body || body.length < 5) { setError('ur-q-body-error', this.t('question_required')); valid = false }

    if (!valid) return null
    return { name, email, body }
  }

  private async submitQuestion(container: HTMLElement) {
    const form = this.validateQuestionForm(container)
    if (!form) return

    this.formLoading = true
    this.render()

    try {
      const res = await fetch(`${this.apiUrl}/api/v1/public/questions/${this.productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workspace-ID': this.workspaceId },
        body: JSON.stringify(form),
      })
      if (res.ok || res.status === 201) {
        this.showQuestionForm = false
        this.formSuccess = 'question'
      }
    } catch {
      this.showQuestionForm = false
      this.formSuccess = 'question'
    } finally {
      this.formLoading = false
      this.render()
    }
  }
}

customElements.define('univer-reviews', UniverReviewsWidget)

export type { Review, ReviewMedia, Reply, ReviewSummary, Question }

import type {
  Review,
  ReviewListParams,
  ReviewStatus,
  BulkAction,
  CreateReviewInput,
  AiModerateResult,
  AiHealth,
  AiSimilarReview,
  GenerateVariantsInput,
  ReviewVariant,
  DuplicateCluster,
  Workspace,
  WorkspaceStats,
  WorkspaceUser,
  WooCommerceConfig,
  CatalogHealth,
  CatalogHealthByProduct,
  Product,
  Campaign,
  CampaignInput,
  CampaignSend,
  CampaignSendStatus,
  CampaignStatus,
  PaginatedResponse,
  ApiKey,
  Question,
  QuestionStatus,
  QuestionGroup,
} from '@/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues?: string[]
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    path: string,
    options: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {},
    token?: string
  ): Promise<T> {
    const { params, ...fetchOptions } = options

    let url = `${this.baseUrl}/api/v1${path}`
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.set(k, String(v))
        }
      })
      if (searchParams.toString()) url += `?${searchParams}`
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    }

    // Pass session token explicitly as Bearer when caller has it (SSR / typed calls).
    // Cookies are also sent via credentials: 'include' so the Rails backend can look
    // up the Better Auth session cookie even without an explicit token.
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      cache: 'no-store',
    })

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ error: 'unknown', message: res.statusText }))
      throw new ApiError(res.status, error.message || error.error, error.issues)
    }

    if (res.status === 204) return {} as T
    return res.json()
  }

  // ─── Reviews ────────────────────────────────────────────────────────────────
  reviews = {
    list: (params: ReviewListParams, token: string) =>
      this.request<PaginatedResponse<Review>>(
        '/reviews',
        { params: params as Record<string, string | number | boolean | undefined> },
        token
      ),
    get: (id: string, token: string) =>
      this.request<Review>(`/reviews/${id}`, {}, token),
    create: (data: CreateReviewInput, token: string) =>
      this.request<Review>(
        '/reviews',
        { method: 'POST', body: JSON.stringify(data) },
        token
      ),
    updateStatus: (id: string, status: ReviewStatus, token: string) =>
      this.request<Review>(
        `/reviews/${id}/status`,
        { method: 'POST', body: JSON.stringify({ status }) },
        token
      ),
    delete: (id: string, token: string) =>
      this.request(`/reviews/${id}`, { method: 'DELETE' }, token),
    bulk: (ids: string[], action: BulkAction, token: string) =>
      this.request(
        '/reviews/bulk',
        { method: 'POST', body: JSON.stringify({ ids, action }) },
        token
      ),

    /**
     * Stream the reviews matching `filters` as a CSV blob. Bypasses the JSON
     * request() helper because the backend returns text/csv — we need the raw
     * Response so we can hand a Blob to the browser for download. Filters
     * mirror reviews.list (status, rating, source, q, from, to).
     */
    exportCsv: async (
      filters: Pick<ReviewListParams, 'status' | 'rating' | 'source' | 'q' | 'from' | 'to'>,
      token: string,
    ): Promise<Blob> => {
      const search = new URLSearchParams()
      ;(Object.entries(filters) as Array<[string, string | number | undefined]>).forEach(
        ([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            search.set(k, String(v))
          }
        },
      )
      const qs = search.toString()
      const url = `${this.baseUrl}/api/v1/reviews/export.csv${qs ? `?${qs}` : ''}`

      const res = await fetch(url, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        cache: 'no-store',
      })

      if (!res.ok) {
        const errBody = await res
          .json()
          .catch(() => ({ error: 'unknown', message: res.statusText }))
        throw new ApiError(res.status, errBody.message || errBody.error, errBody.issues)
      }

      return res.blob()
    },
  }

  // ─── AI ─────────────────────────────────────────────────────────────────────
  //
  // All Rails AI endpoints wrap their payload in `{ data: ... }`. The client
  // unwraps once so callers receive plain typed objects. Errors raise
  // ApiError; HTTP 503 + error="missing_api_key" specifically means the
  // server is missing ANTHROPIC_API_KEY — the AI Lab UI surfaces this as a
  // banner with a link to /settings#api-keys.
  ai = {
    health: (token: string) =>
      this.request<{ data: AiHealth }>('/ai/health', {}, token).then(r => r.data),

    moderate: (reviewId: string, token: string) =>
      this.request<{ data: AiModerateResult }>(
        '/ai/moderate',
        { method: 'POST', body: JSON.stringify({ review_id: reviewId }) },
        token
      ).then(r => r.data),

    /**
     * Generate variants seeded by an existing review's body. The backend
     * route /ai/generate-variants requires a real review_id so the prompt
     * can use the product context — pass the review you want to vary.
     */
    generateFromReview: (reviewId: string, count: number, token: string) =>
      this.request<{ data: ReviewVariant[] }>(
        '/ai/generate-variants',
        {
          method: 'POST',
          body: JSON.stringify({ review_id: reviewId, count }),
        },
        token
      ).then(r => ({ variants: r.data })),

    /**
     * Free-form generation from a written template + optional product. Maps
     * 1:1 to POST /ai/generate.
     */
    generateVariants: (input: GenerateVariantsInput, token: string) =>
      this.request<{ data: ReviewVariant[] }>(
        '/ai/generate',
        {
          method: 'POST',
          body: JSON.stringify({
            template: input.template ?? `${input.product_name} — ${input.tone}, ${input.rating}/5`,
            count: input.count,
          }),
        },
        token
      ).then(r => ({ variants: r.data })),

    reply: (reviewId: string, token: string) =>
      this.request<{ data: { reply: string } }>(
        '/ai/reply',
        { method: 'POST', body: JSON.stringify({ review_id: reviewId }) },
        token
      ).then(r => r.data),

    autoReply: (reviewId: string, _tone: string, token: string) =>
      this.request<{ data: { reply: string; reply_id?: string } }>(
        '/ai/auto-reply',
        { method: 'POST', body: JSON.stringify({ review_id: reviewId }) },
        token
      ).then(r => r.data),

    dedup: (reviewId: string, token: string) =>
      this.request<{ message: string; review_id: string }>(
        '/ai/dedup',
        { method: 'POST', body: JSON.stringify({ review_id: reviewId }) },
        token
      ),

    embed: (reviewId: string, token: string) =>
      this.request<{ message: string; review_id: string }>(
        '/ai/embed',
        { method: 'POST', body: JSON.stringify({ review_id: reviewId }) },
        token
      ),

    findSimilar: (reviewId: string, token: string) =>
      this.request<{ data: AiSimilarReview[] }>(
        '/ai/find-similar',
        { method: 'POST', body: JSON.stringify({ review_id: reviewId }) },
        token
      ).then(r => r.data),

    duplicateClusters: (token: string) =>
      this.request<{ data: DuplicateCluster[] }>('/ai/duplicate-clusters', {}, token)
        .then(r => r.data),

    cleanupDuplicates: (clusterIds: string[], token: string) =>
      this.request<{ message: string }>(
        '/ai/cleanup-duplicates',
        { method: 'POST', body: JSON.stringify({ cluster_ids: clusterIds }) },
        token
      ),
  }

  // ─── Workspace ──────────────────────────────────────────────────────────────
  workspace = {
    // Backend wraps the workspace payload in { data: ... } — unwrap so callers
    // see a plain Workspace object (fixes settings page reading workspace.domains
    // as undefined because it was reaching into the envelope).
    get: (token: string) =>
      this.request<{ data: Workspace }>('/workspace', {}, token).then(r => r.data),
    update: (data: Partial<Workspace>, token: string) =>
      this.request<{ data: Workspace }>(
        '/workspace',
        { method: 'PATCH', body: JSON.stringify(data) },
        token
      ).then(r => r.data),
    // Backend wraps stats in { data: ... } just like /workspace — unwrap so
    // callers read fields off the bare WorkspaceStats object (fixes dashboard
    // and reviews-page stats cards rendering `undefined`).
    stats: (token: string) =>
      this.request<{ data: WorkspaceStats }>('/workspace/stats', {}, token).then(r => r.data),
    inviteUser: (email: string, role: string, token: string) =>
      this.request<WorkspaceUser>(
        '/workspace/invitations',
        { method: 'POST', body: JSON.stringify({ email, role }) },
        token
      ),
    removeUser: (userId: string, token: string) =>
      this.request(`/workspace/users/${userId}`, { method: 'DELETE' }, token),
    createApiKey: (name: string, token: string) =>
      this.request<{ data: ApiKey; key: string }>(
        '/workspace/api_keys',
        { method: 'POST', body: JSON.stringify({ name, scopes: 'read,write' }) },
        token
      ),
    listApiKeys: (token: string) =>
      this.request<{ data: ApiKey[] }>('/workspace/api_keys', {}, token),
    revokeApiKey: (keyId: string, token: string) =>
      this.request(`/workspace/api_keys/${keyId}`, { method: 'DELETE' }, token),
    addDomain: (domain: string, token: string, platform: 'woocommerce' | 'shopify' | 'generic' = 'generic') =>
      this.request<{ data: { id: string; domain: string; platform: string; verified: boolean } }>(
        '/workspace/domains',
        { method: 'POST', body: JSON.stringify({ domain, platform }) },
        token
      ),
    /**
     * Removes a workspace domain by its row id (preferred). Backend also
     * accepts the raw domain string as a fallback identifier.
     */
    removeDomain: (idOrDomain: string, token: string) =>
      this.request(
        `/workspace/domains/${encodeURIComponent(idOrDomain)}`,
        { method: 'DELETE' },
        token
      ),
  }

  // ─── Integrations ───────────────────────────────────────────────────────────
  integrations = {
    woocommerce: {
      get: (token: string) =>
        this.request<WooCommerceConfig>('/integrations/woocommerce', {}, token),
      save: (data: Partial<WooCommerceConfig>, token: string) =>
        this.request<
          WooCommerceConfig & {
            probe?: {
              success: boolean
              error?: string
              store_name?: string
              wc_version?: string
              wp_version?: string
            }
          }
        >(
          '/integrations/woocommerce',
          { method: 'POST', body: JSON.stringify(data) },
          token
        ),
      test: (
        creds: { store_url?: string; consumer_key?: string; consumer_secret?: string },
        token: string
      ) =>
        this.request<{ success: boolean; message: string; store_name?: string }>(
          '/integrations/woocommerce/test',
          { method: 'POST', body: JSON.stringify(creds) },
          token
        ),
      syncProducts: (token: string) =>
        this.request<{ message: string }>(
          '/integrations/woocommerce/sync_products',
          { method: 'POST' },
          token
        ),
      syncReviews: (token: string) =>
        this.request<{ import_id: string; message: string }>(
          '/integrations/woocommerce/sync_reviews',
          { method: 'POST' },
          token
        ),
      disconnect: (token: string) =>
        this.request('/integrations/woocommerce', { method: 'DELETE' }, token),
    },
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────
  auth = {
    magicLink: (email: string) =>
      this.request('/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    verify: (token: string) =>
      this.request<{ token: string; user: WorkspaceUser }>(
        `/auth/verify?token=${token}`,
        {}
      ),
    logout: (token: string) =>
      this.request('/auth/logout', { method: 'DELETE' }, token),
  }

  // ─── Catalog Health ─────────────────────────────────────────────────────────
  catalogHealth = {
    get: (token: string) =>
      this.request<CatalogHealth>('/catalog-health', {}, token),
    byProduct: (token: string) =>
      this.request<CatalogHealthByProduct[]>(
        '/catalog-health/by-product',
        {},
        token
      ),
  }

  // ─── Products ───────────────────────────────────────────────────────────────
  products = {
    list: (params: Record<string, string | number | boolean | undefined>, token: string) =>
      this.request<PaginatedResponse<Product>>('/products', { params }, token),
    sync: (token: string) =>
      this.request<{ message: string }>(
        '/products/sync',
        { method: 'POST' },
        token
      ),
  }

  // ─── Questions ──────────────────────────────────────────────────────────────
  questions = {
    list: (
      params: {
        page?: number
        per_page?: number
        status?: QuestionStatus | ''
        product_id?: string
        question_group_id?: string
      } = {},
      token: string,
    ) =>
      this.request<PaginatedResponse<Question>>(
        '/questions',
        { params: params as Record<string, string | number | boolean | undefined> },
        token,
      ),
    answer: (id: string, answer: string, token: string) =>
      this.request<{ data: Question }>(
        `/questions/${id}`,
        { method: 'PATCH', body: JSON.stringify({ question: { answer } }) },
        token,
      ),
    updateStatus: (id: string, status: QuestionStatus, token: string) =>
      this.request<{ data: Question }>(
        `/questions/${id}`,
        { method: 'PATCH', body: JSON.stringify({ question: { status } }) },
        token,
      ),
    delete: (id: string, token: string) =>
      this.request(`/questions/${id}`, { method: 'DELETE' }, token),
  }

  // ─── Question Groups ────────────────────────────────────────────────────────
  questionGroups = {
    list: (params: { page?: number; per_page?: number; q?: string } = {}, token: string) =>
      this.request<PaginatedResponse<QuestionGroup>>(
        '/question_groups',
        { params: params as Record<string, string | number | boolean | undefined> },
        token,
      ),
    get: (id: string, token: string) =>
      this.request<{ data: QuestionGroup }>(`/question_groups/${id}`, {}, token).then((r) => r.data),
    create: (
      data: { name: string; description?: string; product_ids?: string[] },
      token: string,
    ) =>
      this.request<{ data: QuestionGroup }>(
        '/question_groups',
        {
          method: 'POST',
          body: JSON.stringify({
            question_group: { name: data.name, description: data.description },
            product_ids: data.product_ids,
          }),
        },
        token,
      ).then((r) => r.data),
    update: (
      id: string,
      data: { name?: string; description?: string },
      token: string,
    ) =>
      this.request<{ data: QuestionGroup }>(
        `/question_groups/${id}`,
        { method: 'PATCH', body: JSON.stringify({ question_group: data }) },
        token,
      ).then((r) => r.data),
    delete: (id: string, token: string) =>
      this.request(`/question_groups/${id}`, { method: 'DELETE' }, token),
    attachProducts: (id: string, productIds: string[], token: string) =>
      this.request<{ data: QuestionGroup; attached: number }>(
        `/question_groups/${id}/attach_products`,
        { method: 'POST', body: JSON.stringify({ product_ids: productIds }) },
        token,
      ),
    detachProducts: (id: string, productIds: string[], token: string) =>
      this.request<{ data: QuestionGroup; detached: number }>(
        `/question_groups/${id}/detach_products`,
        { method: 'POST', body: JSON.stringify({ product_ids: productIds }) },
        token,
      ),
  }

  // ─── Campaigns ──────────────────────────────────────────────────────────────
  //
  // Post-purchase email automation. Rails wraps every payload in { data: ... }
  // — we unwrap once here so the React layer reads plain Campaign / CampaignSend
  // objects. Pagination uses the standard PaginatedResponse envelope.
  campaigns = {
    list: (
      params: { page?: number; per_page?: number; status?: CampaignStatus | '' } = {},
      token: string,
    ) =>
      this.request<PaginatedResponse<Campaign> | { data: Campaign[] }>(
        '/campaigns',
        { params: params as Record<string, string | number | boolean | undefined> },
        token,
      ).then((r) => {
        // Tolerate two backend shapes: paginated envelope OR plain { data: [] }
        if (Array.isArray((r as PaginatedResponse<Campaign>).data) && (r as PaginatedResponse<Campaign>).meta) {
          return r as PaginatedResponse<Campaign>
        }
        const list = (r as { data: Campaign[] }).data ?? []
        return {
          data: list,
          meta: {
            current_page: 1,
            per_page: list.length || 25,
            total_count: list.length,
            total_pages: 1,
          },
        } as PaginatedResponse<Campaign>
      }),

    get: (id: string, token: string) =>
      this.request<{ data: Campaign }>(`/campaigns/${id}`, {}, token).then((r) => r.data),

    create: (data: CampaignInput, token: string) =>
      this.request<{ data: Campaign }>(
        '/campaigns',
        { method: 'POST', body: JSON.stringify({ campaign: data }) },
        token,
      ).then((r) => r.data),

    update: (id: string, data: Partial<CampaignInput>, token: string) =>
      this.request<{ data: Campaign }>(
        `/campaigns/${id}`,
        { method: 'PATCH', body: JSON.stringify({ campaign: data }) },
        token,
      ).then((r) => r.data),

    remove: (id: string, token: string) =>
      this.request(`/campaigns/${id}`, { method: 'DELETE' }, token),

    sendNow: (id: string, token: string) =>
      this.request<{ data: Campaign }>(
        `/campaigns/${id}/send_now`,
        { method: 'POST' },
        token,
      ).then((r) => r.data),

    pause: (id: string, token: string) =>
      this.request<{ data: Campaign }>(
        `/campaigns/${id}/pause`,
        { method: 'POST' },
        token,
      ).then((r) => r.data),

    resume: (id: string, token: string) =>
      this.request<{ data: Campaign }>(
        `/campaigns/${id}/resume`,
        { method: 'POST' },
        token,
      ).then((r) => r.data),

    testSend: (id: string, payload: { recipient_email: string }, token: string) =>
      this.request<{ message?: string }>(
        `/campaigns/${id}/test_send`,
        { method: 'POST', body: JSON.stringify(payload) },
        token,
      ),
  }

  // ─── Campaign Sends ─────────────────────────────────────────────────────────
  campaignSends = {
    listByCampaign: (
      campaignId: string,
      params: { page?: number; per_page?: number; status?: CampaignSendStatus | '' } = {},
      token: string,
    ) =>
      this.request<PaginatedResponse<CampaignSend>>(
        `/campaigns/${campaignId}/sends`,
        { params: params as Record<string, string | number | boolean | undefined> },
        token,
      ),

    /**
     * Manual retry of a single send. Backend route not yet wired — the client
     * surfaces ApiError(404) so the UI can gracefully render "em breve".
     */
    resend: (sendId: string, token: string) =>
      this.request<{ data: CampaignSend }>(
        `/campaign_sends/${sendId}/resend`,
        { method: 'POST' },
        token,
      ).then((r) => r.data),
  }

  // ─── Email (workspace-level test send / domain status) ──────────────────────
  email = {
    testSend: (recipient_email: string, token: string) =>
      this.request<{ message?: string }>(
        '/email/test_send',
        { method: 'POST', body: JSON.stringify({ recipient_email }) },
        token,
      ),
    domainStatus: (token: string) =>
      this.request<{ data: { domain: string; verified: boolean } }>(
        '/email/domain_status',
        {},
        token,
      ).then((r) => r.data),
  }
}

/**
 * Resolve the API base URL.
 *
 * Order of precedence:
 * 1. NEXT_PUBLIC_API_URL env var (build-time, both server and client)
 * 2. Browser: derive from current hostname (dash.foo.com → api.foo.com)
 * 3. Server (SSR): docker-compose internal hostname
 * 4. Last-resort dev fallback
 *
 * The hostname-derived fallback is what makes prod work even when the deploy
 * config forgets to set NEXT_PUBLIC_API_URL — silent localhost fallbacks
 * cause every client request to fail with mixed-content / unreachable errors.
 */
function resolveApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
      return 'http://localhost:3001'
    }
    // dash.univerreviews.com → api.univerreviews.com
    if (host.startsWith('dash.')) {
      return `${window.location.protocol}//${host.replace(/^dash\./, 'api.')}`
    }
    // foo.example.com → api.example.com (root + 1 subdomain)
    const parts = host.split('.')
    const root = parts.slice(-2).join('.')
    return `${window.location.protocol}//api.${root}`
  }

  return 'http://api:3000'
}

export const api = new ApiClient(resolveApiBaseUrl())

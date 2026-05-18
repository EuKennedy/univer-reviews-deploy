import type {
  Review,
  ReviewListParams,
  ReviewStatus,
  BulkAction,
  CreateReviewInput,
  AiModerateResult,
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
  PaginatedResponse,
  ApiKey,
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
  }

  // ─── AI ─────────────────────────────────────────────────────────────────────
  ai = {
    moderate: (reviewId: string, token: string) =>
      this.request<AiModerateResult>(
        '/ai/moderate',
        { method: 'POST', body: JSON.stringify({ review_id: reviewId }) },
        token
      ),
    generateVariants: (input: GenerateVariantsInput, token: string) =>
      this.request<{ variants: ReviewVariant[] }>(
        '/ai/generate-variants',
        { method: 'POST', body: JSON.stringify(input) },
        token
      ),
    autoReply: (reviewId: string, tone: string, token: string) =>
      this.request<{ reply: string }>(
        '/ai/auto-reply',
        { method: 'POST', body: JSON.stringify({ review_id: reviewId, tone }) },
        token
      ),
    duplicateClusters: (token: string) =>
      this.request<DuplicateCluster[]>('/ai/duplicate-clusters', {}, token),
    cleanupDuplicates: (limit: number, token: string) =>
      this.request<{ job_id: string }>(
        '/ai/cleanup-duplicates',
        { method: 'POST', body: JSON.stringify({ limit }) },
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
    stats: (token: string) =>
      this.request<WorkspaceStats>('/workspace/stats', {}, token),
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

  // ─── Campaigns ──────────────────────────────────────────────────────────────
  campaigns = {
    list: (token: string) =>
      this.request<Campaign[]>('/campaigns', {}, token),
    get: (id: string, token: string) =>
      this.request<Campaign>(`/campaigns/${id}`, {}, token),
    create: (data: Partial<Campaign>, token: string) =>
      this.request<Campaign>(
        '/campaigns',
        { method: 'POST', body: JSON.stringify(data) },
        token
      ),
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

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
    get: (token: string) => this.request<Workspace>('/workspace', {}, token),
    update: (data: Partial<Workspace>, token: string) =>
      this.request<Workspace>(
        '/workspace',
        { method: 'PATCH', body: JSON.stringify(data) },
        token
      ),
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
      this.request<ApiKey & { key: string }>(
        '/workspace/api-keys',
        { method: 'POST', body: JSON.stringify({ name }) },
        token
      ),
    listApiKeys: (token: string) =>
      this.request<ApiKey[]>('/workspace/api-keys', {}, token),
    revokeApiKey: (keyId: string, token: string) =>
      this.request(`/workspace/api-keys/${keyId}`, { method: 'DELETE' }, token),
    addDomain: (domain: string, token: string) =>
      this.request<Workspace>(
        '/workspace/domains',
        { method: 'POST', body: JSON.stringify({ domain }) },
        token
      ),
    removeDomain: (domain: string, token: string) =>
      this.request(
        `/workspace/domains/${encodeURIComponent(domain)}`,
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
        this.request<WooCommerceConfig>(
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

export const api = new ApiClient(
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    : process.env.NEXT_PUBLIC_API_URL || 'http://api:3000'
)

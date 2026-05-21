'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Package, ExternalLink, RefreshCw, Loader2 } from 'lucide-react'
import { ProductReviewActions } from '@/components/products/ProductReviewActions'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { StatsBar } from '@/components/godmode/StatsBar'
import { Toolbar, SearchInput } from '@/components/godmode/Toolbar'
import { DataTable } from '@/components/godmode/DataTable'
import { Pagination } from '@/components/godmode/Pagination'
import { RatingStars } from '@/components/reviews/RatingStars'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatNumber } from '@/lib/utils'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import type { Product } from '@/types'

const col = createColumnHelper<Product>()

const columns = [
  col.accessor('name', {
    header: 'Produto',
    cell: (info) => (
      <div className="flex items-center gap-2.5">
        {info.row.original.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.row.original.image_url}
            alt=""
            className="w-8 h-8 rounded-lg object-cover"
            style={{ border: '1px solid var(--ur-border-strong)' }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--ur-surface-soft)' }}
          >
            <Package className="w-4 h-4" style={{ color: 'var(--ur-text-muted)' }} />
          </div>
        )}
        <span className="ur-label" style={{ color: 'var(--ur-text)' }}>
          {info.getValue()}
        </span>
      </div>
    ),
  }),
  col.accessor('review_count', {
    header: 'Avaliações',
    cell: (info) => (
      <span className="ur-body tabular-nums">
        {formatNumber(info.getValue())}
      </span>
    ),
  }),
  col.accessor('avg_rating', {
    header: 'Nota média',
    cell: (info) => {
      const raw = info.getValue()
      const num = raw == null ? null : Number(raw)
      if (num === null || Number.isNaN(num)) {
        return <span style={{ color: 'var(--ur-text-muted)' }}>—</span>
      }
      return <RatingStars rating={num} size="xs" showValue />
    },
  }),
  col.accessor('price', {
    header: 'Preço',
    cell: (info) => {
      const raw = info.getValue()
      const num = raw == null ? null : Number(raw)
      if (num === null || Number.isNaN(num)) {
        return <span style={{ color: 'var(--ur-text-muted)' }}>—</span>
      }
      return (
        <span className="ur-body-soft tabular-nums">
          {info.row.original.currency} {num.toFixed(2)}
        </span>
      )
    },
  }),
  col.accessor('source', {
    header: 'Origem',
    cell: (info) => (
      <span
        className="ur-caption px-2 py-0.5 rounded-full"
        style={{ background: 'var(--ur-surface-soft)', border: '1px solid var(--ur-border)' }}
      >
        {info.getValue()}
      </span>
    ),
  }),
  col.display({
    id: 'actions',
    header: 'Ações',
    cell: ({ row }) => (
      <div className="flex items-center gap-2 justify-end">
        <ProductReviewActions product={row.original} />
        {row.original.external_id ? (
          <button
            type="button"
            className="p-1.5 rounded"
            style={{ color: 'var(--ur-text-muted)' }}
            aria-label={`Abrir ${row.original.name} no WooCommerce`}
            title="Abrir no WooCommerce"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    ),
  }),
]

export default function ProductsPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['products', workspace, page, search],
    queryFn: () =>
      api.products.list({ page, per_page: 20, q: search || undefined }, getToken()),
    enabled: isAuthenticated,
  })

  const syncMutation = useMutation({
    mutationFn: () => api.products.sync(getToken()),
    onSuccess: () => {
      toast.success('Sincronização enfileirada — recarregue em alguns segundos')
      // Poll for updates over the next 30s
      const start = Date.now()
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['products', workspace] })
        if (Date.now() - start > 30_000) clearInterval(interval)
      }, 5_000)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha na sincronização'
      toast.error(msg)
    },
  })

  const statsItems = [
    { label: 'Total de produtos', value: formatNumber(data?.meta.total_count ?? 0) },
    { label: 'Com avaliações', value: '—' },
    { label: 'Nota média', value: '—' },
    { label: 'Média de avaliações', value: '—' },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Package className="w-5 h-5" />}
        title="Produtos"
        subtitle="Gerencie seu catálogo e a saúde das avaliações"
        actions={
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] sm:min-h-0"
            style={{
              background: 'var(--ur-accent-soft)',
              border: '1px solid var(--ur-accent-soft-3)',
              color: 'var(--ur-accent)',
            }}
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Sincronizar do WooCommerce
          </button>
        }
      />

      <StatsBar stats={statsItems} isLoading={isLoading} />

      <Toolbar
        left={
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Buscar produtos…"
          />
        }
        right={
          <span className="ur-meta">
            {data?.meta.total_count ?? 0} produtos
          </span>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        <DataTable
          data={data?.data ?? []}
          columns={columns as ColumnDef<Product, unknown>[]}
          isLoading={isLoading}
          getRowId={(row) => row.id}
        />
        {data && (
          <Pagination
            currentPage={data.meta.current_page}
            totalPages={data.meta.total_pages}
            totalCount={data.meta.total_count}
            perPage={data.meta.per_page}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}

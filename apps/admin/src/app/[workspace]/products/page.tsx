'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Package, ExternalLink } from 'lucide-react'
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
            style={{ border: '1px solid #2a2a2d' }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: '#1a1a1d' }}
          >
            <Package className="w-4 h-4" style={{ color: '#5a5a64' }} />
          </div>
        )}
        <span className="text-sm font-medium" style={{ color: '#f0f0f2' }}>
          {info.getValue()}
        </span>
      </div>
    ),
  }),
  col.accessor('review_count', {
    header: 'Avaliações',
    cell: (info) => (
      <span className="text-sm tabular-nums" style={{ color: '#f0f0f2' }}>
        {formatNumber(info.getValue())}
      </span>
    ),
  }),
  col.accessor('avg_rating', {
    header: 'Nota média',
    cell: (info) =>
      info.getValue() !== null ? (
        <RatingStars rating={info.getValue()!} size="xs" showValue />
      ) : (
        <span style={{ color: '#5a5a64' }}>—</span>
      ),
  }),
  col.accessor('price', {
    header: 'Preço',
    cell: (info) =>
      info.getValue() !== null ? (
        <span className="text-sm tabular-nums" style={{ color: '#8b8b96' }}>
          {info.row.original.currency}{' '}
          {info.getValue()!.toFixed(2)}
        </span>
      ) : (
        <span style={{ color: '#5a5a64' }}>—</span>
      ),
  }),
  col.accessor('source', {
    header: 'Origem',
    cell: (info) => (
      <span
        className="text-xs px-2 py-0.5 rounded-full"
        style={{ background: '#1a1a1d', color: '#5a5a64', border: '1px solid #2a2a2d' }}
      >
        {info.getValue()}
      </span>
    ),
  }),
  col.display({
    id: 'actions',
    header: '',
    cell: ({ row }) =>
      row.original.external_id ? (
        <button className="p-1.5 rounded" style={{ color: '#5a5a64' }}>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      ) : null,
  }),
]

export default function ProductsPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['products', workspace, page, search],
    queryFn: () =>
      api.products.list({ page, per_page: 20, q: search || undefined }, getToken()),
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
          <span className="text-xs" style={{ color: '#5a5a64' }}>
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

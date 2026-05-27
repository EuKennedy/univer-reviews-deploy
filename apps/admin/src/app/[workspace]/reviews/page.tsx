'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import {
  Star,
  Download,
  CheckCircle2,
  XCircle,
  Trash2,
  MessageSquare,
  Eye,
  EyeOff,
  ChevronRight,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { createColumnHelper, type RowSelectionState, type ColumnDef } from '@tanstack/react-table'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/godmode/PageHeader'
import { StatsBar } from '@/components/godmode/StatsBar'
import { Toolbar, SearchInput, FilterSelect, ActionButton } from '@/components/godmode/Toolbar'
import { DataTable } from '@/components/godmode/DataTable'
import { Pagination } from '@/components/godmode/Pagination'
import { StatusBadge } from '@/components/reviews/StatusBadge'
import { RatingStars } from '@/components/reviews/RatingStars'
import { ReviewDrawer } from '@/components/reviews/ReviewDrawer'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatNumber, truncate, getInitials } from '@/lib/utils'
import type { Review, ReviewStatus, BulkAction } from '@/types'
import Link from 'next/link'

const columnHelper = createColumnHelper<Review>()

const statusOptions = [
  { value: 'pending', label: 'Pendente' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Rejeitado' },
  { value: 'hidden', label: 'Oculto' },
  { value: 'spam', label: 'Spam' },
]

const sourceOptions = [
  { value: 'widget', label: 'Widget' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'api', label: 'API' },
  { value: 'import', label: 'Importação' },
]

const ratingOptions = [
  { value: '5', label: '5 estrelas' },
  { value: '4', label: '4 estrelas' },
  { value: '3', label: '3 estrelas' },
  { value: '2', label: '2 estrelas' },
  { value: '1', label: '1 estrela' },
]

export default function ReviewsPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [rating, setRating] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [slidePanel, setSlidePanel] = useState<Review | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const queryParams = {
    page,
    per_page: 20,
    q: search || undefined,
    status: (status as ReviewStatus) || undefined,
    source: source as Review['source'] || undefined,
    rating: rating ? Number(rating) : undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', workspace, queryParams],
    queryFn: () => api.reviews.list(queryParams, getToken()),
  })

  const { data: statsData } = useQuery({
    queryKey: ['reviews-stats', workspace],
    queryFn: () => api.workspace.stats(getToken()),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
      api.reviews.updateStatus(id, status, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      toast.success('Status atualizado')
    },
    onError: () => toast.error('Falha ao atualizar status'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.reviews.delete(id, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      toast.success('Avaliação excluída')
    },
    onError: () => toast.error('Falha ao excluir avaliação'),
  })

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkAction }) =>
      api.reviews.bulk(ids, action, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      setRowSelection({})
      toast.success('Ação em massa aplicada')
    },
    onError: () => toast.error('Falha na ação em massa'),
  })

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])

  const handleBulk = useCallback(
    (action: BulkAction) => {
      if (!selectedIds.length) return
      bulkMutation.mutate({ ids: selectedIds, action })
    },
    [selectedIds, bulkMutation]
  )

  const handleExportCsv = useCallback(async () => {
    if (isExporting) return
    setIsExporting(true)
    const dismiss = toast.loading('Preparando CSV…')
    try {
      const blob = await api.reviews.exportCsv(
        {
          status: (status as ReviewStatus) || undefined,
          source: (source as Review['source']) || undefined,
          rating: rating ? Number(rating) : undefined,
          q: search || undefined,
        },
        getToken(),
      )

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `reviews-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke after the click handler has consumed the URL.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0)

      toast.dismiss(dismiss)
      toast.success('CSV exportado')
    } catch (err) {
      toast.dismiss(dismiss)
      const message = err instanceof Error ? err.message : 'Falha ao exportar CSV'
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }, [isExporting, status, source, rating, search, getToken])

  const columns = [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="w-3.5 h-3.5 rounded"
          style={{ accentColor: 'var(--ur-accent)' }}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded"
          style={{ accentColor: 'var(--ur-accent)' }}
        />
      ),
      size: 40,
      enableSorting: false,
    }),
    columnHelper.accessor('author_name', {
      header: 'Autor',
      cell: (info) => {
        const review = info.row.original
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--ur-accent-soft)', color: 'var(--ur-accent)' }}
            >
              {getInitials(info.getValue())}
            </div>
            <div>
              <p className="ur-label" style={{ color: 'var(--ur-text)' }}>
                {info.getValue()}
              </p>
              {review.verified_purchase && (
                <p className="ur-caption" style={{ color: 'var(--ur-success)' }}>
                  Verificado
                </p>
              )}
            </div>
          </div>
        )
      },
    }),
    columnHelper.accessor('rating', {
      header: 'Nota',
      cell: (info) => (
        <RatingStars rating={info.getValue()} size="xs" showValue />
      ),
      size: 120,
    }),
    columnHelper.accessor('product_name', {
      header: 'Produto',
      cell: (info) => (
        <span className="ur-body-soft">{info.getValue() ?? '—'}</span>
      ),
    }),
    columnHelper.accessor('body', {
      header: 'Avaliação',
      cell: (info) => (
        <p className="ur-body-soft max-w-xs">
          {truncate(info.getValue(), 80)}
        </p>
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} size="sm" />,
      size: 100,
    }),
    columnHelper.accessor('source', {
      header: 'Origem',
      cell: (info) => (
        <span
          className="ur-caption px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--ur-surface-soft)',
            border: '1px solid var(--ur-border)',
          }}
        >
          {info.getValue()}
        </span>
      ),
      size: 100,
    }),
    columnHelper.accessor('created_at', {
      header: 'Data',
      cell: (info) => (
        <span className="ur-meta">
          {format(new Date(info.getValue()), "d 'de' MMM, yyyy", { locale: ptBR })}
        </span>
      ),
      size: 100,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const review = row.original
        return (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {review.status !== 'approved' && (
              <ActionButton
                onClick={() =>
                  statusMutation.mutate({ id: review.id, status: 'approved' })
                }
                variant="ghost"
                aria-label={`Aprovar avaliação de ${review.author_name}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ur-success)' }} aria-hidden="true" />
              </ActionButton>
            )}
            {review.status !== 'rejected' && (
              <ActionButton
                onClick={() =>
                  statusMutation.mutate({ id: review.id, status: 'rejected' })
                }
                variant="ghost"
                aria-label={`Rejeitar avaliação de ${review.author_name}`}
              >
                <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--ur-danger)' }} aria-hidden="true" />
              </ActionButton>
            )}
            {review.status === 'hidden' ? (
              <ActionButton
                onClick={() =>
                  statusMutation.mutate({ id: review.id, status: 'approved' })
                }
                variant="ghost"
                aria-label={`Mostrar avaliação de ${review.author_name}`}
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              </ActionButton>
            ) : (
              <ActionButton
                onClick={() =>
                  statusMutation.mutate({ id: review.id, status: 'hidden' })
                }
                variant="ghost"
                aria-label={`Ocultar avaliação de ${review.author_name}`}
              >
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              </ActionButton>
            )}
            <ActionButton
              onClick={() => deleteMutation.mutate(review.id)}
              variant="ghost"
              aria-label={`Excluir avaliação de ${review.author_name}`}
            >
              <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--ur-danger)' }} aria-hidden="true" />
            </ActionButton>
          </div>
        )
      },
      size: 140,
    }),
  ]

  const statsItems = [
    {
      label: 'Total de avaliações',
      value: formatNumber(statsData?.total_reviews ?? data?.meta.total_count ?? 0),
      delta: statsData?.total_reviews_delta,
    },
    {
      label: 'Aprovadas',
      value: '—',
    },
    {
      label: 'Pendentes',
      value: formatNumber(statsData?.pending_moderation ?? 0),
      delta: statsData?.pending_moderation_delta,
    },
    {
      label: 'Esta semana',
      value: '—',
    },
  ]

  return (
    <div className="flex flex-col h-full relative">
      <PageHeader
        icon={<Star className="w-5 h-5" />}
        title="Avaliações"
        subtitle={
          data
            ? `${formatNumber(data.meta.total_count)} avaliações no total`
            : 'Gerencie e modere avaliações de clientes'
        }
        actions={null}
      />

      <StatsBar stats={statsItems} isLoading={isLoading} />

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5"
            style={{
              background: 'var(--ur-accent-glow)',
              borderBottom: '1px solid var(--ur-accent-soft-2)',
            }}
          >
            <span className="ur-caption" style={{ color: 'var(--ur-accent)' }}>
              {selectedIds.length} selecionadas
            </span>
            <div className="h-3 w-px" style={{ background: 'var(--ur-border-strong)' }} />
            <div className="flex items-center gap-1.5">
              <ActionButton
                onClick={() => handleBulk('approve')}
                disabled={bulkMutation.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ur-success)' }} />
                Aprovar
              </ActionButton>
              <ActionButton
                onClick={() => handleBulk('reject')}
                disabled={bulkMutation.isPending}
              >
                <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--ur-danger)' }} />
                Rejeitar
              </ActionButton>
              <ActionButton
                onClick={() => handleBulk('hide')}
                disabled={bulkMutation.isPending}
              >
                <EyeOff className="w-3.5 h-3.5" />
                Ocultar
              </ActionButton>
              <ActionButton
                onClick={() => handleBulk('delete')}
                variant="danger"
                disabled={bulkMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </ActionButton>
            </div>
            <button
              type="button"
              onClick={() => setRowSelection({})}
              aria-label="Limpar seleção"
              className="ml-auto p-1 rounded"
              style={{ color: 'var(--ur-text-muted)' }}
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Toolbar
        left={
          <>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="Buscar avaliações…"
            />
            <FilterSelect
              value={status}
              onChange={(v) => { setStatus(v); setPage(1) }}
              options={statusOptions}
              placeholder="Todos os status"
            />
            <FilterSelect
              value={rating}
              onChange={(v) => { setRating(v); setPage(1) }}
              options={ratingOptions}
              placeholder="Todas as notas"
            />
            <FilterSelect
              value={source}
              onChange={(v) => { setSource(v); setPage(1) }}
              options={sourceOptions}
              placeholder="Todas as origens"
            />
          </>
        }
        right={
          <>
            <span className="ur-meta">
              {data?.meta.total_count ?? 0} resultados
            </span>
            <ActionButton
              onClick={handleExportCsv}
              disabled={isExporting}
              variant="default"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? 'Exportando…' : 'Exportar CSV'}
            </ActionButton>
          </>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        <DataTable
          data={data?.data ?? []}
          columns={columns as ColumnDef<Review, unknown>[]}
          isLoading={isLoading}
          onRowClick={(row) => setSlidePanel(row)}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
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

      <ReviewDrawer
        review={slidePanel}
        workspace={workspace}
        onClose={() => setSlidePanel(null)}
      />
    </div>
  )
}

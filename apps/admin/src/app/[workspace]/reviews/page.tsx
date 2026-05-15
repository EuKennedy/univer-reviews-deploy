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
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatNumber, truncate, getInitials } from '@/lib/utils'
import type { Review, ReviewStatus, BulkAction } from '@/types'
import Link from 'next/link'

const columnHelper = createColumnHelper<Review>()

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'spam', label: 'Spam' },
]

const sourceOptions = [
  { value: 'widget', label: 'Widget' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'api', label: 'API' },
  { value: 'import', label: 'Import' },
]

const ratingOptions = [
  { value: '5', label: '5 stars' },
  { value: '4', label: '4 stars' },
  { value: '3', label: '3 stars' },
  { value: '2', label: '2 stars' },
  { value: '1', label: '1 star' },
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
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.reviews.delete(id, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      toast.success('Review deleted')
    },
    onError: () => toast.error('Failed to delete review'),
  })

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkAction }) =>
      api.reviews.bulk(ids, action, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      setRowSelection({})
      toast.success('Bulk action applied')
    },
    onError: () => toast.error('Bulk action failed'),
  })

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])

  const handleBulk = useCallback(
    (action: BulkAction) => {
      if (!selectedIds.length) return
      bulkMutation.mutate({ ids: selectedIds, action })
    },
    [selectedIds, bulkMutation]
  )

  const columns = [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="w-3.5 h-3.5 rounded"
          style={{ accentColor: '#d4a850' }}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded"
          style={{ accentColor: '#d4a850' }}
        />
      ),
      size: 40,
      enableSorting: false,
    }),
    columnHelper.accessor('author_name', {
      header: 'Author',
      cell: (info) => {
        const review = info.row.original
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'rgba(212,168,80,0.1)', color: '#d4a850' }}
            >
              {getInitials(info.getValue())}
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: '#f0f0f2' }}>
                {info.getValue()}
              </p>
              {review.verified_purchase && (
                <p className="text-xs" style={{ color: '#22c55e' }}>
                  Verified
                </p>
              )}
            </div>
          </div>
        )
      },
    }),
    columnHelper.accessor('rating', {
      header: 'Rating',
      cell: (info) => (
        <RatingStars rating={info.getValue()} size="xs" showValue />
      ),
      size: 120,
    }),
    columnHelper.accessor('product_name', {
      header: 'Product',
      cell: (info) => (
        <span className="text-xs" style={{ color: '#8b8b96' }}>
          {info.getValue() ?? '—'}
        </span>
      ),
    }),
    columnHelper.accessor('body', {
      header: 'Review',
      cell: (info) => (
        <p className="text-xs max-w-xs" style={{ color: '#8b8b96' }}>
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
      header: 'Source',
      cell: (info) => (
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: '#1a1a1d',
            color: '#5a5a64',
            border: '1px solid #2a2a2d',
          }}
        >
          {info.getValue()}
        </span>
      ),
      size: 100,
    }),
    columnHelper.accessor('created_at', {
      header: 'Date',
      cell: (info) => (
        <span className="text-xs tabular-nums" style={{ color: '#5a5a64' }}>
          {format(new Date(info.getValue()), 'MMM d, yyyy')}
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
              >
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
              </ActionButton>
            )}
            {review.status !== 'rejected' && (
              <ActionButton
                onClick={() =>
                  statusMutation.mutate({ id: review.id, status: 'rejected' })
                }
                variant="ghost"
              >
                <XCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
              </ActionButton>
            )}
            {review.status === 'hidden' ? (
              <ActionButton
                onClick={() =>
                  statusMutation.mutate({ id: review.id, status: 'approved' })
                }
                variant="ghost"
              >
                <Eye className="w-3.5 h-3.5" />
              </ActionButton>
            ) : (
              <ActionButton
                onClick={() =>
                  statusMutation.mutate({ id: review.id, status: 'hidden' })
                }
                variant="ghost"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </ActionButton>
            )}
            <ActionButton
              onClick={() => deleteMutation.mutate(review.id)}
              variant="ghost"
            >
              <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
            </ActionButton>
          </div>
        )
      },
      size: 140,
    }),
  ]

  const statsItems = [
    {
      label: 'Total Reviews',
      value: formatNumber(statsData?.total_reviews ?? data?.meta.total_count ?? 0),
      delta: statsData?.total_reviews_delta,
    },
    {
      label: 'Approved',
      value: '—',
    },
    {
      label: 'Pending',
      value: formatNumber(statsData?.pending_moderation ?? 0),
      delta: statsData?.pending_moderation_delta,
    },
    {
      label: 'This Week',
      value: '—',
    },
  ]

  return (
    <div className="flex flex-col h-full relative">
      <PageHeader
        icon={<Star className="w-5 h-5" />}
        title="Reviews"
        subtitle={
          data
            ? `${formatNumber(data.meta.total_count)} total reviews`
            : 'Manage and moderate customer reviews'
        }
        actions={
          <ActionButton
            onClick={() => toast.info('Preparing export…')}
            variant="default"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </ActionButton>
        }
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
              background: 'rgba(212,168,80,0.06)',
              borderBottom: '1px solid rgba(212,168,80,0.15)',
            }}
          >
            <span className="text-xs font-medium" style={{ color: '#d4a850' }}>
              {selectedIds.length} selected
            </span>
            <div className="h-3 w-px" style={{ background: '#2a2a2d' }} />
            <div className="flex items-center gap-1.5">
              <ActionButton
                onClick={() => handleBulk('approve')}
                disabled={bulkMutation.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                Approve
              </ActionButton>
              <ActionButton
                onClick={() => handleBulk('reject')}
                disabled={bulkMutation.isPending}
              >
                <XCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                Reject
              </ActionButton>
              <ActionButton
                onClick={() => handleBulk('hide')}
                disabled={bulkMutation.isPending}
              >
                <EyeOff className="w-3.5 h-3.5" />
                Hide
              </ActionButton>
              <ActionButton
                onClick={() => handleBulk('delete')}
                variant="danger"
                disabled={bulkMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </ActionButton>
            </div>
            <button
              onClick={() => setRowSelection({})}
              className="ml-auto p-1 rounded"
              style={{ color: '#5a5a64' }}
            >
              <X className="w-3.5 h-3.5" />
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
              placeholder="Search reviews…"
            />
            <FilterSelect
              value={status}
              onChange={(v) => { setStatus(v); setPage(1) }}
              options={statusOptions}
              placeholder="All statuses"
            />
            <FilterSelect
              value={rating}
              onChange={(v) => { setRating(v); setPage(1) }}
              options={ratingOptions}
              placeholder="All ratings"
            />
            <FilterSelect
              value={source}
              onChange={(v) => { setSource(v); setPage(1) }}
              options={sourceOptions}
              placeholder="All sources"
            />
          </>
        }
        right={
          <span className="text-xs" style={{ color: '#5a5a64' }}>
            {data?.meta.total_count ?? 0} results
          </span>
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

      {/* Slide panel */}
      <AnimatePresence>
        {slidePanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSlidePanel(null)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)' }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 flex flex-col overflow-hidden"
              style={{
                background: '#111113',
                borderLeft: '1px solid #1e1e21',
                boxShadow: '-24px 0 80px rgba(0,0,0,0.6)',
              }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{ borderBottom: '1px solid #1e1e21' }}
              >
                <div className="flex items-center gap-2">
                  <RatingStars rating={slidePanel.rating} size="sm" showValue />
                  <StatusBadge status={slidePanel.status} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${workspace}/reviews/${slidePanel.id}`}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                    style={{ color: '#8b8b96', border: '1px solid #1e1e21' }}
                  >
                    Full page <ChevronRight className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => setSlidePanel(null)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: '#5a5a64' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Author */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(212,168,80,0.1)', color: '#d4a850' }}
                  >
                    {getInitials(slidePanel.author_name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#f0f0f2' }}>
                      {slidePanel.author_name}
                    </p>
                    <p className="text-xs" style={{ color: '#5a5a64' }}>
                      {slidePanel.author_email ?? '—'} •{' '}
                      {format(new Date(slidePanel.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Product */}
                {slidePanel.product_name && (
                  <div
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
                  >
                    <span style={{ color: '#5a5a64' }}>Product: </span>
                    <span style={{ color: '#f0f0f2' }}>{slidePanel.product_name}</span>
                  </div>
                )}

                {/* Review body */}
                <div>
                  {slidePanel.title && (
                    <h3
                      className="text-sm font-semibold mb-2"
                      style={{ color: '#f0f0f2' }}
                    >
                      {slidePanel.title}
                    </h3>
                  )}
                  <p className="text-sm leading-relaxed" style={{ color: '#8b8b96' }}>
                    {slidePanel.body}
                  </p>
                </div>

                {/* AI Analysis */}
                {slidePanel.ai_analysis && (
                  <div
                    className="rounded-xl p-4"
                    style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
                  >
                    <p
                      className="text-xs font-semibold mb-3 uppercase tracking-wider"
                      style={{ color: '#5a5a64' }}
                    >
                      AI Analysis
                    </p>
                    <div className="flex items-center gap-4 mb-3">
                      <div>
                        <p className="text-xs" style={{ color: '#5a5a64' }}>
                          Quality
                        </p>
                        <p
                          className="text-lg font-bold"
                          style={{
                            color:
                              slidePanel.ai_analysis.quality_score >= 70
                                ? '#22c55e'
                                : slidePanel.ai_analysis.quality_score >= 40
                                ? '#f59e0b'
                                : '#ef4444',
                          }}
                        >
                          {slidePanel.ai_analysis.quality_score}
                          <span className="text-xs font-normal ml-0.5" style={{ color: '#5a5a64' }}>
                            /100
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#5a5a64' }}>
                          Sentiment
                        </p>
                        <p className="text-sm font-medium capitalize" style={{ color: '#f0f0f2' }}>
                          {slidePanel.ai_analysis.sentiment}
                        </p>
                      </div>
                      {slidePanel.ai_analysis.is_synthetic && (
                        <div>
                          <p className="text-xs" style={{ color: '#5a5a64' }}>
                            Synthetic
                          </p>
                          <p className="text-sm font-medium" style={{ color: '#ef4444' }}>
                            {Math.round(slidePanel.ai_analysis.synthetic_confidence * 100)}%
                          </p>
                        </div>
                      )}
                    </div>
                    {slidePanel.ai_analysis.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {slidePanel.ai_analysis.topics.map((t) => (
                          <span
                            key={t}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(212,168,80,0.08)',
                              border: '1px solid rgba(212,168,80,0.15)',
                              color: '#d4a850',
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Replies */}
                {slidePanel.replies.length > 0 && (
                  <div>
                    <p
                      className="text-xs font-semibold mb-2 uppercase tracking-wider"
                      style={{ color: '#5a5a64' }}
                    >
                      Replies
                    </p>
                    <div className="space-y-2">
                      {slidePanel.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="px-3 py-2 rounded-lg text-xs"
                          style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span style={{ color: '#f0f0f2' }}>{reply.author}</span>
                            {reply.ai_generated && (
                              <span
                                className="px-1.5 py-0.5 rounded text-xs"
                                style={{
                                  background: 'rgba(212,168,80,0.08)',
                                  color: '#d4a850',
                                }}
                              >
                                AI
                              </span>
                            )}
                          </div>
                          <p style={{ color: '#8b8b96' }}>{reply.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel actions */}
              <div
                className="flex items-center gap-2 px-5 py-4 shrink-0"
                style={{ borderTop: '1px solid #1e1e21' }}
              >
                {slidePanel.status !== 'approved' && (
                  <button
                    onClick={() => {
                      statusMutation.mutate({
                        id: slidePanel.id,
                        status: 'approved',
                      })
                      setSlidePanel(null)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      color: '#22c55e',
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                )}
                {slidePanel.status !== 'rejected' && (
                  <button
                    onClick={() => {
                      statusMutation.mutate({
                        id: slidePanel.id,
                        status: 'rejected',
                      })
                      setSlidePanel(null)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444',
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                )}
                <button
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: 'rgba(212,168,80,0.08)',
                    border: '1px solid rgba(212,168,80,0.15)',
                    color: '#d4a850',
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  Reply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

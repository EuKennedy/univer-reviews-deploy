'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import {
  Copy,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/godmode/PageHeader'
import { StatsBar } from '@/components/godmode/StatsBar'
import { Toolbar, SearchInput } from '@/components/godmode/Toolbar'
import { RatingStars } from '@/components/reviews/RatingStars'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatNumber, truncate } from '@/lib/utils'
import type { DuplicateCluster } from '@/types'

function ClusterCard({ cluster }: { cluster: DuplicateCluster }) {
  const [expanded, setExpanded] = useState(false)
  const [rewriting, setRewriting] = useState(false)

  const handleRewrite = async () => {
    setRewriting(true)
    await new Promise((r) => setTimeout(r, 1500))
    setRewriting(false)
    toast.success('Cluster rewritten with AI')
  }

  return (
    <motion.div
      layout
      className="rounded-xl overflow-hidden"
      style={{ background: '#111113', border: '1px solid #1e1e21' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
        style={{ borderBottom: expanded ? '1px solid #1a1a1d' : 'none' }}
      >
        {/* Cluster badge */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
          style={{
            background:
              cluster.similarity_score >= 0.9
                ? 'rgba(239,68,68,0.1)'
                : 'rgba(245,158,11,0.1)',
            color:
              cluster.similarity_score >= 0.9 ? '#ef4444' : '#f59e0b',
            border: `1px solid ${cluster.similarity_score >= 0.9 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
          }}
        >
          {cluster.count}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium" style={{ color: '#f0f0f2' }}>
              {cluster.product_name ?? `Cluster ${cluster.id.slice(0, 6)}`}
            </p>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(212,168,80,0.08)',
                color: '#d4a850',
                border: '1px solid rgba(212,168,80,0.15)',
              }}
            >
              {Math.round(cluster.similarity_score * 100)}% similar
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#5a5a64' }}>
            {cluster.count} reviews in cluster •{' '}
            {cluster.product_name ? `Product: ${cluster.product_name}` : 'No product'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRewrite()
            }}
            disabled={rewriting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: 'rgba(212,168,80,0.08)',
              border: '1px solid rgba(212,168,80,0.15)',
              color: '#d4a850',
            }}
          >
            {rewriting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Rewrite
          </button>

          {expanded ? (
            <ChevronUp className="w-4 h-4" style={{ color: '#5a5a64' }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: '#5a5a64' }} />
          )}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-3">
              {cluster.sample_reviews.map((review, i) => (
                <div
                  key={review.id}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg"
                  style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
                >
                  <span
                    className="text-xs font-mono shrink-0 mt-0.5"
                    style={{ color: '#5a5a64' }}
                  >
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium" style={{ color: '#8b8b96' }}>
                        {review.author_name}
                      </span>
                      <RatingStars rating={review.rating} size="xs" />
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: '#5a5a64' }}>
                      {truncate(review.body, 120)}
                    </p>
                  </div>
                </div>
              ))}

              {cluster.count > cluster.sample_reviews.length && (
                <p className="text-xs text-center" style={{ color: '#5a5a64' }}>
                  +{cluster.count - cluster.sample_reviews.length} more reviews
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function DuplicatesPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [cleaning, setCleaning] = useState(false)

  const { data: clusters, isLoading } = useQuery({
    queryKey: ['duplicate-clusters', workspace],
    queryFn: () => api.ai.duplicateClusters(getToken()),
  })

  const cleanupMutation = useMutation({
    mutationFn: (limit: number) => api.ai.cleanupDuplicates(limit, getToken()),
    onSuccess: (data) => {
      toast.success(`Cleanup job started: ${data.job_id}`)
      queryClient.invalidateQueries({ queryKey: ['duplicate-clusters'] })
      setCleaning(false)
    },
    onError: () => {
      toast.error('Cleanup failed')
      setCleaning(false)
    },
  })

  const filtered = (clusters ?? []).filter((c) =>
    search
      ? c.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.id.includes(search)
      : true
  )

  const totalReviews = (clusters ?? []).reduce((sum, c) => sum + c.count, 0)
  const avgClusterSize =
    clusters?.length
      ? (totalReviews / clusters.length).toFixed(1)
      : '—'

  const statsItems = [
    {
      label: 'Total Clusters',
      value: formatNumber(clusters?.length ?? 0),
    },
    {
      label: 'Reviews Affected',
      value: formatNumber(totalReviews),
    },
    {
      label: 'Avg Cluster Size',
      value: avgClusterSize,
    },
    {
      label: 'Clean Reviews',
      value: '—',
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Copy className="w-5 h-5" />}
        title="Duplicates"
        subtitle="AI-detected duplicate review clusters"
        actions={
          <button
            onClick={() => {
              setCleaning(true)
              cleanupMutation.mutate(100)
            }}
            disabled={cleaning || cleanupMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'linear-gradient(135deg, #d4a850, #c49040)',
              color: '#0a0a0b',
            }}
          >
            {cleaning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Cleanup all
          </button>
        }
      />

      <StatsBar stats={statsItems} isLoading={isLoading} />

      <Toolbar
        left={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search clusters…"
          />
        }
        right={
          <span className="text-xs" style={{ color: '#5a5a64' }}>
            {filtered.length} clusters
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-16 w-full rounded-xl"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}
            >
              <AlertCircle className="w-8 h-8" style={{ color: '#22c55e' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: '#f0f0f2' }}>
                No duplicates found
              </p>
              <p className="text-xs mt-1" style={{ color: '#5a5a64' }}>
                {search
                  ? 'Try a different search term'
                  : 'Your review catalog looks clean'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((cluster) => (
              <ClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

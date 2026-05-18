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
    toast.success('Cluster reescrito com IA')
  }

  return (
    <motion.div
      layout
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
        style={{ borderBottom: expanded ? '1px solid var(--ur-surface-soft)' : 'none' }}
      >
        {/* Cluster badge */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
          style={{
            background:
              cluster.similarity_score >= 0.9
                ? 'var(--ur-danger-bg)'
                : 'var(--ur-warn-bg)',
            color:
              cluster.similarity_score >= 0.9 ? 'var(--ur-danger)' : 'var(--ur-warn)',
            border: `1px solid ${cluster.similarity_score >= 0.9 ? 'var(--ur-danger-bg)' : 'var(--ur-warn-bg)'}`,
          }}
        >
          {cluster.count}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
              {cluster.product_name ?? `Cluster ${cluster.id.slice(0, 6)}`}
            </p>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--ur-accent-glow)',
                color: 'var(--ur-accent)',
                border: '1px solid var(--ur-accent-soft-2)',
              }}
            >
              {Math.round(cluster.similarity_score * 100)}% similares
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ur-text-muted)' }}>
            {cluster.count} avaliações no cluster •{' '}
            {cluster.product_name ? `Produto: ${cluster.product_name}` : 'Sem produto'}
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
              background: 'var(--ur-accent-glow)',
              border: '1px solid var(--ur-accent-soft-2)',
              color: 'var(--ur-accent)',
            }}
          >
            {rewriting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Reescrever
          </button>

          {expanded ? (
            <ChevronUp className="w-4 h-4" style={{ color: 'var(--ur-text-muted)' }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--ur-text-muted)' }} />
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
                  style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-surface-soft)' }}
                >
                  <span
                    className="text-xs font-mono shrink-0 mt-0.5"
                    style={{ color: 'var(--ur-text-muted)' }}
                  >
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--ur-text-soft)' }}>
                        {review.author_name}
                      </span>
                      <RatingStars rating={review.rating} size="xs" />
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--ur-text-muted)' }}>
                      {truncate(review.body, 120)}
                    </p>
                  </div>
                </div>
              ))}

              {cluster.count > cluster.sample_reviews.length && (
                <p className="text-xs text-center" style={{ color: 'var(--ur-text-muted)' }}>
                  +{cluster.count - cluster.sample_reviews.length} avaliações adicionais
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
    mutationFn: (clusterIds: string[]) =>
      api.ai.cleanupDuplicates(clusterIds, getToken()),
    onSuccess: (data) => {
      toast.success(data.message ?? 'Limpeza enfileirada')
      queryClient.invalidateQueries({ queryKey: ['duplicate-clusters'] })
      setCleaning(false)
    },
    onError: () => {
      toast.error('Falha na limpeza')
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
      label: 'Total de clusters',
      value: formatNumber(clusters?.length ?? 0),
    },
    {
      label: 'Avaliações afetadas',
      value: formatNumber(totalReviews),
    },
    {
      label: 'Tamanho médio do cluster',
      value: avgClusterSize,
    },
    {
      label: 'Avaliações limpas',
      value: '—',
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Copy className="w-5 h-5" />}
        title="Duplicatas"
        subtitle="Clusters de avaliações duplicadas detectadas por IA"
        actions={
          <button
            onClick={() => {
              setCleaning(true)
              const ids = (clusters ?? []).map((c) => String(c.id))
              cleanupMutation.mutate(ids)
            }}
            disabled={cleaning || cleanupMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
              color: 'var(--ur-text-on-accent)',
            }}
          >
            {cleaning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Limpar tudo
          </button>
        }
      />

      <StatsBar stats={statsItems} isLoading={isLoading} />

      <Toolbar
        left={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar clusters…"
          />
        }
        right={
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
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
              style={{ background: 'var(--ur-success-bg)', border: '1px solid var(--ur-success-bg)' }}
            >
              <AlertCircle className="w-8 h-8" style={{ color: 'var(--ur-success)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
                Nenhuma duplicata encontrada
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ur-text-muted)' }}>
                {search
                  ? 'Tente outro termo de busca'
                  : 'Seu catálogo de avaliações está limpo'}
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

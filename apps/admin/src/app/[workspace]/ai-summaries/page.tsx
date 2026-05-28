'use client'

/**
 * Sumário de IA — listagem de produtos + bulk progress
 *
 * Editorial dark-first layout. Stats hero, sticky bulk-progress, filter
 * chips, sortable list, staggered card entry. The 15s background poll
 * drives both the per-row status pills and the global progress bar so
 * the merchant never has to refresh.
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Sparkles,
  Loader2,
  Wand2,
  ChevronRight,
  Package,
  RefreshCw,
  Star,
  FileText,
  ArrowUpDown,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { Toolbar, SearchInput, ActionButton } from '@/components/godmode/Toolbar'
import { StatusPill } from '@/components/ai-summary/StatusPill'
import { BulkProgressBar } from '@/components/ai-summary/BulkProgressBar'
import { FilterChips } from '@/components/ai-summary/FilterChips'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatNumber } from '@/lib/utils'
import type { AiSummaryProductRow } from '@/types'

type StatusFilter = 'all' | 'generated' | 'pending' | 'insufficient'
type SortKey = 'reviews' | 'recent' | 'title'

export default function AiSummariesIndexPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('reviews')

  // Bulk progress state — tracks the cohort of products that were "pending"
  // when the user kicked off "Gerar para todos", and counts how many have
  // flipped to "generated" since.
  const [bulkActive, setBulkActive] = useState(false)
  const [bulkCohort, setBulkCohort] = useState<string[]>([])

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['ai-summaries-index'],
    queryFn: () => api.ai.summariesIndex(getToken()).then(r => r.data),
    enabled: isAuthenticated,
    // Refetch every 4s while a bulk is running, every 15s otherwise.
    refetchInterval: () => (bulkActive ? 4000 : 15000),
  })

  const allRows: AiSummaryProductRow[] = data ?? []
  const counts = useMemo(() => ({
    all:          allRows.length,
    generated:    allRows.filter(r => r.status === 'generated').length,
    pending:      allRows.filter(r => r.status === 'pending').length,
    insufficient: allRows.filter(r => r.status === 'insufficient').length,
  }), [allRows])

  const bulkDone = useMemo(() => {
    if (!bulkActive || bulkCohort.length === 0) return 0
    const set = new Set(bulkCohort)
    return allRows.filter(r => set.has(r.id) && r.status === 'generated').length
  }, [bulkActive, bulkCohort, allRows])

  const visible = useMemo(() => {
    let xs = allRows
    if (statusFilter !== 'all') xs = xs.filter(r => r.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      xs = xs.filter(r => r.title.toLowerCase().includes(q))
    }
    xs = [...xs].sort((a, b) => {
      if (sort === 'reviews') return b.approved_reviews - a.approved_reviews
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR')
      const ta = a.last_generated_at ? new Date(a.last_generated_at).getTime() : 0
      const tb = b.last_generated_at ? new Date(b.last_generated_at).getTime() : 0
      return tb - ta
    })
    return xs
  }, [allRows, statusFilter, search, sort])

  const eligible = useMemo(
    () => allRows.filter(r => r.status !== 'insufficient'),
    [allRows],
  )

  const bulkMut = useMutation({
    mutationFn: () => api.ai.generateSummaryTopicsBulk(undefined, getToken()),
    onSuccess: (r) => {
      const cohort = eligible.filter(p => p.status !== 'generated').map(p => p.id)
      setBulkCohort(cohort.length > 0 ? cohort : eligible.map(p => p.id))
      setBulkActive(true)
      toast.success(`Extração enfileirada para ${r.queued} produto(s). Acompanhe no topo da página.`)
      void queryClient.invalidateQueries({ queryKey: ['ai-summaries-index'] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao iniciar geração'),
  })

  // Stat tiles — small editorial card row.
  const totalApproved = useMemo(() => allRows.reduce((sum, r) => sum + r.approved_reviews, 0), [allRows])
  const totalTopics   = useMemo(() => allRows.reduce((sum, r) => sum + r.topic_count, 0), [allRows])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Sparkles className="w-5 h-5" />}
        title="Sumário de IA"
        subtitle="O que clientes estão falando, organizado em tópicos — gerados por IA ou curados manualmente"
        actions={
          <ActionButton
            variant="primary"
            onClick={() => {
              if (eligible.length === 0) return
              if (window.confirm(`Gerar tópicos para ${eligible.length} produtos elegíveis? Roda em background, leva alguns minutos.`)) {
                bulkMut.mutate()
              }
            }}
            disabled={bulkMut.isPending || eligible.length === 0}
          >
            {bulkMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Gerar para todos
            <span
              className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.18)', color: 'inherit', marginLeft: 4 }}
            >
              {eligible.length}
            </span>
          </ActionButton>
        }
      />

      <BulkProgressBar
        active={bulkActive}
        total={bulkCohort.length || eligible.length}
        done={bulkDone}
        onDismiss={() => { setBulkActive(false); setBulkCohort([]) }}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-4">
        <StatCard index={0} label="Produtos" value={formatNumber(allRows.length)} icon={<Package className="w-3.5 h-3.5" />} />
        <StatCard index={1} label="Aprovadas" value={formatNumber(totalApproved)} icon={<Star className="w-3.5 h-3.5" />} accent />
        <StatCard index={2} label="Tópicos criados" value={formatNumber(totalTopics)} icon={<FileText className="w-3.5 h-3.5" />} />
        <StatCard index={3} label="Atualizado" value={dataUpdatedAt ? formatDistanceToNow(dataUpdatedAt, { addSuffix: true, locale: ptBR }) : '—'} icon={<RefreshCw className="w-3.5 h-3.5" />} subtle />
      </div>

      <Toolbar
        left={
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar produto…"
            />
            <FilterChips
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all',          label: 'Todos',        count: counts.all },
                { value: 'generated',    label: 'Gerados',      count: counts.generated },
                { value: 'pending',      label: 'Pendentes',    count: counts.pending },
                { value: 'insufficient', label: 'Sem reviews',  count: counts.insufficient },
              ]}
              ariaLabel="Filtrar por status"
            />
          </div>
        }
        right={
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ur-text-muted)' }}>
              <ArrowUpDown className="w-3 h-3" />
              <span>Ordenar</span>
            </div>
            <FilterChips
              value={sort}
              onChange={setSort}
              options={[
                { value: 'reviews', label: 'Mais avaliadas' },
                { value: 'recent',  label: 'Recentes' },
                { value: 'title',   label: 'A–Z' },
              ]}
              ariaLabel="Ordenação"
            />
            <span className="text-xs hidden md:inline tabular-nums" style={{ color: 'var(--ur-text-muted)' }}>
              {visible.length} {visible.length === 1 ? 'produto' : 'produtos'}
            </span>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <RowSkeleton key={i} delay={i * 0.05} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={search || statusFilter !== 'all' ? 'Nenhum produto bate com esse filtro' : 'Nenhum produto sincronizado'}
            subtitle={search || statusFilter !== 'all' ? 'Tente outra palavra ou outro status.' : 'Conecte sua loja em Integrações para começar.'}
          />
        ) : (
          <motion.div className="px-4 py-3 space-y-2" layout>
            <AnimatePresence mode="popLayout">
              {visible.map((p, i) => (
                <ProductRow key={p.id} workspace={workspace} product={p} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({ index = 0, label, value, icon, accent, subtle }: { index?: number; label: string; value: string; icon?: React.ReactNode; accent?: boolean; subtle?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 + index * 0.06, ease: [0.2, 0.0, 0.2, 1] }}
      className="rounded-xl p-4 relative overflow-hidden"
      style={{
        background: accent
          ? 'linear-gradient(135deg, var(--ur-accent-glow), transparent)'
          : 'var(--ur-bg-soft)',
        border: `1px solid ${accent ? 'var(--ur-accent-soft-2)' : 'var(--ur-border)'}`,
      }}
    >
      {accent && (
        <motion.div
          aria-hidden
          className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
          style={{ background: 'var(--ur-accent-ring)', filter: 'blur(28px)' }}
          animate={{ opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5"
           style={{ color: accent ? 'var(--ur-accent)' : 'var(--ur-text-muted)' }}>
        {icon}
        <span>{label}</span>
      </div>
      <p
        className="relative font-semibold tabular-nums tracking-tight"
        style={{
          color: subtle ? 'var(--ur-text-soft)' : 'var(--ur-text)',
          fontSize: subtle ? 14 : 22,
        }}
      >
        {value}
      </p>
    </motion.div>
  )
}

function ProductRow({ workspace, product, index }: { workspace: string; product: AiSummaryProductRow; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.03, 0.45), ease: [0.2, 0.0, 0.2, 1] }}
    >
      <Link
        href={`/${workspace}/ai-summaries/${product.id}`}
        className="group relative flex items-center gap-4 p-3.5 rounded-xl transition-all cursor-pointer overflow-hidden"
        style={{
          background: 'var(--ur-bg-soft)',
          border: '1px solid var(--ur-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)'
          e.currentTarget.style.background = 'var(--ur-surface)'
          e.currentTarget.style.boxShadow = '0 8px 24px -12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.04)'
          e.currentTarget.style.transform = 'translateY(-1px)'
          const stripe = e.currentTarget.querySelector('[data-accent-stripe]') as HTMLElement | null
          if (stripe) stripe.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--ur-border)'
          e.currentTarget.style.background = 'var(--ur-bg-soft)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
          const stripe = e.currentTarget.querySelector('[data-accent-stripe]') as HTMLElement | null
          if (stripe) stripe.style.opacity = '0'
        }}
      >
        {/* Accent stripe — appears on hover, anchors the row to the gold rhythm of the page */}
        <span
          data-accent-stripe
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r"
          style={{
            background: 'linear-gradient(180deg, var(--ur-accent), transparent 90%)',
            opacity: 0,
            transition: 'opacity 0.2s ease',
          }}
        />

        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt=""
            className="w-12 h-12 rounded-lg object-cover shrink-0"
            style={{ border: '1px solid var(--ur-border-strong)' }}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--ur-surface-soft)', border: '1px solid var(--ur-border)' }}
          >
            <Package className="w-5 h-5" style={{ color: 'var(--ur-text-muted)' }} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate mb-1" style={{ color: 'var(--ur-text)', letterSpacing: '-0.005em' }}>
            {product.title}
          </p>
          <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--ur-text-muted)' }}>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Star className="w-3 h-3" style={{ color: 'var(--ur-warn)' }} />
              {formatNumber(product.approved_reviews)} avaliações
            </span>
            {product.topic_count > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <FileText className="w-3 h-3" />
                {product.topic_count} {product.topic_count === 1 ? 'tópico' : 'tópicos'}
              </span>
            )}
            {product.last_generated_at && (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {formatDistanceToNow(new Date(product.last_generated_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
        </div>

        <StatusPill status={product.status} />

        <ChevronRight
          className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          style={{ color: 'var(--ur-text-muted)' }}
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  )
}

function RowSkeleton({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl p-3.5 flex items-center gap-4"
      style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}
    >
      <div className="w-12 h-12 rounded-lg" style={{ background: 'var(--ur-skeleton-2)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded" style={{ width: '60%', background: 'var(--ur-skeleton-2)' }} />
        <div className="h-2.5 rounded" style={{ width: '40%', background: 'var(--ur-skeleton-1)' }} />
      </div>
      <div className="h-6 w-20 rounded-full" style={{ background: 'var(--ur-skeleton-1)' }} />
    </motion.div>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 px-6 text-center"
    >
      <div
        className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'linear-gradient(135deg, var(--ur-accent-glow), transparent)',
          border: '1px solid var(--ur-accent-soft-2)',
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ background: 'var(--ur-accent-ring)', filter: 'blur(20px)', opacity: 0.4 }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <Sparkles className="w-7 h-7 relative" style={{ color: 'var(--ur-accent)' }} />
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--ur-text)' }}>{title}</p>
      <p className="text-sm mt-1.5 max-w-md" style={{ color: 'var(--ur-text-muted)' }}>{subtitle}</p>
    </motion.div>
  )
}

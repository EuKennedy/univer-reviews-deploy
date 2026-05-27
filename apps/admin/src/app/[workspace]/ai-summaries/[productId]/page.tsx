'use client'

/**
 * Sumário de IA — editor por produto
 *
 * Editorial hero, generation pulse banner, topic cards with hierarchy,
 * crossfade-to-skeleton when AI is running, refined review picker with
 * chip filters and animated cards. Every interaction has feedback.
 */

import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import {
  Sparkles,
  Wand2,
  Plus,
  Trash2,
  X,
  Loader2,
  ArrowLeft,
  ChevronDown,
  Edit2,
  Save,
  Search,
  Image as ImageIcon,
  CheckCircle2,
  Camera,
  Video,
  Package,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { ActionButton } from '@/components/godmode/Toolbar'
import { StatusPill } from '@/components/ai-summary/StatusPill'
import { TopicSkeleton } from '@/components/ai-summary/TopicSkeleton'
import { StarsAvg } from '@/components/ai-summary/StarsAvg'
import { FilterChips } from '@/components/ai-summary/FilterChips'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useFocusTrap } from '@/lib/useFocusTrap'
import type { AiSummaryTopic, Review } from '@/types'

export default function AiSummaryEditPage() {
  const params = useParams()
  const router = useRouter()
  const workspace = params?.workspace as string
  const productId = params?.productId as string
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [generating, setGenerating] = useState(false)

  const { data: topics, isLoading } = useQuery({
    queryKey: ['ai-summary-topics', productId],
    queryFn: () => api.aiSummaryTopics.list(productId, getToken()).then(r => r.data),
    enabled: isAuthenticated && !!productId,
    // While we're explicitly generating, poll fast so the skeleton flips
    // to real cards the moment Sidekiq lands. After 90s, fall back to slow.
    refetchInterval: () => (generating ? 4000 : false),
  })

  // Pull product context from the ai-summaries index (capped 500, already
  // cached when the merchant clicked through from the list page) instead of
  // /products which paginates 25 per page and would leave the header stuck
  // on "Carregando…" for any product past the first page.
  const { data: product } = useQuery({
    queryKey: ['ai-summary-product', productId],
    queryFn: () => api.ai.summariesIndex(getToken()).then(r =>
      r.data.find(p => p.id === productId) ?? null,
    ),
    enabled: isAuthenticated && !!productId,
    staleTime: 60_000,
  })

  // When the AI topics arrive (any source='ai' topic that wasn't there
  // before), exit the generating state.
  useEffect(() => {
    if (!generating || !topics) return
    if (topics.some(t => t.source === 'ai')) setGenerating(false)
  }, [topics, generating])

  // Every topic mutation also dirties the dashboard index (status pill,
  // topic count, last_generated_at) so the list page reflects reality the
  // moment the merchant clicks back.
  const inv = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-summary-topics', productId] })
    queryClient.invalidateQueries({ queryKey: ['ai-summaries-index'] })
    queryClient.invalidateQueries({ queryKey: ['ai-summary-product', productId] })
  }

  // Hard cap matches AiGenerateSummaryTopicsJob::MAX_AI_TOPICS_PER_PRODUCT.
  // Kept here as a constant so the UI can disable/hint before the request
  // round-trips. The backend re-enforces and returns 409 if exceeded.
  const MAX_AI_TOPICS = 5

  const generateMut = useMutation({
    mutationFn: (mode: 'replace' | 'append') =>
      api.ai.generateSummaryTopics(productId, getToken(), { mode }),
    onMutate: () => setGenerating(true),
    onSuccess: (r, mode) => {
      const aiCount = (r as { ai_count?: number } | undefined)?.ai_count
      const totalCount = (r as { count?: number } | undefined)?.count ?? 0
      const created = mode === 'append' ? 1 : totalCount
      if (mode === 'append') {
        if (aiCount != null && aiCount >= MAX_AI_TOPICS) {
          toast.success('Tópico adicionado — limite de 5 atingido.')
        } else {
          toast.success('Tópico adicionado pela IA.')
        }
      } else if (created > 0) {
        toast.success('Sumário gerado pela IA.')
      } else {
        toast.success('Geração concluída.')
      }
      setGenerating(false)
      void inv()
    },
    onError: (e: unknown) => {
      setGenerating(false)
      // 409 = backend cap reached. Show the friendly message, don't log
      // to Sentry-style channels — it's expected.
      const msg = e instanceof Error ? e.message : 'Falha ao gerar'
      toast.error(msg)
    },
  })

  // Hard timeout — never let the skeleton spin forever if something
  // upstream is wedged (Sidekiq with stale code, Claude rate-limited, etc.)
  useEffect(() => {
    if (!generating) return
    const t = setTimeout(() => {
      if (generating) {
        setGenerating(false)
        toast.error('Geração demorou mais que o esperado. Tente novamente — se persistir, abra um chamado.')
      }
    }, 90_000)
    return () => clearTimeout(t)
  }, [generating])

  const createMut = useMutation({
    mutationFn: (title: string) => api.aiSummaryTopics.create({ product_id: productId, title }, getToken()),
    onSuccess: () => { toast.success('Tópico criado'); void inv() },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao criar tópico'),
  })

  const [newTitle, setNewTitle] = useState('')
  // When the user picks "Ou criar manualmente" from the empty state, we
  // flip this flag so the manual-input slot mounts and we can focus it
  // inside the same tick. (The slot is otherwise hidden until topics
  // exist, to avoid cluttering the empty state.)
  const [showManualSlot, setShowManualSlot] = useState(false)
  const hasTopics = (topics ?? []).length > 0
  const aiTopicCount = (topics ?? []).filter(t => t.source === 'ai').length
  const hasAiTopic = aiTopicCount > 0
  const atAiCap = aiTopicCount >= MAX_AI_TOPICS

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Sparkles className="w-5 h-5" />}
        title={product?.title ?? 'Carregando…'}
        subtitle="Edite os tópicos do sumário deste produto"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/${workspace}/ai-summaries`)}
              aria-label="Voltar para lista"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer min-h-[44px] sm:min-h-0"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text-soft)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
            {/* Header button is contextual:
              - no AI topics  → "Gerar com IA"     (mode=replace, creates 1)
              - 1..4 AI topic → "Gerar mais 1 com IA" (mode=append)
              - 5 AI topics   → button hidden; pill below explains why.
              The inline "+ Gerar mais 1" CTA below the topic list mirrors
              the append action so the user can also act in-context. */}
            {!atAiCap && (
              <ActionButton
                variant="primary"
                onClick={() => generateMut.mutate(hasAiTopic ? 'append' : 'replace')}
                disabled={generateMut.isPending || generating}
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {hasAiTopic ? `+ Gerar mais 1 com IA` : 'Gerar com IA'}
              </ActionButton>
            )}
            {atAiCap && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{
                  background: 'var(--ur-accent-glow)',
                  color: 'var(--ur-accent)',
                  border: '1px solid var(--ur-accent-soft-2)',
                }}
                aria-label="Limite de sumários de IA atingido"
                title="Cada produto comporta no máximo 5 sumários gerados por IA. Apague algum para gerar outro."
              >
                <Sparkles className="w-3.5 h-3.5" />
                Limite de {MAX_AI_TOPICS} sumários atingido
              </span>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero — product context strip */}
          {product && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3 mb-5 px-1"
            >
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt="" className="w-9 h-9 rounded-lg object-cover" style={{ border: '1px solid var(--ur-border-strong)' }} />
              ) : (
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--ur-surface-soft)', border: '1px solid var(--ur-border)' }}>
                  <Package className="w-4 h-4" style={{ color: 'var(--ur-text-muted)' }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {generating ? (
                    <StatusPill status="processing" label="Extraindo tópicos…" />
                  ) : hasAiTopic ? (
                    <StatusPill status="generated" />
                  ) : hasTopics ? (
                    <StatusPill status="pending" label="Só manuais" />
                  ) : (
                    <StatusPill status="pending" />
                  )}
                  <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                    {product.approved_reviews != null ? `${product.approved_reviews} avaliações aprovadas` : ''}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Topics */}
          <AnimatePresence mode="wait">
            {isLoading && !generating ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl p-4 h-20" style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }} />
                ))}
              </motion.div>
            ) : generating ? (
              <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TopicSkeleton count={4} />
              </motion.div>
            ) : hasTopics ? (
              <motion.div key="topics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {(topics ?? []).map((t, i) => (
                    <TopicCard key={t.id} topic={t} productId={productId} index={i} />
                  ))}
                </AnimatePresence>
                {/* Inline append CTA — mirrors the header button. When the
                  product hits the cap we swap in a friendly limit chip so
                  the user understands why the button is gone. */}
                <GenerateMoreSlot
                  hasAiTopic={hasAiTopic}
                  atCap={atAiCap}
                  aiCount={aiTopicCount}
                  max={MAX_AI_TOPICS}
                  generating={generating || generateMut.isPending}
                  onGenerateOne={() => generateMut.mutate(hasAiTopic ? 'append' : 'replace')}
                />
              </motion.div>
            ) : (
              <EmptyState
                onGenerate={() => generateMut.mutate('replace')}
                generating={generating}
                onFocusManual={() => {
                  setShowManualSlot(true)
                  // Wait for the slot to mount, then focus.
                  requestAnimationFrame(() => {
                    document.getElementById('manual-topic-input')?.focus()
                  })
                }}
              />
            )}
          </AnimatePresence>

          {/* Manual create row */}
          {(hasTopics || generating || showManualSlot) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 flex gap-2 p-3 rounded-xl"
              style={{ background: 'var(--ur-bg)', border: '1px dashed var(--ur-border-strong)' }}
            >
              <input
                id="manual-topic-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Adicionar tópico manualmente — ex: Cabelo fica mais brilhoso"
                className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTitle.trim()) {
                    createMut.mutate(newTitle.trim()); setNewTitle('')
                  }
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid var(--ur-accent-ring)'
                  e.target.style.boxShadow = '0 0 0 3px var(--ur-accent-glow)'
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid var(--ur-border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <ActionButton
                variant="primary"
                onClick={() => {
                  if (!newTitle.trim()) return
                  createMut.mutate(newTitle.trim()); setNewTitle('')
                }}
                disabled={!newTitle.trim() || createMut.isPending}
              >
                {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Adicionar tópico
              </ActionButton>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Topic card ──────────────────────────────────────────────────────────────

function TopicCard({ topic, productId, index }: { topic: AiSummaryTopic; productId: string; index: number }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(topic.title)
  const [attachingOpen, setAttachingOpen] = useState(false)

  const { data: detail, isFetching: fetchingDetail } = useQuery({
    queryKey: ['ai-summary-topic', topic.id],
    queryFn: () => api.aiSummaryTopics.get(topic.id, getToken()),
    enabled: expanded,
  })

  const inv = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-summary-topic', topic.id] })
    queryClient.invalidateQueries({ queryKey: ['ai-summary-topics', productId] })
    // Topic count + status pill on the dashboard depend on this.
    queryClient.invalidateQueries({ queryKey: ['ai-summaries-index'] })
  }

  const updateMut = useMutation({
    mutationFn: () => api.aiSummaryTopics.update(topic.id, { title }, getToken()),
    onSuccess: () => { toast.success('Tópico renomeado'); setRenaming(false); inv() },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao renomear'),
  })

  const deleteMut = useMutation({
    mutationFn: () => api.aiSummaryTopics.delete(topic.id, getToken()),
    onSuccess: () => { toast.success('Tópico removido'); inv() },
  })

  const detachMut = useMutation({
    mutationFn: (reviewId: string) => api.aiSummaryTopics.detachReviews(topic.id, [reviewId], getToken()),
    onSuccess: () => inv(),
  })

  const sourceMeta = topic.source === 'ai'
    ? { label: 'Gerado por IA', bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(168, 85, 247, 0.05))', color: '#7e22ce', border: 'rgba(168, 85, 247, 0.3)' }
    : { label: 'Manual', bg: 'var(--ur-surface-soft)', color: 'var(--ur-text-secondary)', border: 'var(--ur-border)' }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.2, 0.0, 0.2, 1] }}
      className="rounded-xl overflow-hidden group"
      style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}
      whileHover={{ y: -1, boxShadow: 'var(--ur-shadow-md)' }}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Recolher' : 'Expandir'}
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer"
          style={{ color: 'var(--ur-text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ur-surface-soft)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>

        {/* Source pill */}
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full shrink-0"
          style={{ background: sourceMeta.bg, color: sourceMeta.color, border: `1px solid ${sourceMeta.border}` }}
        >
          {topic.source === 'ai' && <Sparkles className="w-2.5 h-2.5" />}
          {sourceMeta.label}
        </span>

        {/* Title */}
        {renaming ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) updateMut.mutate()
              if (e.key === 'Escape') { setRenaming(false); setTitle(topic.title) }
            }}
            className="flex-1 text-sm font-semibold rounded-md px-2 py-1 outline-none"
            style={{
              background: 'var(--ur-bg)',
              border: '1px solid var(--ur-accent-ring)',
              boxShadow: '0 0 0 3px var(--ur-accent-glow)',
              color: 'var(--ur-text)',
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="flex-1 text-left min-w-0 cursor-pointer"
            title="Clique para renomear"
          >
            <p className="text-sm font-semibold truncate tracking-tight" style={{ color: 'var(--ur-text)' }}>
              {topic.title}
            </p>
          </button>
        )}

        {/* Stars + count */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {topic.stars_avg != null && (
            <StarsAvg value={topic.stars_avg} />
          )}
          <span
            className="text-xs tabular-nums font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'var(--ur-surface-soft)', color: 'var(--ur-text-secondary)' }}
          >
            {topic.review_count} {topic.review_count === 1 ? 'review' : 'reviews'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {renaming ? (
            <button
              type="button"
              onClick={() => updateMut.mutate()}
              disabled={!title.trim() || updateMut.isPending}
              aria-label="Salvar"
              className="p-1.5 rounded-md cursor-pointer transition-colors"
              style={{ color: 'var(--ur-accent)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ur-accent-glow)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              aria-label="Renomear"
              className="p-1.5 rounded-md cursor-pointer transition-colors"
              style={{ color: 'var(--ur-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ur-surface-soft)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remover tópico "${topic.title}"?`)) deleteMut.mutate()
            }}
            aria-label="Remover tópico"
            className="p-1.5 rounded-md cursor-pointer transition-colors"
            style={{ color: 'var(--ur-danger)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ur-danger-bg)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stars on mobile (below header) */}
      <div className="md:hidden px-4 -mt-1 mb-3 flex items-center gap-3">
        {topic.stars_avg != null && <StarsAvg value={topic.stars_avg} />}
        <span className="text-xs tabular-nums" style={{ color: 'var(--ur-text-muted)' }}>
          {topic.review_count} {topic.review_count === 1 ? 'review' : 'reviews'}
        </span>
      </div>

      {/* AI summary subline (always visible if exists) */}
      {topic.ai_summary && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs italic leading-relaxed" style={{ color: 'var(--ur-text-soft)' }}>
            {topic.ai_summary}
          </p>
        </div>
      )}

      {/* Expanded reviews */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid var(--ur-border)' }}>
              {fetchingDetail && !detail ? (
                <div className="flex items-center gap-2 py-4 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Carregando reviews…
                </div>
              ) : (detail?.reviews ?? []).length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                    Nenhuma review anexada a este tópico ainda.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {(detail?.reviews ?? []).map((r) => (
                    <ReviewMiniCard key={r.id} review={r} onDetach={() => detachMut.mutate(r.id)} />
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setAttachingOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition-all min-h-[44px] sm:min-h-0"
                style={{
                  background: 'var(--ur-accent-glow)',
                  color: 'var(--ur-accent)',
                  border: '1px solid var(--ur-accent-soft-2)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ur-accent-soft)'; e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ur-accent-glow)'; e.currentTarget.style.borderColor = 'var(--ur-accent-soft-2)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar reviews ao tópico
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {attachingOpen && (
        <ReviewPickerModal
          productId={productId}
          topicId={topic.id}
          topicTitle={topic.title}
          excludeIds={(detail?.reviews ?? []).map((r) => r.id)}
          onClose={() => setAttachingOpen(false)}
          onAttached={inv}
        />
      )}
    </motion.div>
  )
}

// ─── Mini review card ────────────────────────────────────────────────────────

function ReviewMiniCard({ review, onDetach }: {
  review: { id: string; rating: number; title: string | null; body: string; author_name: string | null; created_at: string }
  onDetach: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 p-3 rounded-lg group/r"
      style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}
    >
      <StarsAvg value={review.rating} showNumber={false} size="xs" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--ur-text)' }}>
            {review.author_name ?? 'Cliente anônimo'}
          </span>
        </div>
        {review.title && (
          <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
            {review.title}
          </p>
        )}
        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--ur-text-soft)' }}>
          {review.body}
        </p>
      </div>
      <button
        type="button"
        onClick={onDetach}
        aria-label="Desanexar review"
        className="shrink-0 p-1.5 rounded-md opacity-0 group-hover/r:opacity-100 transition-all cursor-pointer"
        style={{ color: 'var(--ur-danger)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ur-danger-bg)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  )
}

// ─── Generate-more inline slot ───────────────────────────────────────────────

function GenerateMoreSlot({
  hasAiTopic,
  atCap,
  aiCount,
  max,
  generating,
  onGenerateOne,
}: {
  hasAiTopic: boolean
  atCap: boolean
  aiCount: number
  max: number
  generating: boolean
  onGenerateOne: () => void
}) {
  if (atCap) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-medium"
        style={{
          background: 'var(--ur-accent-glow)',
          color: 'var(--ur-accent)',
          border: '1px dashed var(--ur-accent-soft-2)',
        }}
        aria-label="Limite de sumários atingido"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Limite de {max} sumários gerados por IA atingido. Para gerar outro, remova algum acima.
      </motion.div>
    )
  }

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      onClick={onGenerateOne}
      disabled={generating}
      className="mt-1 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        background: 'var(--ur-bg-soft)',
        color: 'var(--ur-text)',
        border: '1px dashed var(--ur-border-strong)',
      }}
      onMouseEnter={(e) => {
        if (e.currentTarget.disabled) return
        e.currentTarget.style.background = 'var(--ur-accent-glow)'
        e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)'
        e.currentTarget.style.color = 'var(--ur-accent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--ur-bg-soft)'
        e.currentTarget.style.borderColor = 'var(--ur-border-strong)'
        e.currentTarget.style.color = 'var(--ur-text)'
      }}
      aria-label={hasAiTopic ? 'Gerar mais um sumário com IA' : 'Gerar um sumário com IA'}
    >
      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
      <span>
        {hasAiTopic ? '+ Gerar mais 1 sumário com IA' : 'Gerar 1 sumário com IA'}
      </span>
      {hasAiTopic && (
        <span
          className="ml-1 inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full tabular-nums"
          style={{ background: 'var(--ur-surface-soft)', color: 'var(--ur-text-muted)' }}
          aria-hidden="true"
        >
          {aiCount}/{max}
        </span>
      )}
    </motion.button>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onGenerate, generating, onFocusManual }: { onGenerate: () => void; generating: boolean; onFocusManual: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden text-center py-16 px-6"
      style={{
        background: 'linear-gradient(135deg, var(--ur-bg-soft), transparent)',
        border: '1px solid var(--ur-border)',
      }}
    >
      <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-3xl"
          style={{ background: 'var(--ur-accent-ring)', filter: 'blur(28px)' }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
            boxShadow: '0 10px 30px var(--ur-accent-ring)',
          }}
        >
          <Sparkles className="w-7 h-7" style={{ color: 'var(--ur-text-on-accent)' }} />
        </div>
      </div>
      <h3 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--ur-text)' }}>
        Comece criando os tópicos deste produto
      </h3>
      <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: 'var(--ur-text-muted)' }}>
        A IA lê suas avaliações e cria 1 sumário por vez — você decide quando
        gerar mais, até um total de 5. Também dá pra criar manualmente.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
        <ActionButton variant="primary" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          Gerar com IA
        </ActionButton>
        <button
          type="button"
          onClick={onFocusManual}
          className="text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition-colors"
          style={{ background: 'transparent', color: 'var(--ur-text-soft)', border: '1px solid var(--ur-border)' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ur-border)' }}
        >
          Ou criar manualmente
        </button>
      </div>
    </motion.div>
  )
}

// ─── Review picker modal ────────────────────────────────────────────────────

function ReviewPickerModal({
  productId,
  topicId,
  topicTitle,
  excludeIds,
  onClose,
  onAttached,
}: {
  productId: string
  topicId: string
  topicTitle: string
  excludeIds: string[]
  onClose: () => void
  onAttached: () => void
}) {
  const { getToken } = useAuth()
  const [query, setQuery] = useState('')
  const [minRating, setMinRating] = useState<'' | 1 | 2 | 3 | 4 | 5>('')
  const [withMedia, setWithMedia] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['reviews-pick', productId, query, minRating, withMedia],
    queryFn: () => api.reviews.list(
      {
        product_id: productId,
        status: 'approved',
        per_page: 50,
        q: query || undefined,
        rating: minRating === '' ? undefined : minRating,
        with_media: withMedia ? 'true' : undefined,
      },
      getToken(),
    ),
  })

  const items = useMemo(
    () => (data?.data ?? []).filter((r: Review) => !excludeIds.includes(r.id)),
    [data, excludeIds],
  )

  const attachMut = useMutation({
    mutationFn: () => api.aiSummaryTopics.attachReviews(topicId, selected, getToken()),
    onSuccess: (r) => {
      toast.success(`${r.attached} ${r.attached === 1 ? 'review anexada' : 'reviews anexadas'}`)
      onAttached()
      onClose()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao anexar'),
  })

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <Modal title="Anexar reviews ao tópico" subtitle={topicTitle} onClose={onClose} wide>
      <div className="space-y-4">
        {/* Search + chip filters */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ur-text-muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no corpo, título ou autor…"
              className="w-full text-sm rounded-lg pl-9 pr-3 py-2.5 outline-none"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
              onFocus={(e) => { e.target.style.border = '1px solid var(--ur-accent-ring)'; e.target.style.boxShadow = '0 0 0 3px var(--ur-accent-glow)' }}
              onBlur={(e) => { e.target.style.border = '1px solid var(--ur-border)'; e.target.style.boxShadow = 'none' }}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChips
              value={String(minRating) as '' | '1' | '2' | '3' | '4' | '5'}
              onChange={(v) => setMinRating(v === '' ? '' : Number(v) as 1 | 2 | 3 | 4 | 5)}
              options={[
                { value: '',  label: 'Todas estrelas' },
                { value: '5', label: '5★' },
                { value: '4', label: '4★+' },
                { value: '3', label: '3★+' },
              ]}
              ariaLabel="Filtrar por estrelas"
            />
            <button
              type="button"
              onClick={() => setWithMedia((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-all"
              style={{
                background: withMedia ? 'var(--ur-accent-glow)' : 'var(--ur-bg)',
                color: withMedia ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
                border: `1px solid ${withMedia ? 'var(--ur-accent-soft-3)' : 'var(--ur-border)'}`,
              }}
              aria-pressed={withMedia}
            >
              <ImageIcon className="w-3 h-3" />
              Com mídia
            </button>
          </div>
        </div>

        {/* Reviews list */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}
        >
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="p-10 flex items-center justify-center" style={{ color: 'var(--ur-text-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>Nenhuma review bate com esse filtro.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--ur-border)' }}>
                {items.map((r: Review) => {
                  const checked = selected.includes(r.id)
                  const hasMedia = (r.media?.length ?? 0) > 0
                  const hasVideo = (r.media ?? []).some(m => m.type === 'video')
                  return (
                    <label
                      key={r.id}
                      className="flex items-start gap-3 p-3.5 cursor-pointer transition-colors"
                      style={{ background: checked ? 'var(--ur-accent-glow)' : 'transparent' }}
                      onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = 'var(--ur-surface-soft)' }}
                      onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                    >
                      <Checkbox checked={checked} onChange={() => toggle(r.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <StarsAvg value={r.rating} showNumber={false} size="xs" />
                          <span className="text-xs font-semibold" style={{ color: 'var(--ur-text)' }}>
                            {r.author_name ?? 'Cliente anônimo'}
                          </span>
                          {r.verified_purchase && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                                  style={{ background: 'var(--ur-success-bg)', color: 'var(--ur-success)' }}>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Verificada
                            </span>
                          )}
                          {hasMedia && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                                  style={{ background: 'var(--ur-info-bg)', color: 'var(--ur-info)' }}>
                              {hasVideo ? <Video className="w-2.5 h-2.5" /> : <Camera className="w-2.5 h-2.5" />}
                              {hasVideo ? 'Vídeo' : 'Foto'}
                            </span>
                          )}
                        </div>
                        {r.title && (
                          <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>{r.title}</p>
                        )}
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--ur-text-soft)' }}>{r.body}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          {selected.length > 0 && (
            <div
              className="px-4 py-2 text-xs font-medium flex items-center justify-between"
              style={{ background: 'var(--ur-accent-glow)', borderTop: '1px solid var(--ur-accent-soft-2)', color: 'var(--ur-accent)' }}
            >
              <span>{selected.length} {selected.length === 1 ? 'selecionada' : 'selecionadas'}</span>
              <button type="button" onClick={() => setSelected([])} className="underline cursor-pointer">
                limpar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-5">
        <ActionButton onClick={onClose}>Cancelar</ActionButton>
        <ActionButton
          variant="primary"
          onClick={() => attachMut.mutate()}
          disabled={selected.length === 0 || attachMut.isPending}
        >
          {attachMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Anexar {selected.length > 0 ? `(${selected.length})` : ''}
        </ActionButton>
      </div>
    </Modal>
  )
}

// ─── Animated checkbox ───────────────────────────────────────────────────────

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => { e.preventDefault(); onChange() }}
      className="shrink-0 w-5 h-5 rounded-md relative mt-0.5 cursor-pointer flex items-center justify-center transition-all"
      style={{
        background: checked ? 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))' : 'var(--ur-bg)',
        border: checked ? 'none' : '1.5px solid var(--ur-border-strong)',
        boxShadow: checked ? '0 1px 3px var(--ur-accent-ring)' : 'none',
      }}
    >
      <AnimatePresence>
        {checked && (
          <motion.svg
            key="check"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            style={{ color: 'var(--ur-text-on-accent)' }}
          >
            <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>
  )
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

function Modal({ title, subtitle, children, onClose, wide }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const titleId = useId()
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(8, 10, 14, 0.6)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ scale: 0.96, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.0, 0.2, 1] }}
          className="w-full rounded-2xl p-6 max-h-[92vh] overflow-y-auto"
          style={{
            background: 'var(--ur-surface)',
            border: '1px solid var(--ur-border)',
            boxShadow: 'var(--ur-shadow-lg)',
            maxWidth: wide ? 760 : 480,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 id={titleId} className="text-lg font-semibold tracking-tight" style={{ color: 'var(--ur-text)' }}>
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--ur-text-muted)' }}>{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              style={{ color: 'var(--ur-text-soft)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ur-surface-soft)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

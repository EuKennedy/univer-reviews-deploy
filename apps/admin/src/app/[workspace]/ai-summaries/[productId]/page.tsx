'use client'

/**
 * Sumário de IA — edição por produto
 *
 * Mostra os tópicos atuais do produto (manuais + gerados por IA), permite:
 *   - renomear tópico inline
 *   - adicionar tópico manual
 *   - anexar/desanexar reviews por tópico (drawer com search + filtros)
 *   - gerar/regenerar todos os tópicos com IA (substitui só os 'ai',
 *     manuais ficam)
 *   - deletar tópico
 *
 * URL: /[workspace]/ai-summaries/[productId]
 */

import { useId, useMemo, useState } from 'react'
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
  ChevronUp,
  Star,
  Edit2,
  Save,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { ActionButton } from '@/components/godmode/Toolbar'
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

  const { data: topics, isLoading } = useQuery({
    queryKey: ['ai-summary-topics', productId],
    queryFn: () => api.aiSummaryTopics.list(productId, getToken()).then(r => r.data),
    enabled: isAuthenticated && !!productId,
    refetchInterval: (q) => {
      // While the AI job is enqueued, the list will be empty or stale; keep
      // polling fast for the first 90 s so the merchant sees results fill in.
      const tops = q.state.data
      return Array.isArray(tops) && tops.some(t => t.source === 'ai') ? false : 8000
    },
  })

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.products.list({ }, getToken()).then(r =>
      r.data.find(p => p.id === productId) ?? null,
    ),
    enabled: isAuthenticated && !!productId,
  })

  const inv = () => queryClient.invalidateQueries({ queryKey: ['ai-summary-topics', productId] })

  const generateMut = useMutation({
    mutationFn: () => api.ai.generateSummaryTopics(productId, getToken()),
    onSuccess: () => {
      toast.success('Geração com IA iniciada — tópicos aparecem em ~30s.')
      void inv()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao gerar'),
  })

  const createMut = useMutation({
    mutationFn: (title: string) =>
      api.aiSummaryTopics.create({ product_id: productId, title }, getToken()),
    onSuccess: () => { toast.success('Tópico criado'); void inv() },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao criar tópico'),
  })

  const [newTitle, setNewTitle] = useState('')

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Sparkles className="w-5 h-5" />}
        title={product?.name ?? 'Carregando…'}
        subtitle="Edite os tópicos do sumário deste produto"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/${workspace}/ai-summaries`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text-soft)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
            <ActionButton
              variant="primary"
              onClick={() => generateMut.mutate()}
              disabled={generateMut.isPending}
            >
              {generateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {(topics?.some(t => t.source === 'ai') ? 'Regenerar' : 'Gerar')} com IA
            </ActionButton>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--ur-text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {(topics ?? []).map(t => (
              <TopicCard key={t.id} topic={t} productId={productId} />
            ))}

            {/* Manual create row */}
            <div
              className="flex gap-2 p-3 rounded-lg"
              style={{ background: 'var(--ur-bg-soft)', border: '1px dashed var(--ur-border)' }}
            >
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Adicionar tópico manualmente…"
                className="flex-1 text-sm rounded p-2 outline-none"
                style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTitle.trim()) {
                    createMut.mutate(newTitle.trim())
                    setNewTitle('')
                  }
                }}
              />
              <ActionButton
                variant="primary"
                onClick={() => {
                  if (!newTitle.trim()) return
                  createMut.mutate(newTitle.trim())
                  setNewTitle('')
                }}
                disabled={!newTitle.trim() || createMut.isPending}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </ActionButton>
            </div>

            {(topics ?? []).length === 0 && (
              <p
                className="text-center text-xs mt-6"
                style={{ color: 'var(--ur-text-muted)' }}
              >
                Nenhum tópico ainda. Clique em <b>Gerar com IA</b> para criar 3-6 tópicos automaticamente
                ou digite um título acima para curar manualmente.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Topic card ──────────────────────────────────────────────────────────────

function TopicCard({ topic, productId }: { topic: AiSummaryTopic; productId: string }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(topic.title)
  const [expanded, setExpanded] = useState(false)
  const [attachingOpen, setAttachingOpen] = useState(false)

  const { data: detail } = useQuery({
    queryKey: ['ai-summary-topic', topic.id],
    queryFn: () => api.aiSummaryTopics.get(topic.id, getToken()),
    enabled: expanded,
  })

  const inv = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-summary-topic', topic.id] })
    queryClient.invalidateQueries({ queryKey: ['ai-summary-topics', productId] })
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
    mutationFn: (reviewId: string) =>
      api.aiSummaryTopics.detachReviews(topic.id, [reviewId], getToken()),
    onSuccess: () => { toast.success('Review removida'); inv() },
  })

  const stars = topic.stars_avg != null ? Number(topic.stars_avg) : null
  const reviews = detail?.reviews ?? []

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Recolher' : 'Expandir'}
          className="p-1 rounded"
          style={{ color: 'var(--ur-text-muted)' }}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Source badge */}
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
          style={{
            background: topic.source === 'ai' ? 'var(--ur-accent-glow)' : 'var(--ur-surface-soft)',
            color: topic.source === 'ai' ? 'var(--ur-accent)' : 'var(--ur-text-muted)',
          }}
        >
          {topic.source === 'ai' ? <Sparkles className="w-2.5 h-2.5" /> : null}
          {topic.source === 'ai' ? 'IA' : 'Manual'}
        </span>

        {/* Title (renameable) */}
        {renaming ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) updateMut.mutate()
              if (e.key === 'Escape') { setRenaming(false); setTitle(topic.title) }
            }}
            className="flex-1 text-sm rounded p-1.5 outline-none"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-accent-soft-3)', color: 'var(--ur-text)' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="flex-1 text-left text-sm font-medium"
            style={{ color: 'var(--ur-text)' }}
            title="Clique pra renomear"
          >
            {topic.title}
          </button>
        )}

        {/* Stats */}
        <div className="flex items-center gap-2 shrink-0">
          {stars != null && (
            <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: 'var(--ur-warn)' }}>
              <Star className="w-3 h-3 fill-current" />
              {stars.toFixed(1)}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            {topic.review_count} reviews
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {renaming ? (
            <button
              type="button"
              onClick={() => updateMut.mutate()}
              disabled={!title.trim() || updateMut.isPending}
              className="p-1.5 rounded"
              style={{ color: 'var(--ur-accent)' }}
            >
              {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="p-1.5 rounded"
              style={{ color: 'var(--ur-text-muted)' }}
              aria-label="Renomear"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remover tópico "${topic.title}"?`)) deleteMut.mutate()
            }}
            className="p-1.5 rounded"
            style={{ color: 'var(--ur-danger)' }}
            aria-label="Remover"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--ur-border)' }}>
          {topic.ai_summary && (
            <p className="text-xs italic mt-3 mb-3" style={{ color: 'var(--ur-text-soft)' }}>
              {topic.ai_summary}
            </p>
          )}

          {reviews.length === 0 ? (
            <p className="text-xs my-3" style={{ color: 'var(--ur-text-muted)' }}>
              Nenhuma review anexada.
            </p>
          ) : (
            <div className="space-y-2 mt-3">
              {reviews.map(r => (
                <div
                  key={r.id}
                  className="flex items-start gap-2 p-2 rounded"
                  style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs mb-0.5">
                      <span style={{ color: 'var(--ur-warn)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      <strong style={{ color: 'var(--ur-text)' }}>{r.author_name ?? '—'}</strong>
                    </div>
                    {r.title && (
                      <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>{r.title}</p>
                    )}
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--ur-text-soft)' }}>{r.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => detachMut.mutate(r.id)}
                    className="p-1"
                    style={{ color: 'var(--ur-danger)' }}
                    aria-label="Desanexar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setAttachingOpen(true)}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded"
            style={{ background: 'var(--ur-accent-soft)', color: 'var(--ur-accent)', border: '1px solid var(--ur-accent-soft-3)' }}
          >
            <Plus className="w-3 h-3" />
            Adicionar reviews
          </button>
        </div>
      )}

      {attachingOpen && (
        <ReviewPickerModal
          productId={productId}
          topicId={topic.id}
          excludeIds={(detail?.reviews ?? []).map(r => r.id)}
          onClose={() => setAttachingOpen(false)}
          onAttached={inv}
        />
      )}
    </div>
  )
}

// ─── Review picker (modal with search + filters + checkboxes) ────────────────

function ReviewPickerModal({
  productId,
  topicId,
  excludeIds,
  onClose,
  onAttached,
}: {
  productId: string
  topicId: string
  excludeIds: string[]
  onClose: () => void
  onAttached: () => void
}) {
  const { getToken } = useAuth()
  const [query, setQuery] = useState('')
  const [minRating, setMinRating] = useState<number | null>(null)
  const [withMedia, setWithMedia] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['reviews-pick', productId, query, minRating, withMedia],
    queryFn: () =>
      api.reviews.list(
        {
          product_id: productId,
          status: 'approved',
          per_page: 50,
          q: query || undefined,
          rating: minRating ?? undefined,
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
      toast.success(`${r.attached} review(s) anexada(s)`)
      onAttached()
      onClose()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao anexar'),
  })

  const toggle = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  return (
    <Modal title="Anexar reviews ao tópico" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no corpo da review…"
            className="flex-1 text-sm rounded-lg p-2 outline-none"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
          />
          <select
            value={minRating ?? ''}
            onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : null)}
            className="text-sm rounded-lg p-2"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
          >
            <option value="">Todas estrelas</option>
            <option value="5">5★</option>
            <option value="4">4★</option>
            <option value="3">3★</option>
            <option value="2">2★</option>
            <option value="1">1★</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded cursor-pointer"
                 style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text-soft)' }}>
            <input
              type="checkbox"
              checked={withMedia}
              onChange={(e) => setWithMedia(e.target.checked)}
              className="accent-[var(--ur-accent)]"
            />
            Com mídia
          </label>
        </div>

        <div
          className="rounded-lg overflow-hidden"
          style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}
        >
          <div className="max-h-96 overflow-y-auto divide-y" style={{ borderColor: 'var(--ur-border)' }}>
            {isLoading ? (
              <div className="p-6 flex items-center justify-center" style={{ color: 'var(--ur-text-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="p-6 text-xs text-center" style={{ color: 'var(--ur-text-muted)' }}>
                Nenhuma review bate com esse filtro.
              </p>
            ) : (
              items.map((r: Review) => {
                const checked = selected.includes(r.id)
                return (
                  <label
                    key={r.id}
                    className="flex items-start gap-2 p-3 cursor-pointer transition-colors"
                    style={{ background: checked ? 'var(--ur-accent-glow)' : 'transparent' }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.id)}
                      className="mt-1 accent-[var(--ur-accent)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs mb-0.5">
                        <span style={{ color: 'var(--ur-warn)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <strong style={{ color: 'var(--ur-text)' }}>{r.author_name ?? '—'}</strong>
                      </div>
                      {r.title && <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>{r.title}</p>}
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--ur-text-soft)' }}>{r.body}</p>
                    </div>
                  </label>
                )
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="px-3 py-1.5 text-xs" style={{ background: 'var(--ur-bg-soft)', borderTop: '1px solid var(--ur-border)', color: 'var(--ur-accent)' }}>
              {selected.length} selecionada(s)
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <ActionButton onClick={onClose}>Cancelar</ActionButton>
        <ActionButton
          variant="primary"
          onClick={() => attachMut.mutate()}
          disabled={selected.length === 0 || attachMut.isPending}
        >
          {attachMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Anexar {selected.length || ''}
        </ActionButton>
      </div>
    </Modal>
  )
}

// ─── Modal helper ────────────────────────────────────────────────────────────

function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const titleId = useId()
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--ur-overlay)' }}
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full rounded-xl p-5 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--ur-bg-soft)',
          border: '1px solid var(--ur-border)',
          maxWidth: wide ? 720 : 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="text-base font-semibold" style={{ color: 'var(--ur-text)' }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md"
            style={{ color: 'var(--ur-text-soft)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

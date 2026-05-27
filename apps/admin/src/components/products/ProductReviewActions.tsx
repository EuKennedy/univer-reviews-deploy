'use client'

/**
 * Per-product action menu rendered in the Products table.
 *
 * Two actions:
 *   1. "Escrever avaliação" — opens ReviewComposer modal to manually author
 *      a single review for the product (any rating, custom author / title /
 *      body). Saves immediately as `manual` source.
 *
 *   2. "Gerar com IA" — opens BulkAIGenerator modal which calls
 *      /ai/bulk-create-reviews and /ai/bulk-create-questions on Claude.
 *      Operator picks a count, optional tone, status (pending/approved),
 *      and the API generates + persists in one shot.
 *
 * Both modals reuse the focus-trap helper and follow the dialog a11y
 * pattern already established in apps/admin/src/components/godmode.
 */

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, Sparkles, Wand2, Loader2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useFocusTrap } from '@/lib/useFocusTrap'
import type { Product } from '@/types'

type Mode = null | 'manual' | 'ai'

export function ProductReviewActions({ product }: { product: Product }) {
  const [mode, setMode] = useState<Mode>(null)

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className="px-2 py-1 rounded text-xs font-medium transition-colors"
          style={{
            background: 'var(--ur-surface-soft)',
            border: '1px solid var(--ur-border)',
            color: 'var(--ur-text)',
          }}
          aria-label={`Escrever avaliação para ${product.name}`}
          title="Escrever avaliação manual"
        >
          <Star className="w-3.5 h-3.5 inline -mt-px mr-1" />
          Avaliar
        </button>
        <button
          type="button"
          onClick={() => setMode('ai')}
          className="px-2 py-1 rounded text-xs font-medium transition-colors"
          style={{
            background: 'var(--ur-accent-soft)',
            border: '1px solid var(--ur-accent-soft-3)',
            color: 'var(--ur-accent)',
          }}
          aria-label={`Gerar avaliações com IA para ${product.name}`}
          title="Gerar reviews + Q&A com IA"
        >
          <Sparkles className="w-3.5 h-3.5 inline -mt-px mr-1" />
          Gerar IA
        </button>
      </div>

      {mode === 'manual' && (
        <ManualReviewModal product={product} onClose={() => setMode(null)} />
      )}
      {mode === 'ai' && (
        <BulkAIGeneratorModal product={product} onClose={() => setMode(null)} />
      )}
    </>
  )
}

// ─── Manual review composer ────────────────────────────────────────────────

function ManualReviewModal({
  product,
  onClose,
}: {
  product: Product
  onClose: () => void
}) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const dialogRef = useFocusTrap<HTMLDivElement>(true, onClose)

  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [authorEmail, setAuthorEmail] = useState('')
  const [status, setStatus] = useState<'pending' | 'approved'>('approved')

  const submit = useMutation({
    mutationFn: async () => {
      return api.reviews.create(
        {
          product_id: product.id,
          rating,
          title: title.trim() || undefined,
          body: body.trim(),
          author_name: authorName.trim() || 'Cliente verificado',
          author_email: authorEmail.trim() || undefined,
          status,
        },
        getToken(),
      )
    },
    onSuccess: () => {
      toast.success('Avaliação criada')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Falha ao criar avaliação'
      toast.error(msg)
    },
  })

  return (
    <ModalShell ref={dialogRef} title={`Escrever avaliação · ${product.name}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!body.trim()) {
            toast.error('Body da avaliação é obrigatório')
            return
          }
          submit.mutate()
        }}
        className="flex flex-col gap-3"
      >
        <Field label="Nota">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} estrelas`}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className="w-6 h-6"
                  fill={n <= rating ? 'var(--ur-accent)' : 'none'}
                  stroke={n <= rating ? 'var(--ur-accent)' : 'var(--ur-text-muted)'}
                />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Título (opcional)">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2 rounded-md text-sm outline-none"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
          />
        </Field>

        <Field label="Avaliação *">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={5}
            required
            className="w-full px-3 py-2 rounded-md text-sm outline-none resize-y"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
          />
          <div className="mt-1 text-xs text-right" style={{ color: 'var(--ur-text-muted)' }}>
            {body.length} / 4000
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome do autor">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={120}
              placeholder="Cliente verificado"
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
            />
          </Field>
          <Field label="E-mail (opcional)">
            <input
              type="email"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              maxLength={254}
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
            />
          </Field>
        </div>

        <Field label="Status">
          <div className="flex gap-2">
            {(['approved', 'pending'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: status === s ? 'var(--ur-accent-soft)' : 'var(--ur-bg)',
                  border: `1px solid ${status === s ? 'var(--ur-accent-soft-3)' : 'var(--ur-border)'}`,
                  color: status === s ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
                }}
              >
                {s === 'approved' ? 'Publicar direto' : 'Deixar pendente'}
              </button>
            ))}
          </div>
        </Field>

        <ModalFooter
          loading={submit.isPending}
          onCancel={onClose}
          submitLabel="Salvar avaliação"
        />
      </form>
    </ModalShell>
  )
}

// ─── Bulk AI generator ─────────────────────────────────────────────────────

function BulkAIGeneratorModal({
  product,
  onClose,
}: {
  product: Product
  onClose: () => void
}) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const dialogRef = useFocusTrap<HTMLDivElement>(true, onClose)

  const [tab, setTab] = useState<'reviews' | 'qa'>('reviews')

  // Reviews tab state
  const [reviewCount, setReviewCount] = useState(5)
  const [reviewTone, setReviewTone] = useState('positivo, autêntico, variado')
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'approved'>('approved')
  const [dateSpread, setDateSpread] = useState(30)

  // Q&A tab state
  const [qaCount, setQaCount] = useState(5)
  const [qaStatus, setQaStatus] = useState<'pending' | 'published'>('published')

  // Chunked client-side progress. Big batches (count > 10) were crashing
  // server-side because Claude truncated mid-array at max_tokens. Now we
  // split the job into chunks of REVIEW_CHUNK and aggregate locally,
  // which also gives the operator a real progress bar instead of one
  // long opaque wait.
  const REVIEW_CHUNK = 10
  const [progress, setProgress] = useState<{
    state: 'idle' | 'running' | 'done' | 'error'
    done: number
    total: number
    stage: string
    chunkIndex: number
    chunkCount: number
    error?: string
  }>({ state: 'idle', done: 0, total: 0, stage: '', chunkIndex: 0, chunkCount: 0 })

  const STAGE_COPY = [
    'Lendo o produto…',
    'Pedindo variações pra IA…',
    'Aplicando o tom de voz…',
    'Espalhando datas pra ficar natural…',
    'Salvando lote no banco…',
  ]

  async function runChunkedBulkReviews() {
    const total = reviewCount
    const chunkCount = Math.ceil(total / REVIEW_CHUNK)
    setProgress({ state: 'running', done: 0, total, stage: STAGE_COPY[0], chunkIndex: 0, chunkCount })

    let cycled = 0
    const stageTimer = window.setInterval(() => {
      cycled = (cycled + 1) % STAGE_COPY.length
      setProgress((p) => (p.state === 'running' ? { ...p, stage: STAGE_COPY[cycled] } : p))
    }, 2200)

    let createdTotal = 0
    try {
      for (let i = 0; i < chunkCount; i++) {
        const remaining = total - createdTotal
        const thisChunk = Math.min(REVIEW_CHUNK, remaining)
        setProgress((p) => ({ ...p, chunkIndex: i + 1 }))

        const res = await api.ai.bulkCreateReviews(
          {
            product_id: product.id,
            count: thisChunk,
            tone: reviewTone,
            status: reviewStatus,
            date_spread_days: dateSpread,
          },
          getToken(),
        )

        createdTotal += res.meta.created
        setProgress((p) => ({ ...p, done: createdTotal }))
      }

      setProgress((p) => ({ ...p, state: 'done', stage: `${createdTotal} avaliações criadas` }))
      toast.success(`${createdTotal} avaliações geradas com IA`)
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      // Hold the success state visible for a beat so the operator sees
      // the 100% bar before the modal closes.
      window.setTimeout(onClose, 900)
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Falha na geração IA'
      setProgress((p) => ({ ...p, state: 'error', error: msg }))
      toast.error(msg)
    } finally {
      window.clearInterval(stageTimer)
    }
  }

  // Adapter so the old mutation-style API used elsewhere on the page
  // doesn't have to know about progress state. `isPending` mirrors the
  // running state.
  const genReviews = {
    isPending: progress.state === 'running',
    mutate: () => { void runChunkedBulkReviews() },
  }

  const genQuestions = useMutation({
    mutationFn: () =>
      api.ai.bulkCreateQuestions(
        {
          product_id: product.id,
          count: qaCount,
          status: qaStatus,
        },
        getToken(),
      ),
    onSuccess: (res) => {
      toast.success(`${res.meta.created} perguntas + respostas geradas`)
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Falha na geração IA'
      toast.error(msg)
    },
  })

  const busy = genReviews.isPending || genQuestions.isPending

  return (
    <ModalShell ref={dialogRef} title={`Gerar com IA · ${product.name}`} onClose={onClose}>
      <div
        className="flex p-1 rounded-lg mb-4"
        style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}
        role="tablist"
      >
        {(['reviews', 'qa'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="flex-1 py-1.5 text-xs font-medium rounded-md transition-all"
            style={{
              background: tab === t ? 'var(--ur-border)' : 'transparent',
              color: tab === t ? 'var(--ur-text)' : 'var(--ur-text-muted)',
            }}
          >
            {t === 'reviews' ? 'Avaliações' : 'Perguntas & Respostas'}
          </button>
        ))}
      </div>

      {tab === 'reviews' && progress.state === 'running' && (
        <BulkProgressPanel
          done={progress.done}
          total={progress.total}
          chunkIndex={progress.chunkIndex}
          chunkCount={progress.chunkCount}
          stage={progress.stage}
        />
      )}

      {tab === 'reviews' && progress.state === 'done' && (
        <div
          className="rounded-xl p-4 mb-4 flex items-center gap-3"
          style={{ background: 'var(--ur-success-bg)', border: '1px solid var(--ur-success)', color: 'var(--ur-success)' }}
        >
          <Check className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{progress.stage}</span>
        </div>
      )}

      {tab === 'reviews' && progress.state === 'error' && (
        <div
          className="rounded-xl p-4 mb-4 text-sm"
          style={{ background: 'var(--ur-danger-bg)', border: '1px solid var(--ur-danger)', color: 'var(--ur-danger)' }}
        >
          <p className="font-semibold">Falha na geração</p>
          <p className="text-xs mt-1 opacity-90">{progress.error}</p>
        </div>
      )}

      {tab === 'reviews' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            genReviews.mutate()
          }}
          className="flex flex-col gap-3"
          aria-hidden={progress.state === 'running'}
          style={progress.state === 'running' ? { opacity: 0.4, pointerEvents: 'none' } : {}}
        >
          <Field label="Quantidade (1–50)">
            <input
              type="number"
              min={1}
              max={50}
              value={reviewCount}
              onChange={(e) => setReviewCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
            />
          </Field>

          <Field label="Tom (instrução pra IA)">
            <input
              type="text"
              value={reviewTone}
              onChange={(e) => setReviewTone(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
            />
          </Field>

          <Field label="Espalhar datas em até N dias (0 = todas hoje)">
            <input
              type="number"
              min={0}
              max={365}
              value={dateSpread}
              onChange={(e) => setDateSpread(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
            />
          </Field>

          <Field label="Status">
            <div className="flex gap-2">
              {(['approved', 'pending'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setReviewStatus(s)}
                  className="flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: reviewStatus === s ? 'var(--ur-accent-soft)' : 'var(--ur-bg)',
                    border: `1px solid ${reviewStatus === s ? 'var(--ur-accent-soft-3)' : 'var(--ur-border)'}`,
                    color: reviewStatus === s ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
                  }}
                >
                  {s === 'approved' ? 'Publicar direto' : 'Deixar pendente'}
                </button>
              ))}
            </div>
          </Field>

          <ModalFooter
            loading={busy}
            onCancel={onClose}
            submitLabel={`Gerar ${reviewCount} avaliações`}
            icon={<Wand2 className="w-4 h-4" />}
          />
        </form>
      )}

      {tab === 'qa' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            genQuestions.mutate()
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Quantidade (1–30)">
            <input
              type="number"
              min={1}
              max={30}
              value={qaCount}
              onChange={(e) => setQaCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
            />
          </Field>

          <Field label="Status">
            <div className="flex gap-2">
              {(['published', 'pending'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQaStatus(s)}
                  className="flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: qaStatus === s ? 'var(--ur-accent-soft)' : 'var(--ur-bg)',
                    border: `1px solid ${qaStatus === s ? 'var(--ur-accent-soft-3)' : 'var(--ur-border)'}`,
                    color: qaStatus === s ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
                  }}
                >
                  {s === 'published' ? 'Publicar direto' : 'Deixar pendente'}
                </button>
              ))}
            </div>
          </Field>

          <ModalFooter
            loading={busy}
            onCancel={onClose}
            submitLabel={`Gerar ${qaCount} perguntas`}
            icon={<Wand2 className="w-4 h-4" />}
          />
        </form>
      )}
    </ModalShell>
  )
}

// ─── Shared modal primitives ───────────────────────────────────────────────

const ModalShell = ({
  ref,
  title,
  onClose,
  children,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  title: string
  onClose: () => void
  children: React.ReactNode
}) => {
  // Lock body scroll while modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-action-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--ur-surface)',
          border: '1px solid var(--ur-border)',
          boxShadow: '0 32px 64px var(--ur-overlay)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <h2
            id="product-action-title"
            className="text-lg font-bold tracking-tight pr-6"
            style={{ color: 'var(--ur-text)' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span
      className="block text-xs font-medium mb-1.5"
      style={{ color: 'var(--ur-text-soft)' }}
    >
      {label}
    </span>
    {children}
  </label>
)

// Inline progress panel rendered above the bulk-reviews form while a
// generation job is running. Shows percent done, lot index (chunk N of
// M) and a rotating stage caption so the operator understands what's
// happening behind the scenes instead of staring at a spinner.
function BulkProgressPanel({
  done,
  total,
  chunkIndex,
  chunkCount,
  stage,
}: {
  done: number
  total: number
  chunkIndex: number
  chunkCount: number
  stage: string
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: 'var(--ur-accent-soft)',
        border: '1px solid var(--ur-accent-soft-3)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--ur-accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
            Gerando avaliações com IA…
          </span>
        </div>
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: 'var(--ur-accent)' }}
        >
          {done} / {total}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden mb-2"
        style={{ background: 'var(--ur-bg)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--ur-accent), var(--ur-accent-strong))',
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ur-text-soft)' }}>
        <span>Lote {chunkIndex} de {chunkCount}</span>
        <span className="italic">{stage}</span>
      </div>
    </div>
  )
}

const ModalFooter = ({
  loading,
  onCancel,
  submitLabel,
  icon,
}: {
  loading: boolean
  onCancel: () => void
  submitLabel: string
  icon?: React.ReactNode
}) => (
  <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t"
    style={{ borderColor: 'var(--ur-border-soft)' }}
  >
    <button
      type="button"
      onClick={onCancel}
      className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
      style={{ color: 'var(--ur-text-muted)' }}
    >
      Cancelar
    </button>
    <button
      type="submit"
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-60"
      style={{
        background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
        color: 'var(--ur-text-on-accent)',
      }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon || <Check className="w-4 h-4" />}
      {submitLabel}
    </button>
  </div>
)

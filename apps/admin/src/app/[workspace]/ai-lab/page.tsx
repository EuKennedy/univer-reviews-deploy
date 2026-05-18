'use client'

/**
 * AI Lab — operational console for running Claude-backed actions on real
 * reviews. The page replaces the previous "paste a UUID" playground: it
 * lists workspace reviews with the same filter chips users already know
 * from /reviews, lets them multi-select, and exposes the four AI actions
 * in a bottom action bar.
 *
 * Each action result is rendered inline below the table (no modal that
 * eats the data). When ANTHROPIC_API_KEY is missing or still the
 * SET_ME_LATER placeholder, the page surfaces a banner with a link to
 * /settings#api-keys instead of silently failing.
 */

import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FlaskConical,
  ShieldCheck,
  MessageSquare,
  Copy as CopyIcon,
  Network,
  KeyRound,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/godmode/PageHeader'
import {
  Toolbar,
  SearchInput,
  FilterSelect,
  ActionButton,
} from '@/components/godmode/Toolbar'
import { Pagination } from '@/components/godmode/Pagination'
import { RatingStars } from '@/components/reviews/RatingStars'
import { StatusBadge } from '@/components/reviews/StatusBadge'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { truncate, getInitials } from '@/lib/utils'
import type {
  Review,
  ReviewListParams,
  ReviewStatus,
  AiModerateResult,
  AiSimilarReview,
  ReviewVariant,
} from '@/types'

// ────────────────────────────────────────────────────────────────────────────
// Local helpers

type AiActionId = 'moderate' | 'reply' | 'dedup' | 'embed'

interface ModerateBucket {
  kind: 'moderate'
  results: Array<{ review: Review; result: AiModerateResult }>
}
interface ReplyBucket {
  kind: 'reply'
  results: Array<{ review: Review; reply: string }>
}
interface DedupBucket {
  kind: 'dedup'
  results: Array<{ review: Review; similar: AiSimilarReview[]; queued: boolean }>
}
interface EmbedBucket {
  kind: 'embed'
  results: Array<{ review: Review; queued: boolean }>
}
type ResultsBucket = ModerateBucket | ReplyBucket | DedupBucket | EmbedBucket | null

const STATUS_OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: 'pending',  label: 'Pendente' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Rejeitado' },
  { value: 'hidden',   label: 'Oculto' },
  { value: 'spam',     label: 'Spam' },
]

const SENTIMENT_OPTIONS = [
  { value: 'positive', label: 'Positivo' },
  { value: 'neutral',  label: 'Neutro' },
  { value: 'negative', label: 'Negativo' },
  { value: 'mixed',    label: 'Misto' },
]

const RATING_OPTIONS = [
  { value: '5', label: '5 estrelas' },
  { value: '4', label: '4 estrelas' },
  { value: '3', label: '3 estrelas' },
  { value: '2', label: '2 estrelas' },
  { value: '1', label: '1 estrela' },
]

// Backend serialises ai_* fields flat on each review record, so we read
// them directly without the TS `Review.ai_analysis` nesting (which is a
// pre-existing shape mismatch, out of scope here).
interface ReviewWithAi extends Review {
  ai_quality_score?: number | null
  ai_sentiment?: string | null
  ai_topics?: string[] | null
  ai_is_synthetic?: boolean | null
  ai_flagged_reason?: string | null
}

function isMissingKeyError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 503
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components

function KeyStatusBanner({
  workspace,
  configured,
  reason,
  loading,
}: {
  workspace: string
  configured: boolean
  reason: string
  loading: boolean
}) {
  if (loading) return null
  if (configured) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2 mx-4 mt-3 rounded-lg text-xs"
        style={{
          background: 'var(--ur-success-bg)',
          border: '1px solid var(--ur-success-bg)',
          color: 'var(--ur-success)',
        }}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>
          ANTHROPIC_API_KEY configurada — modelos Sonnet/Haiku disponíveis.
        </span>
        <Link
          href={`/${workspace}/settings#api-keys`}
          className="ml-auto underline-offset-2 hover:underline"
          style={{ color: 'var(--ur-success)' }}
        >
          Gerenciar
        </Link>
      </div>
    )
  }
  const msg =
    reason === 'placeholder'
      ? 'ANTHROPIC_API_KEY ainda está com o valor placeholder "SET_ME_LATER".'
      : 'ANTHROPIC_API_KEY não foi configurada no servidor.'
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 mx-4 mt-3 rounded-lg text-xs"
      style={{
        background: 'var(--ur-danger-bg)',
        border: '1px solid var(--ur-danger-bg)',
        color: 'var(--ur-danger)',
      }}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">{msg} Toda ação de IA falhará até a chave ser definida.</span>
      <Link
        href={`/${workspace}/settings#api-keys`}
        className="flex items-center gap-1 px-2 py-1 rounded-md font-medium"
        style={{
          background: 'var(--ur-danger-bg)',
          border: '1px solid var(--ur-danger-bg)',
          color: 'var(--ur-danger)',
        }}
      >
        <KeyRound className="w-3 h-3" />
        Configurar
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  )
}

function ReviewRow({
  review,
  selected,
  onToggle,
}: {
  review: ReviewWithAi
  selected: boolean
  onToggle: () => void
}) {
  return (
    <tr
      onClick={onToggle}
      className="group transition-colors cursor-pointer"
      style={{ borderBottom: '1px solid var(--ur-border-soft)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--ur-surface-soft)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = selected ? 'var(--ur-accent-glow)' : 'transparent'
      }}
    >
      <td className="px-4 py-3 w-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5"
          style={{ accentColor: 'var(--ur-accent)' }}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'var(--ur-accent-soft)', color: 'var(--ur-accent)' }}
          >
            {getInitials(review.author_name)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--ur-text)' }}>
              {review.author_name}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--ur-text-muted)' }}>
              {format(new Date(review.created_at), "d MMM, yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 w-32">
        <RatingStars rating={review.rating} size="xs" showValue />
      </td>
      <td className="px-4 py-3 max-w-md">
        <p className="text-xs" style={{ color: 'var(--ur-text-soft)' }}>
          {truncate(review.body ?? '', 110)}
        </p>
      </td>
      <td className="px-4 py-3 w-28">
        <StatusBadge status={review.status} size="sm" />
      </td>
      <td className="px-4 py-3 w-32">
        {review.ai_sentiment ? (
          <span
            className="text-xs px-2 py-0.5 rounded-full capitalize"
            style={{
              background:
                review.ai_sentiment === 'positive'
                  ? 'var(--ur-success-bg)'
                  : review.ai_sentiment === 'negative'
                  ? 'var(--ur-danger-bg)'
                  : 'var(--ur-warn-bg)',
              color:
                review.ai_sentiment === 'positive'
                  ? 'var(--ur-success)'
                  : review.ai_sentiment === 'negative'
                  ? 'var(--ur-danger)'
                  : 'var(--ur-warn)',
              border: '1px solid currentColor',
            }}
          >
            {review.ai_sentiment}
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--ur-text-faint)' }}>—</span>
        )}
      </td>
      <td className="px-4 py-3 w-20 text-right">
        {typeof review.ai_quality_score === 'number' ? (
          <span
            className="text-xs font-mono tabular-nums"
            style={{
              color:
                review.ai_quality_score >= 70
                  ? 'var(--ur-success)'
                  : review.ai_quality_score >= 40
                  ? 'var(--ur-warn)'
                  : 'var(--ur-danger)',
            }}
          >
            {review.ai_quality_score}
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--ur-text-faint)' }}>—</span>
        )}
      </td>
    </tr>
  )
}

function ResultsPanel({
  bucket,
  onClose,
}: {
  bucket: ResultsBucket
  onClose: () => void
}) {
  if (!bucket) return null

  const titles: Record<AiActionId, string> = {
    moderate: 'Moderação por IA',
    reply:    'Respostas geradas',
    dedup:    'Análise de duplicatas',
    embed:    'Embeddings (busca semântica)',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="mx-4 mb-4 rounded-xl overflow-hidden"
      style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--ur-border)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--ur-accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
            {titles[bucket.kind]}
          </h3>
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            • {bucket.results.length}{' '}
            {bucket.results.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--ur-text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ur-text)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ur-text-muted)' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--ur-surface-soft)' }}>
        {bucket.kind === 'moderate' &&
          bucket.results.map(({ review, result }) => (
            <ModerateResultCard key={review.id} review={review} result={result} />
          ))}
        {bucket.kind === 'reply' &&
          bucket.results.map(({ review, reply }) => (
            <ReplyResultCard key={review.id} review={review} reply={reply} />
          ))}
        {bucket.kind === 'dedup' &&
          bucket.results.map(({ review, similar, queued }) => (
            <DedupResultCard
              key={review.id}
              review={review}
              similar={similar}
              queued={queued}
            />
          ))}
        {bucket.kind === 'embed' &&
          bucket.results.map(({ review, queued }) => (
            <EmbedResultCard key={review.id} review={review} queued={queued} />
          ))}
      </div>
    </motion.div>
  )
}

function ResultHeader({ review }: { review: Review }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: 'var(--ur-accent-soft)', color: 'var(--ur-accent)' }}
      >
        {getInitials(review.author_name)}
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--ur-text)' }}>
        {review.author_name}
      </span>
      <RatingStars rating={review.rating} size="xs" />
      <span
        className="text-xs truncate max-w-md"
        style={{ color: 'var(--ur-text-muted)' }}
      >
        {truncate(review.body ?? '', 70)}
      </span>
    </div>
  )
}

function ModerateResultCard({
  review,
  result,
}: {
  review: Review
  result: AiModerateResult
}) {
  const recommendationColor =
    result.recommendation === 'approve'
      ? 'var(--ur-success)'
      : result.recommendation === 'reject'
      ? 'var(--ur-danger)'
      : 'var(--ur-warn)'

  return (
    <div className="px-4 py-3.5">
      <ResultHeader review={review} />
      <div className="flex flex-wrap items-center gap-3 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>Qualidade</span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{
              color:
                result.quality_score >= 70
                  ? 'var(--ur-success)'
                  : result.quality_score >= 40
                  ? 'var(--ur-warn)'
                  : 'var(--ur-danger)',
            }}
          >
            {result.quality_score}
            <span className="text-xs font-normal" style={{ color: 'var(--ur-text-muted)' }}>/100</span>
          </span>
        </div>

        <div className="h-3 w-px" style={{ background: 'var(--ur-border-strong)' }} />

        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>Sentimento</span>
          <span
            className="text-xs font-medium capitalize"
            style={{ color: 'var(--ur-text)' }}
          >
            {result.sentiment}
          </span>
        </div>

        <div className="h-3 w-px" style={{ background: 'var(--ur-border-strong)' }} />

        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wide"
          style={{
            background: `${recommendationColor}15`,
            color: recommendationColor,
            border: `1px solid ${recommendationColor}30`,
          }}
        >
          {result.recommendation}
        </span>

        {result.is_synthetic && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--ur-danger-bg)',
              color: 'var(--ur-danger)',
              border: '1px solid var(--ur-danger-bg)',
            }}
          >
            Sintético {Math.round(result.synthetic_confidence * 100)}%
          </span>
        )}
      </div>

      {result.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {result.topics.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--ur-accent-glow)',
                color: 'var(--ur-accent)',
                border: '1px solid var(--ur-accent-soft-2)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {result.moderation_flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {result.moderation_flags.map((f) => (
            <span
              key={f}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--ur-danger-bg)',
                color: 'var(--ur-danger)',
                border: '1px solid var(--ur-danger-bg)',
              }}
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {result.reason && (
        <p
          className="text-xs mt-2.5 italic"
          style={{ color: 'var(--ur-text-soft)' }}
        >
          “{result.reason}”
        </p>
      )}
    </div>
  )
}

function ReplyResultCard({ review, reply }: { review: Review; reply: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="px-4 py-3.5">
      <ResultHeader review={review} />
      <div
        className="rounded-lg p-3 mt-2"
        style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-surface-soft)' }}
      >
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--ur-text)' }}
        >
          {reply}
        </p>
        <div className="flex items-center justify-end mt-2.5">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(reply)
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
              toast.success('Resposta copiada')
            }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
            style={{
              background: copied ? 'var(--ur-success-bg)' : 'var(--ur-surface-soft)',
              color: copied ? 'var(--ur-success)' : 'var(--ur-text-soft)',
              border: `1px solid ${copied ? 'var(--ur-success-bg)' : 'var(--ur-border-strong)'}`,
            }}
          >
            {copied ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <CopyIcon className="w-3 h-3" />
            )}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DedupResultCard({
  review,
  similar,
  queued,
}: {
  review: Review
  similar: AiSimilarReview[]
  queued: boolean
}) {
  return (
    <div className="px-4 py-3.5">
      <ResultHeader review={review} />
      {queued ? (
        <p className="text-xs italic mt-1" style={{ color: 'var(--ur-warn)' }}>
          Embedding ainda não calculado — uma job foi enfileirada. Volte em alguns instantes e rode novamente.
        </p>
      ) : similar.length === 0 ? (
        <p className="text-xs mt-1" style={{ color: 'var(--ur-text-muted)' }}>
          Nenhuma avaliação similar encontrada.
        </p>
      ) : (
        <div className="space-y-1.5 mt-2">
          {similar.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-surface-soft)' }}
            >
              <RatingStars rating={s.rating} size="xs" />
              <p
                className="text-xs flex-1 truncate"
                style={{ color: 'var(--ur-text-soft)' }}
              >
                {truncate(s.body ?? '', 100)}
              </p>
              <span
                className="text-xs font-mono tabular-nums shrink-0"
                style={{ color: 'var(--ur-text-muted)' }}
              >
                {(1 - s.neighbor_distance).toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmbedResultCard({
  review,
  queued,
}: {
  review: Review
  queued: boolean
}) {
  return (
    <div className="px-4 py-3.5">
      <ResultHeader review={review} />
      <p
        className="text-xs mt-1"
        style={{ color: queued ? 'var(--ur-success)' : 'var(--ur-text-muted)' }}
      >
        {queued
          ? 'Job de embedding enfileirada. O vetor estará disponível em poucos segundos.'
          : 'Embedding já existe para esta avaliação.'}
      </p>
    </div>
  )
}

function VariantsPreview({
  variants,
  onClose,
}: {
  variants: ReviewVariant[]
  onClose: () => void
}) {
  if (variants.length === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="mx-4 mb-4 rounded-xl overflow-hidden"
      style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--ur-border)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--ur-accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
            Variantes geradas
          </h3>
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            • {variants.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md"
          style={{ color: 'var(--ur-text-muted)' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--ur-surface-soft)' }}>
        {variants.map((v, i) => (
          <div key={v.id ?? i} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <RatingStars rating={v.rating} size="xs" />
              <CopyButton text={v.body} />
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ur-text)' }}>
              {v.body}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors"
      style={{
        background: copied ? 'var(--ur-success-bg)' : 'transparent',
        color: copied ? 'var(--ur-success)' : 'var(--ur-text-soft)',
        border: `1px solid ${copied ? 'var(--ur-success-bg)' : 'var(--ur-border-strong)'}`,
      }}
    >
      {copied ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <CopyIcon className="w-3 h-3" />
      )}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Page

export default function AiLabPage() {
  const params = useParams()
  const workspace = (params?.workspace as string) ?? ''
  const { getToken } = useAuth()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [rating, setRating] = useState('')
  const [sentiment, setSentiment] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [bucket, setBucket] = useState<ResultsBucket>(null)
  const [variants, setVariants] = useState<ReviewVariant[]>([])

  // ── Queries ────────────────────────────────────────────────────────────
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['ai-health', workspace],
    queryFn: () => api.ai.health(getToken()),
    staleTime: 30_000,
  })

  const queryParams: ReviewListParams = useMemo(
    () => ({
      page,
      per_page: 20,
      q: search || undefined,
      status: (status as ReviewStatus) || undefined,
      rating: rating ? Number(rating) : undefined,
    }),
    [page, search, status, rating]
  )

  const { data, isLoading: reviewsLoading } = useQuery({
    queryKey: ['ai-lab-reviews', workspace, queryParams, sentiment],
    queryFn: () => api.reviews.list(queryParams, getToken()),
  })

  // Backend ignores ai_sentiment as a filter, so we do it client-side.
  const reviews = useMemo<ReviewWithAi[]>(() => {
    const raw = (data?.data ?? []) as ReviewWithAi[]
    if (!sentiment) return raw
    return raw.filter((r) => r.ai_sentiment === sentiment)
  }, [data, sentiment])

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k)

  const selectedReviews = useMemo<ReviewWithAi[]>(
    () => reviews.filter((r) => selected[r.id]),
    [reviews, selected]
  )

  // ── Mutations ──────────────────────────────────────────────────────────
  const moderateMutation = useMutation({
    mutationFn: async (rs: ReviewWithAi[]) => {
      const out: { review: Review; result: AiModerateResult }[] = []
      for (const r of rs) {
        const result = await api.ai.moderate(r.id, getToken())
        out.push({ review: r, result })
      }
      return out
    },
    onSuccess: (results) => {
      setBucket({ kind: 'moderate', results })
      toast.success(`Moderação concluída para ${results.length} avaliação(ões)`)
    },
    onError: (err) => handleError(err, 'moderação'),
  })

  const replyMutation = useMutation({
    mutationFn: async (rs: ReviewWithAi[]) => {
      const out: { review: Review; reply: string }[] = []
      for (const r of rs) {
        const { reply } = await api.ai.reply(r.id, getToken())
        out.push({ review: r, reply })
      }
      return out
    },
    onSuccess: (results) => {
      setBucket({ kind: 'reply', results })
      toast.success(`Respostas geradas (${results.length})`)
    },
    onError: (err) => handleError(err, 'geração de resposta'),
  })

  const dedupMutation = useMutation({
    mutationFn: async (rs: ReviewWithAi[]) => {
      const out: { review: Review; similar: AiSimilarReview[]; queued: boolean }[] = []
      for (const r of rs) {
        try {
          const similar = await api.ai.findSimilar(r.id, getToken())
          out.push({ review: r, similar, queued: false })
        } catch (err) {
          // Reviews without an embedding return 422 + "no_embedding". Queue
          // one and surface a hint to the user instead of failing the row.
          if (err instanceof ApiError && err.status === 422) {
            try { await api.ai.embed(r.id, getToken()) } catch {/* best effort */}
            out.push({ review: r, similar: [], queued: true })
          } else {
            throw err
          }
        }
      }
      return out
    },
    onSuccess: (results) => {
      setBucket({ kind: 'dedup', results })
      const queued = results.filter((r) => r.queued).length
      if (queued > 0) {
        toast.info(
          `${queued} avaliação(ões) sem embedding — uma job foi enfileirada para cada uma.`
        )
      } else {
        toast.success('Análise de duplicatas concluída')
      }
    },
    onError: (err) => handleError(err, 'detecção de duplicatas'),
  })

  const embedMutation = useMutation({
    mutationFn: async (rs: ReviewWithAi[]) => {
      const out: { review: Review; queued: boolean }[] = []
      for (const r of rs) {
        await api.ai.embed(r.id, getToken())
        out.push({ review: r, queued: true })
      }
      return out
    },
    onSuccess: (results) => {
      setBucket({ kind: 'embed', results })
      toast.success(`Embeddings enfileiradas (${results.length})`)
    },
    onError: (err) => handleError(err, 'embedding'),
  })

  function handleError(err: unknown, label: string) {
    if (isMissingKeyError(err)) {
      toast.error(
        'ANTHROPIC_API_KEY não está configurada — configure em /settings antes de usar IA.'
      )
      return
    }
    const msg = err instanceof Error ? err.message : 'Falha desconhecida'
    toast.error(`Falha em ${label}: ${msg}`)
  }

  const runningAction =
    moderateMutation.isPending ||
    replyMutation.isPending ||
    dedupMutation.isPending ||
    embedMutation.isPending

  function runAction(action: AiActionId) {
    if (selectedReviews.length === 0) {
      toast.error('Selecione ao menos uma avaliação')
      return
    }
    if (!health?.configured) {
      toast.error('Configure ANTHROPIC_API_KEY antes de rodar IA')
      return
    }
    setBucket(null)
    setVariants([])
    switch (action) {
      case 'moderate': moderateMutation.mutate(selectedReviews); break
      case 'reply':    replyMutation.mutate(selectedReviews);    break
      case 'dedup':    dedupMutation.mutate(selectedReviews);    break
      case 'embed':    embedMutation.mutate(selectedReviews);    break
    }
  }

  function toggleRow(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  function toggleAllOnPage() {
    const allSelected = reviews.every((r) => selected[r.id])
    const next: Record<string, boolean> = { ...selected }
    reviews.forEach((r) => { next[r.id] = !allSelected })
    setSelected(next)
  }

  const allOnPageSelected =
    reviews.length > 0 && reviews.every((r) => selected[r.id])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full relative">
      <PageHeader
        icon={<FlaskConical className="w-5 h-5" />}
        title="Lab de IA"
        subtitle="Selecione avaliações reais e rode moderação, respostas, duplicatas e embeddings com Claude"
        actions={
          <div
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-surface-soft)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: health?.configured ? 'var(--ur-success)' : 'var(--ur-danger)',
                boxShadow: health?.configured
                  ? '0 0 8px rgba(34,197,94,0.6)'
                  : '0 0 8px rgba(239,68,68,0.4)',
              }}
            />
            <span style={{ color: 'var(--ur-text-muted)' }}>Anthropic</span>
            <span style={{ color: health?.configured ? 'var(--ur-success)' : 'var(--ur-danger)' }}>
              {healthLoading ? '...' : health?.configured ? 'pronto' : 'pendente'}
            </span>
          </div>
        }
      />

      <KeyStatusBanner
        workspace={workspace}
        configured={!!health?.configured}
        reason={health?.reason ?? ''}
        loading={healthLoading}
      />

      <Toolbar
        className="mt-3"
        left={
          <>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="Buscar avaliação…"
            />
            <FilterSelect
              value={status}
              onChange={(v) => { setStatus(v); setPage(1) }}
              options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
              placeholder="Todos os status"
            />
            <FilterSelect
              value={rating}
              onChange={(v) => { setRating(v); setPage(1) }}
              options={RATING_OPTIONS}
              placeholder="Todas as notas"
            />
            <FilterSelect
              value={sentiment}
              onChange={(v) => { setSentiment(v); setPage(1) }}
              options={SENTIMENT_OPTIONS}
              placeholder="Todos os sentimentos"
            />
          </>
        }
        right={
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            {data?.meta.total_count ?? 0} avaliações
          </span>
        }
      />

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--ur-border)' }}>
              <th
                className="px-4 py-2.5 text-left w-10"
                style={{ background: 'var(--ur-bg-soft)' }}
              >
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  className="w-3.5 h-3.5"
                  style={{ accentColor: 'var(--ur-accent)' }}
                />
              </th>
              {['Autor', 'Nota', 'Avaliação', 'Status', 'Sentimento IA', 'Qualidade'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ background: 'var(--ur-bg-soft)', color: 'var(--ur-text-muted)' }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {reviewsLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div
                        className="skeleton h-4 rounded"
                        style={{ width: j === 0 ? 16 : `${60 + Math.random() * 30}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                  Nenhuma avaliação encontrada com os filtros atuais.
                </td>
              </tr>
            ) : (
              reviews.map((r) => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  selected={!!selected[r.id]}
                  onToggle={() => toggleRow(r.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <Pagination
          currentPage={data.meta.current_page}
          totalPages={data.meta.total_pages}
          totalCount={data.meta.total_count}
          perPage={data.meta.per_page}
          onPageChange={setPage}
        />
      )}

      <AnimatePresence>
        {bucket && <ResultsPanel bucket={bucket} onClose={() => setBucket(null)} />}
        {variants.length > 0 && (
          <VariantsPreview variants={variants} onClose={() => setVariants([])} />
        )}
      </AnimatePresence>

      {/* Bottom action bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.18 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-5 z-30 flex items-center gap-2 px-3 py-2 rounded-xl shadow-2xl"
            style={{
              background: 'linear-gradient(180deg, var(--ur-surface-soft), var(--ur-surface))',
              border: '1px solid var(--ur-accent-soft-3)',
              boxShadow:
                '0 24px 80px var(--ur-overlay), 0 0 0 1px var(--ur-accent-glow)',
            }}
          >
            <span
              className="text-xs font-medium px-2 py-1 rounded-md"
              style={{
                background: 'var(--ur-accent-soft)',
                color: 'var(--ur-accent)',
              }}
            >
              {selectedIds.length} selecionada{selectedIds.length === 1 ? '' : 's'}
            </span>

            <div className="h-4 w-px" style={{ background: 'var(--ur-border-strong)' }} />

            <ActionButton
              onClick={() => runAction('moderate')}
              disabled={runningAction}
            >
              {moderateMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--ur-accent)' }} />
              )}
              Moderar com IA
            </ActionButton>

            <ActionButton
              onClick={() => runAction('reply')}
              disabled={runningAction}
            >
              {replyMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--ur-info)' }} />
              )}
              Gerar resposta
            </ActionButton>

            <ActionButton
              onClick={() => runAction('dedup')}
              disabled={runningAction}
            >
              {dedupMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CopyIcon className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
              )}
              Detectar duplicatas
            </ActionButton>

            <ActionButton
              onClick={() => runAction('embed')}
              disabled={runningAction}
            >
              {embedMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Network className="w-3.5 h-3.5" style={{ color: 'var(--ur-success)' }} />
              )}
              Embed
            </ActionButton>

            <button
              onClick={() => setSelected({})}
              className="p-1.5 rounded-md transition-colors ml-1"
              style={{ color: 'var(--ur-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ur-text)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ur-text-muted)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Failure case: no key — drop a callout under the table when the user
         has selections but the key is missing, so they don't wonder why the
         action button errors out. */}
      {selectedIds.length > 0 && !healthLoading && !health?.configured && (
        <div
          className="absolute right-5 bottom-24 z-20 flex items-start gap-2 max-w-sm px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'var(--ur-danger-bg)',
            border: '1px solid var(--ur-danger-bg)',
            color: 'var(--ur-danger)',
          }}
        >
          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Configure ANTHROPIC_API_KEY em{' '}
            <Link
              href={`/${workspace}/settings#api-keys`}
              className="underline underline-offset-2"
              style={{ color: 'var(--ur-danger)' }}
            >
              /settings
            </Link>{' '}
            antes de rodar qualquer ação.
          </span>
        </div>
      )}
    </div>
  )
}

'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import {
  Star,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trash2,
  Sparkles,
  Loader2,
  MessageSquare,
  Calendar,
  Globe,
  ShoppingBag,
  Shield,
  Pencil,
  Save,
  X,
  Upload,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/godmode/PageHeader'
import { StatusBadge } from '@/components/reviews/StatusBadge'
import { RatingStars } from '@/components/reviews/RatingStars'
import { AiScoreGauge } from '@/components/ai/AiScoreGauge'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/lib/utils'
import type { Review, ReviewStatus } from '@/types'
import Link from 'next/link'

export default function ReviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const workspace = params?.workspace as string
  const id = params?.id as string
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [replyText, setReplyText] = useState('')
  const [replyTone, setReplyTone] = useState('professional')
  const [generatingReply, setGeneratingReply] = useState(false)
  const [editing, setEditing] = useState(false)

  const { data: review, isLoading } = useQuery({
    queryKey: ['review', id],
    queryFn: () => api.reviews.get(id, getToken()),
  })

  const statusMutation = useMutation({
    mutationFn: (status: ReviewStatus) =>
      api.reviews.updateStatus(id, status, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review', id] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      toast.success('Status atualizado')
    },
    onError: () => toast.error('Falha ao atualizar status'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.reviews.delete(id, getToken()),
    onSuccess: () => {
      toast.success('Avaliação excluída')
      router.push(`/${workspace}/reviews`)
    },
    onError: () => toast.error('Falha ao excluir avaliação'),
  })

  const handleGenerateReply = async () => {
    setGeneratingReply(true)
    try {
      const result = await api.ai.autoReply(id, replyTone, getToken())
      setReplyText(result.reply)
      toast.success('Resposta gerada')
    } catch {
      toast.error('Falha ao gerar resposta')
    } finally {
      setGeneratingReply(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--ur-accent)' }} />
      </div>
    )
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: 'var(--ur-text-muted)' }}>Avaliação não encontrada</p>
      </div>
    )
  }

  // Null-safe field accessors — the page used to crash with a
  // client-side exception whenever author_name / created_at / replies
  // came back null (which happens for legacy import rows + reviews
  // created before we backfilled those columns). Bake defaults here
  // so the JSX below never touches a nullish chain.
  const authorName = (review.author_name || '').trim() || 'Cliente anônimo'
  const createdAtSafe = (() => {
    if (!review.created_at) return null
    const d = new Date(review.created_at)
    return Number.isNaN(d.getTime()) ? null : d
  })()
  const publishedAtSafe = (() => {
    if (!review.published_at) return null
    const d = new Date(review.published_at)
    return Number.isNaN(d.getTime()) ? null : d
  })()

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Star className="w-5 h-5" />}
        title="Detalhes da avaliação"
        subtitle={`Por ${authorName}`}
        breadcrumbs={[
          { label: 'Avaliações', href: `/${workspace}/reviews` },
          { label: authorName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/${workspace}/reviews`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text-soft)',
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </Link>

            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'var(--ur-accent-soft)',
                  border: '1px solid var(--ur-accent-soft-3)',
                  color: 'var(--ur-accent)',
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
            )}

            {review.status !== 'approved' && (
              <button
                onClick={() => statusMutation.mutate('approved')}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'var(--ur-success-bg)',
                  border: '1px solid var(--ur-success-bg)',
                  color: 'var(--ur-success)',
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aprovar
              </button>
            )}
            {review.status !== 'rejected' && (
              <button
                onClick={() => statusMutation.mutate('rejected')}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'var(--ur-danger-bg)',
                  border: '1px solid var(--ur-danger-bg)',
                  color: 'var(--ur-danger)',
                }}
              >
                <XCircle className="w-3.5 h-3.5" />
                Rejeitar
              </button>
            )}
            <button
              onClick={() => {
                if (confirm('Excluir esta avaliação permanentemente?')) {
                  deleteMutation.mutate()
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: 'var(--ur-danger-bg)',
                border: '1px solid var(--ur-danger-bg)',
                color: 'var(--ur-danger)',
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main review content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Review card — display or edit */}
            {editing ? (
              <EditReviewCard
                review={review}
                onCancel={() => setEditing(false)}
                onSaved={() => setEditing(false)}
              />
            ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-6"
              style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
            >
              {/* Author row */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ background: 'var(--ur-accent-soft)', color: 'var(--ur-accent)' }}
                >
                  {getInitials(authorName)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--ur-text)' }}>
                      {authorName}
                    </h2>
                    {(review.is_verified_purchase ?? review.verified_purchase) && (
                      <span
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: 'var(--ur-success-bg)',
                          color: 'var(--ur-success)',
                          border: '1px solid var(--ur-success-bg)',
                        }}
                      >
                        <Shield className="w-3 h-3" />
                        Verificado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <RatingStars rating={review.rating} size="sm" showValue />
                    <StatusBadge status={review.status} size="sm" />
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-4 mb-5 pb-5" style={{ borderBottom: '1px solid var(--ur-surface-soft)' }}>
                {[
                  ...(createdAtSafe
                    ? [{ icon: Calendar, label: format(createdAtSafe, "d 'de' MMM, yyyy", { locale: ptBR }) }]
                    : []),
                  ...(review.source ? [{ icon: Globe, label: review.source }] : []),
                  ...((review.product?.title || review.product_name) ? [{ icon: ShoppingBag, label: (review.product?.title || review.product_name)! }] : []),
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ur-text-soft)' }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: 'var(--ur-text-muted)' }} />
                    {label}
                  </div>
                ))}
              </div>

              {/* Content */}
              {review.title && (
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ur-text)' }}>
                  {review.title}
                </h3>
              )}
              {review.body ? (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ur-text)' }}>
                  {review.body}
                </p>
              ) : (
                <p className="text-sm italic" style={{ color: 'var(--ur-text-muted)' }}>
                  Cliente avaliou só com a nota — sem comentário escrito.
                </p>
              )}

              {/* Media */}
              {(review.media?.length ?? 0) > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--ur-text-muted)' }}>
                    Mídias ({review.media!.length})
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {review.media!.map((m) => (
                      <div
                        key={m.id}
                        className="w-20 h-20 rounded-lg overflow-hidden"
                        style={{ background: 'var(--ur-surface-soft)', border: '1px solid var(--ur-border-strong)' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.thumbnail_url ?? m.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
            )}

            {/* Reply section */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
            >
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid var(--ur-surface-soft)' }}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" style={{ color: 'var(--ur-accent)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
                    Resposta
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={replyTone}
                    onChange={(e) => setReplyTone(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-lg outline-none"
                    style={{
                      background: 'var(--ur-bg-soft)',
                      border: '1px solid var(--ur-surface-soft)',
                      color: 'var(--ur-text-soft)',
                    }}
                  >
                    {[
                      { value: 'professional', label: 'Profissional' },
                      { value: 'friendly', label: 'Amigável' },
                      { value: 'empathetic', label: 'Empático' },
                      { value: 'formal', label: 'Formal' },
                    ].map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleGenerateReply}
                    disabled={generatingReply}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: 'var(--ur-accent-soft)',
                      border: '1px solid var(--ur-accent-soft-3)',
                      color: 'var(--ur-accent)',
                    }}
                  >
                    {generatingReply ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Gerar com IA
                  </button>
                </div>
              </div>

              <div className="p-5">
                {/* Existing replies */}
                {(review.replies?.length ?? 0) > 0 && (
                  <div className="space-y-3 mb-4">
                    {review.replies!.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-lg px-4 py-3"
                        style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-surface-soft)' }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium" style={{ color: 'var(--ur-text)' }}>
                            {reply.author_name ?? reply.author ?? 'Equipe'}
                          </span>
                          {reply.ai_generated && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                              style={{
                                background: 'var(--ur-accent-soft)',
                                color: 'var(--ur-accent)',
                              }}
                            >
                              <Sparkles className="w-2.5 h-2.5" /> IA
                            </span>
                          )}
                          <span className="ml-auto text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                            {format(new Date(reply.created_at), "d 'de' MMM", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--ur-text-soft)' }}>
                          {reply.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escreva uma resposta…"
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg text-sm resize-none outline-none transition-all"
                  style={{
                    background: 'var(--ur-bg-soft)',
                    border: '1px solid var(--ur-surface-soft)',
                    color: 'var(--ur-text)',
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid var(--ur-accent-soft-3)'
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid var(--ur-surface-soft)'
                  }}
                />
                <div className="flex justify-end mt-3">
                  <button
                    disabled={!replyText.trim()}
                    onClick={() => toast.success('Resposta publicada')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
                      color: 'var(--ur-text-on-accent)',
                    }}
                  >
                    Publicar resposta
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Audit trail */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl p-5"
              style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ur-text)' }}>
                Histórico de auditoria
              </h3>
              <div className="space-y-3">
                {[
                  ...(createdAtSafe
                    ? [{ event: 'Avaliação criada', time: createdAtSafe, actor: 'Sistema' }]
                    : []),
                  ...(publishedAtSafe
                    ? [{ event: 'Publicada', time: publishedAtSafe, actor: 'Sistema' }]
                    : []),
                ].map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: 'var(--ur-accent)' }}
                    />
                    <span style={{ color: 'var(--ur-text-soft)' }}>{entry.event}</span>
                    <span style={{ color: 'var(--ur-text-muted)' }}>por {entry.actor}</span>
                    <span className="ml-auto tabular-nums" style={{ color: 'var(--ur-text-muted)' }}>
                      {format(entry.time, "d 'de' MMM, HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* AI Analysis card */}
            {review.ai_analysis && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-xl p-5"
                style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--ur-accent)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
                    Análise por IA
                  </h3>
                </div>

                <div className="flex justify-center mb-4">
                  <AiScoreGauge
                    score={review.ai_analysis.quality_score}
                    size={96}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--ur-text-muted)' }}>Sentimento</span>
                    <span
                      className="capitalize font-medium"
                      style={{
                        color:
                          review.ai_analysis.sentiment === 'positive'
                            ? 'var(--ur-success)'
                            : review.ai_analysis.sentiment === 'negative'
                            ? 'var(--ur-danger)'
                            : 'var(--ur-warn)',
                      }}
                    >
                      {review.ai_analysis.sentiment}
                    </span>
                  </div>

                  {review.ai_analysis.is_synthetic && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--ur-text-muted)' }}>Probabilidade de ser sintético</span>
                      <span className="font-medium" style={{ color: 'var(--ur-danger)' }}>
                        {Math.round(review.ai_analysis.synthetic_confidence * 100)}%
                      </span>
                    </div>
                  )}

                  {(review.ai_analysis.moderation_flags?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
                        Sinalizações
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {review.ai_analysis.moderation_flags!.map((f) => (
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
                    </div>
                  )}

                  {(review.ai_analysis.topics?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
                        Tópicos
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {review.ai_analysis.topics!.map((t) => (
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
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Review info */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl p-5"
              style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ur-text)' }}>
                Detalhes
              </h3>

              <div className="space-y-3">
                {[
                  { label: 'ID da avaliação', value: review.id.slice(0, 8) + '…' },
                  { label: 'Origem', value: review.source ?? '—' },
                  {
                    label: 'Criada em',
                    value: createdAtSafe
                      ? format(createdAtSafe, "d 'de' MMM, yyyy HH:mm", { locale: ptBR })
                      : '—',
                  },
                  { label: 'Votos úteis', value: String(review.helpful_count ?? 0) },
                  { label: 'Anexos de mídia', value: String(review.media?.length ?? 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: 'var(--ur-text-muted)' }}>{label}</span>
                    <span className="font-medium" style={{ color: 'var(--ur-text-soft)' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Edit card ───────────────────────────────────────────────────────────────
// Full inline edit of ANY review (including already-published ones): stars,
// title, body, author name, gender, avatar photo, and status. Persists via
// api.reviews.update; the avatar reuses the AI author-photo upload endpoint.

const AVATAR_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#14b8a6']
function avatarColorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function EditReviewCard({
  review,
  onCancel,
  onSaved,
}: {
  review: Review
  onCancel: () => void
  onSaved: () => void
}) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(review.rating ?? 5)
  const [hoverStar, setHoverStar] = useState(0)
  const [title, setTitle] = useState(review.title ?? '')
  const [body, setBody] = useState(review.body ?? '')
  const [name, setName] = useState(review.author_name ?? '')
  const [gender, setGender] = useState<string | null>(review.author_gender ?? null)
  const [avatar, setAvatar] = useState<string | null>(review.author_avatar_url ?? null)
  const [status, setStatus] = useState<ReviewStatus>(review.status)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = useMutation({
    mutationFn: () =>
      api.reviews.update(
        review.id,
        {
          rating,
          title,
          body,
          author_name: name,
          author_gender: gender ?? undefined,
          author_avatar_url: avatar,
          status,
        },
        getToken(),
      ),
    onSuccess: () => {
      toast.success('Avaliação atualizada')
      queryClient.invalidateQueries({ queryKey: ['review', review.id] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      onSaved()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao salvar'),
  })

  async function pickPhoto(file: File | null) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error('Use JPG, PNG ou WEBP.')
      return
    }
    setUploading(true)
    try {
      const r = await api.ai.uploadAuthorPhoto(file, getToken())
      setAvatar(r.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha no upload')
    } finally {
      setUploading(false)
    }
  }

  const initials = (() => {
    const n = (name || 'Cliente').trim().split(/\s+/)
    return (n[0]?.[0] ?? 'C').toUpperCase() + (n[1]?.[0]?.toUpperCase() ?? '')
  })()

  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wider mb-1'
  const inputStyle: React.CSSProperties = {
    background: 'var(--ur-bg)',
    border: '1px solid var(--ur-border)',
    color: 'var(--ur-text)',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-6 space-y-4"
      style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-accent-soft-3)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
          Editar avaliação
        </h3>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ur-accent)' }}>
          Modo edição
        </span>
      </div>

      {/* Identity: avatar + name + gender */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover" style={{ border: '1px solid var(--ur-border-strong)' }} />
            ) : (
              <span
                className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold"
                style={{ background: avatarColorFor(name || 'Cliente'), color: '#fff' }}
                aria-hidden
              >
                {initials}
              </span>
            )}
            {avatar && (
              <button
                type="button"
                onClick={() => setAvatar(null)}
                aria-label="Remover foto"
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: 'var(--ur-danger)', color: '#fff' }}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider cursor-pointer"
            style={{ color: 'var(--ur-accent)' }}
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Foto
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              pickPhoto(e.target.files?.[0] ?? null)
              if (e.target) e.target.value = ''
            }}
          />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <label className={labelCls} style={{ color: 'var(--ur-text-muted)' }}>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--ur-text-muted)' }}>Sexo</label>
            <div className="inline-flex p-0.5 rounded-lg" style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}>
              {([['female', 'Feminino'], ['male', 'Masculino']] as const).map(([g, lbl]) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  aria-pressed={gender === g}
                  className="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors"
                  style={{
                    background: gender === g ? 'var(--ur-accent-soft)' : 'transparent',
                    color: gender === g ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stars */}
      <div>
        <label className={labelCls} style={{ color: 'var(--ur-text-muted)' }}>Estrelas</label>
        <div className="flex items-center gap-1" onMouseLeave={() => setHoverStar(0)}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = n <= (hoverStar || rating)
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverStar(n)}
                aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
                className="p-0.5 cursor-pointer transition-transform hover:scale-110"
              >
                <Star className="w-6 h-6" style={{ color: on ? 'var(--ur-warn)' : 'var(--ur-text-faint)', fill: on ? 'var(--ur-warn)' : 'none' }} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className={labelCls} style={{ color: 'var(--ur-text-muted)' }}>Título (opcional)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
      </div>

      {/* Body */}
      <div>
        <label className={labelCls} style={{ color: 'var(--ur-text-muted)' }}>Texto da avaliação</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y leading-relaxed" style={inputStyle} />
      </div>

      {/* Status */}
      <div>
        <label className={labelCls} style={{ color: 'var(--ur-text-muted)' }}>Status</label>
        <div className="flex gap-2 flex-wrap">
          {(['approved', 'pending', 'rejected', 'hidden'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: status === s ? 'var(--ur-accent-soft)' : 'var(--ur-bg)',
                border: `1px solid ${status === s ? 'var(--ur-accent-soft-3)' : 'var(--ur-border)'}`,
                color: status === s ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
              }}
            >
              {s === 'approved' ? 'Aprovada' : s === 'pending' ? 'Pendente' : s === 'rejected' ? 'Rejeitada' : 'Oculta'}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={save.isPending}
          className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
          style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text-soft)' }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !body.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--ur-accent)', color: 'var(--ur-text-on-accent)' }}
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
      </div>
    </motion.div>
  )
}

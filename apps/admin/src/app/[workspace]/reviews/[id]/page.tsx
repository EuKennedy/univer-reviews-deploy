'use client'

import { useState } from 'react'
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
import type { ReviewStatus } from '@/types'
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
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#d4a850' }} />
      </div>
    )
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: '#5a5a64' }}>Avaliação não encontrada</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Star className="w-5 h-5" />}
        title="Detalhes da avaliação"
        subtitle={`Por ${review.author_name}`}
        breadcrumbs={[
          { label: 'Avaliações', href: `/${workspace}/reviews` },
          { label: review.author_name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/${workspace}/reviews`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: '#0a0a0b',
                border: '1px solid #1e1e21',
                color: '#8b8b96',
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </Link>

            {review.status !== 'approved' && (
              <button
                onClick={() => statusMutation.mutate('approved')}
                disabled={statusMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  color: '#22c55e',
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
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#ef4444',
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
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)',
                color: '#ef4444',
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
            {/* Review card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-6"
              style={{ background: '#111113', border: '1px solid #1e1e21' }}
            >
              {/* Author row */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ background: 'rgba(212,168,80,0.1)', color: '#d4a850' }}
                >
                  {getInitials(review.author_name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold" style={{ color: '#f0f0f2' }}>
                      {review.author_name}
                    </h2>
                    {review.verified_purchase && (
                      <span
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(34,197,94,0.1)',
                          color: '#22c55e',
                          border: '1px solid rgba(34,197,94,0.2)',
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
              <div className="flex flex-wrap gap-4 mb-5 pb-5" style={{ borderBottom: '1px solid #1a1a1d' }}>
                {[
                  { icon: Calendar, label: format(new Date(review.created_at), "d 'de' MMM, yyyy", { locale: ptBR }) },
                  { icon: Globe, label: review.source },
                  ...(review.product_name ? [{ icon: ShoppingBag, label: review.product_name }] : []),
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: '#8b8b96' }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: '#5a5a64' }} />
                    {label}
                  </div>
                ))}
              </div>

              {/* Content */}
              {review.title && (
                <h3 className="text-base font-semibold mb-2" style={{ color: '#f0f0f2' }}>
                  {review.title}
                </h3>
              )}
              <p className="text-sm leading-relaxed" style={{ color: '#c0c0c8' }}>
                {review.body}
              </p>

              {/* Media */}
              {review.media.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium mb-2" style={{ color: '#5a5a64' }}>
                    Mídias ({review.media.length})
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {review.media.map((m) => (
                      <div
                        key={m.id}
                        className="w-20 h-20 rounded-lg overflow-hidden"
                        style={{ background: '#1a1a1d', border: '1px solid #2a2a2d' }}
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

            {/* Reply section */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl overflow-hidden"
              style={{ background: '#111113', border: '1px solid #1e1e21' }}
            >
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid #1a1a1d' }}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" style={{ color: '#d4a850' }} />
                  <h3 className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
                    Resposta
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={replyTone}
                    onChange={(e) => setReplyTone(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-lg outline-none"
                    style={{
                      background: '#0d0d0f',
                      border: '1px solid #1a1a1d',
                      color: '#8b8b96',
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
                      background: 'rgba(212,168,80,0.1)',
                      border: '1px solid rgba(212,168,80,0.2)',
                      color: '#d4a850',
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
                {review.replies.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {review.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-lg px-4 py-3"
                        style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium" style={{ color: '#f0f0f2' }}>
                            {reply.author}
                          </span>
                          {reply.ai_generated && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                              style={{
                                background: 'rgba(212,168,80,0.1)',
                                color: '#d4a850',
                              }}
                            >
                              <Sparkles className="w-2.5 h-2.5" /> IA
                            </span>
                          )}
                          <span className="ml-auto text-xs" style={{ color: '#5a5a64' }}>
                            {format(new Date(reply.created_at), "d 'de' MMM", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: '#8b8b96' }}>
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
                    background: '#0d0d0f',
                    border: '1px solid #1a1a1d',
                    color: '#f0f0f2',
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid rgba(212,168,80,0.3)'
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid #1a1a1d'
                  }}
                />
                <div className="flex justify-end mt-3">
                  <button
                    disabled={!replyText.trim()}
                    onClick={() => toast.success('Resposta publicada')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, #d4a850, #c49040)',
                      color: '#0a0a0b',
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
              style={{ background: '#111113', border: '1px solid #1e1e21' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#f0f0f2' }}>
                Histórico de auditoria
              </h3>
              <div className="space-y-3">
                {[
                  { event: 'Avaliação criada', time: review.created_at, actor: 'Sistema' },
                  ...(review.published_at
                    ? [{ event: 'Publicada', time: review.published_at, actor: 'Sistema' }]
                    : []),
                ].map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: '#d4a850' }}
                    />
                    <span style={{ color: '#8b8b96' }}>{entry.event}</span>
                    <span style={{ color: '#5a5a64' }}>por {entry.actor}</span>
                    <span className="ml-auto tabular-nums" style={{ color: '#5a5a64' }}>
                      {format(new Date(entry.time), "d 'de' MMM, HH:mm", { locale: ptBR })}
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
                style={{ background: '#111113', border: '1px solid #1e1e21' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4" style={{ color: '#d4a850' }} />
                  <h3 className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
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
                    <span style={{ color: '#5a5a64' }}>Sentimento</span>
                    <span
                      className="capitalize font-medium"
                      style={{
                        color:
                          review.ai_analysis.sentiment === 'positive'
                            ? '#22c55e'
                            : review.ai_analysis.sentiment === 'negative'
                            ? '#ef4444'
                            : '#f59e0b',
                      }}
                    >
                      {review.ai_analysis.sentiment}
                    </span>
                  </div>

                  {review.ai_analysis.is_synthetic && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: '#5a5a64' }}>Probabilidade de ser sintético</span>
                      <span className="font-medium" style={{ color: '#ef4444' }}>
                        {Math.round(review.ai_analysis.synthetic_confidence * 100)}%
                      </span>
                    </div>
                  )}

                  {review.ai_analysis.moderation_flags.length > 0 && (
                    <div>
                      <p className="text-xs mb-1.5" style={{ color: '#5a5a64' }}>
                        Sinalizações
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {review.ai_analysis.moderation_flags.map((f) => (
                          <span
                            key={f}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(239,68,68,0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239,68,68,0.15)',
                            }}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {review.ai_analysis.topics.length > 0 && (
                    <div>
                      <p className="text-xs mb-1.5" style={{ color: '#5a5a64' }}>
                        Tópicos
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {review.ai_analysis.topics.map((t) => (
                          <span
                            key={t}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(212,168,80,0.08)',
                              color: '#d4a850',
                              border: '1px solid rgba(212,168,80,0.15)',
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
              style={{ background: '#111113', border: '1px solid #1e1e21' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#f0f0f2' }}>
                Detalhes
              </h3>

              <div className="space-y-3">
                {[
                  { label: 'ID da avaliação', value: review.id.slice(0, 8) + '…' },
                  { label: 'Origem', value: review.source },
                  {
                    label: 'Criada em',
                    value: format(new Date(review.created_at), "d 'de' MMM, yyyy HH:mm", { locale: ptBR }),
                  },
                  { label: 'Votos úteis', value: String(review.helpful_count) },
                  { label: 'Anexos de mídia', value: String(review.media.length) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: '#5a5a64' }}>{label}</span>
                    <span className="font-medium" style={{ color: '#8b8b96' }}>
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

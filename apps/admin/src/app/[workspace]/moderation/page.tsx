'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, CheckCircle2, XCircle, Sparkles, Star,
  Loader2, AlertTriangle, Mail, Calendar,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Review } from '@/types'

/**
 * Moderation queue — dedicated workflow for pending reviews. Optimised
 * for speed: keyboard shortcuts (A = approve, R = reject, J = next),
 * one-card-at-a-time focus, AI analysis surfaced inline so the operator
 * can decide in <5s per item.
 *
 * Different from the generic reviews list — that one is a table-style
 * browser, this is a moderator's daily driver.
 */
export default function ModerationQueuePage() {
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['moderation-queue'],
    queryFn: () =>
      api.reviews.list(
        { status: 'pending', per_page: 50 },
        getToken(),
      ),
    enabled: isAuthenticated,
    refetchInterval: 30_000, // pull new pending every 30s
  })

  const queue = data?.data ?? []
  const current = queue[index]
  const queueSize = queue.length

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      api.reviews.updateStatus(id, status, getToken()),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === 'approved' ? 'Aprovada' : 'Rejeitada')
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      // Advance pointer; the refetch will replace queue.
      setIndex((i) => Math.min(i + 1, Math.max(queueSize - 1, 0)))
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao atualizar status'),
  })

  const moderatePendingMut = useMutation({
    mutationFn: () => api.ai.moderatePending(getToken()),
    onSuccess: (r) => {
      toast.success(`IA moderando ${r.queued} avaliações.`)
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao enfileirar moderação'),
  })

  const next = useCallback(() => {
    if (queueSize === 0) return
    setIndex((i) => (i + 1) % queueSize)
  }, [queueSize])

  const prev = useCallback(() => {
    if (queueSize === 0) return
    setIndex((i) => (i - 1 + queueSize) % queueSize)
  }, [queueSize])

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when user is typing in a form.
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      if (!current) return
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        statusMutation.mutate({ id: current.id, status: 'approved' })
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        statusMutation.mutate({ id: current.id, status: 'rejected' })
      } else if (e.key === 'j' || e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'k' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, statusMutation, next, prev])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<ShieldCheck className="w-5 h-5" />}
        title="Moderação"
        subtitle={`${queueSize} avaliações pendentes`}
        actions={
          queueSize > 0 ? (
            <button
              type="button"
              onClick={() => moderatePendingMut.mutate()}
              disabled={moderatePendingMut.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--ur-accent-soft)',
                color: 'var(--ur-accent)',
                border: '1px solid var(--ur-accent-soft-3)',
              }}
            >
              {moderatePendingMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Moderar com IA
            </button>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="rounded-xl p-12 flex items-center justify-center"
              style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}>
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--ur-text-muted)' }} />
            </div>
          ) : queueSize === 0 ? (
            <div
              className="rounded-xl p-12 text-center"
              style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
            >
              <div
                className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: 'var(--ur-success-bg)', color: 'var(--ur-success)' }}
              >
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
                Sem pendências
              </h2>
              <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>
                Toda avaliação foi revisada. A fila se atualiza a cada 30s.
              </p>
            </div>
          ) : (
            <>
              {/* Progress + counter */}
              <div className="flex items-center justify-between mb-3 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                <span>
                  {index + 1} de {queueSize}
                </span>
                <span className="hidden md:inline-flex items-center gap-3">
                  <Kbd>A</Kbd> aprovar · <Kbd>R</Kbd> rejeitar · <Kbd>J</Kbd> próxima
                </span>
              </div>
              <div
                className="h-1 rounded-full mb-5 overflow-hidden"
                style={{ background: 'var(--ur-bg-soft)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${((index + 1) / queueSize) * 100}%`,
                    background: 'linear-gradient(90deg, var(--ur-accent), var(--ur-accent-strong))',
                  }}
                />
              </div>

              {current && <ReviewCard review={current} />}

              {/* Action bar */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => current && statusMutation.mutate({ id: current.id, status: 'rejected' })}
                  disabled={statusMutation.isPending || !current}
                  className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: 'var(--ur-danger-bg)',
                    color: 'var(--ur-danger)',
                    border: '1px solid var(--ur-danger)',
                  }}
                >
                  <XCircle className="w-4 h-4" />
                  Rejeitar <Kbd>R</Kbd>
                </button>
                <button
                  type="button"
                  onClick={() => current && statusMutation.mutate({ id: current.id, status: 'approved' })}
                  disabled={statusMutation.isPending || !current}
                  className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, var(--ur-success), #16a34a)',
                    color: 'white',
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Aprovar <Kbd dark>A</Kbd>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const stars = Array.from({ length: 5 }, (_, i) => i < (review.rating ?? 0))
  const dt = review.created_at ? new Date(review.created_at) : null

  return (
    <article
      className="rounded-xl p-6"
      style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0"
          style={{ background: 'var(--ur-accent-soft)', color: 'var(--ur-accent)' }}
        >
          {(review.author_name || '?')[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold truncate" style={{ color: 'var(--ur-text)' }}>
            {review.author_name || 'Cliente anônimo'}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            {review.author_email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {review.author_email}
              </span>
            )}
            {dt && !Number.isNaN(dt.getTime()) && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(dt, "d 'de' MMM, HH:mm", { locale: ptBR })}
              </span>
            )}
            {review.verified_purchase && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: 'var(--ur-success-bg)', color: 'var(--ur-success)' }}
              >
                VERIFICADA
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {stars.map((filled, i) => (
            <Star
              key={i}
              className="w-4 h-4"
              fill={filled ? 'var(--ur-accent)' : 'none'}
              stroke={filled ? 'var(--ur-accent)' : 'var(--ur-text-muted)'}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="mb-4">
        {review.title && (
          <h4 className="text-base font-semibold mb-2" style={{ color: 'var(--ur-text)' }}>
            {review.title}
          </h4>
        )}
        {review.body ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ur-text-soft)' }}>
            {review.body}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: 'var(--ur-text-muted)' }}>
            Cliente avaliou só com a nota — sem comentário escrito.
          </p>
        )}
      </div>

      {/* AI Analysis */}
      {review.ai_analysis && (
        <div
          className="rounded-lg p-3 flex items-start gap-2 text-xs"
          style={{
            background: 'var(--ur-bg-soft)',
            border: '1px solid var(--ur-surface-soft)',
          }}
        >
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ur-accent)' }} />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              {review.ai_analysis.quality_score != null && (
                <span style={{ color: 'var(--ur-text-soft)' }}>
                  Qualidade:{' '}
                  <strong
                    style={{
                      color:
                        review.ai_analysis.quality_score >= 70
                          ? 'var(--ur-success)'
                          : review.ai_analysis.quality_score >= 40
                          ? 'var(--ur-warn)'
                          : 'var(--ur-danger)',
                    }}
                  >
                    {review.ai_analysis.quality_score}/100
                  </strong>
                </span>
              )}
              {review.ai_analysis.sentiment && (
                <span style={{ color: 'var(--ur-text-soft)' }}>
                  Sentimento: <strong className="capitalize">{review.ai_analysis.sentiment}</strong>
                </span>
              )}
              {review.ai_analysis.is_synthetic && (
                <span
                  className="px-1.5 py-0.5 rounded inline-flex items-center gap-1 font-semibold"
                  style={{ background: 'var(--ur-danger-bg)', color: 'var(--ur-danger)' }}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Sintético {Math.round((review.ai_analysis.synthetic_confidence ?? 0) * 100)}%
                </span>
              )}
            </div>
            {review.ai_analysis.reason && (
              <p className="italic" style={{ color: 'var(--ur-text-muted)' }}>
                {review.ai_analysis.reason}
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function Kbd({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-[10px] font-mono font-semibold"
      style={{
        background: dark ? 'rgba(255,255,255,0.2)' : 'var(--ur-bg-soft)',
        color: dark ? 'white' : 'var(--ur-text)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.3)' : 'var(--ur-border)'}`,
      }}
    >
      {children}
    </kbd>
  )
}

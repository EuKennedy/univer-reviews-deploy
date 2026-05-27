'use client'

/**
 * Side drawer that previews a single review without leaving the page.
 *
 * Originally lived inline at the bottom of /[workspace]/reviews/page.tsx.
 * Extracted so the dashboard's recent-reviews list can reuse the same
 * UX instead of navigating to /reviews/[id] (which crashes when fields
 * are null — see the safer field accesses below).
 *
 * Renders to a portal-like fixed overlay so it sits above the page
 * regardless of which surface mounted it. Status mutation lives inside
 * the drawer; it invalidates the `reviews` query key family so callers
 * don't have to wire that up themselves.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, ChevronRight, CheckCircle2, XCircle, MessageSquare, Sparkles,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'
import { StatusBadge } from '@/components/reviews/StatusBadge'
import { RatingStars } from '@/components/reviews/RatingStars'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/lib/utils'
import type { Review, ReviewStatus } from '@/types'

interface ReviewDrawerProps {
  review: Review | null
  workspace: string
  onClose: () => void
}

export function ReviewDrawer({ review, workspace, onClose }: ReviewDrawerProps) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
      api.reviews.updateStatus(id, status, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['reviews-recent'] })
      queryClient.invalidateQueries({ queryKey: ['workspace-stats'] })
      toast.success('Status atualizado')
    },
    onError: () => toast.error('Falha ao atualizar status'),
  })

  // Null-safe accessors — the dashboard's API list returns trimmed fields
  // that can legitimately be missing. We default them here rather than
  // crashing the whole drawer.
  const authorName = review?.author_name?.trim() || 'Cliente anônimo'
  const authorEmail = review?.author_email ?? null
  const createdAtRaw = review?.created_at
  let createdAtLabel: string | null = null
  if (createdAtRaw) {
    const d = new Date(createdAtRaw)
    if (!Number.isNaN(d.getTime())) {
      createdAtLabel = format(d, "d 'de' MMM, yyyy", { locale: ptBR })
    }
  }

  return (
    <AnimatePresence>
      {review && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ur-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'var(--ur-overlay)' }}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            key="ur-drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 flex flex-col overflow-hidden"
            style={{
              background: 'var(--ur-surface)',
              borderLeft: '1px solid var(--ur-border)',
              boxShadow: '-24px 0 80px var(--ur-overlay)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes da avaliação de ${authorName}`}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--ur-border)' }}
            >
              <div className="flex items-center gap-2">
                <RatingStars rating={review.rating ?? 0} size="sm" showValue />
                <StatusBadge status={review.status} size="sm" />
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/${workspace}/reviews/${review.id}`}
                  className="ur-caption flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
                  style={{ border: '1px solid var(--ur-border)' }}
                >
                  Página completa <ChevronRight className="w-3 h-3" />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar painel de detalhes"
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: 'var(--ur-text-muted)' }}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'var(--ur-accent-soft)', color: 'var(--ur-accent)' }}
                >
                  {getInitials(authorName)}
                </div>
                <div>
                  <p className="ur-h3">{authorName}</p>
                  <p className="ur-meta">
                    {authorEmail ?? '—'}
                    {createdAtLabel ? ` • ${createdAtLabel}` : ''}
                  </p>
                </div>
              </div>

              {/* Product */}
              {review.product_name && (
                <div
                  className="px-3 py-2 rounded-lg ur-caption"
                  style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border-soft)' }}
                >
                  <span style={{ color: 'var(--ur-text-soft)' }}>Produto: </span>
                  <span style={{ color: 'var(--ur-text)' }}>{review.product_name}</span>
                </div>
              )}

              {/* Body */}
              <div>
                {review.title && (
                  <h3 className="ur-h3 mb-2">{review.title}</h3>
                )}
                {review.body ? (
                  <p className="ur-body-soft">{review.body}</p>
                ) : (
                  <p className="ur-body-soft italic" style={{ color: 'var(--ur-text-muted)' }}>
                    Sem texto — cliente avaliou só com nota.
                  </p>
                )}
              </div>

              {/* AI Analysis */}
              {review.ai_analysis && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-surface-soft)' }}
                >
                  <p className="ur-overline mb-3">Análise por IA</p>
                  <div className="flex items-center gap-4 mb-3 flex-wrap">
                    <div>
                      <p className="ur-caption">Qualidade</p>
                      <p
                        className="text-lg font-bold tracking-tight"
                        style={{
                          color:
                            (review.ai_analysis.quality_score ?? 0) >= 70
                              ? 'var(--ur-success)'
                              : (review.ai_analysis.quality_score ?? 0) >= 40
                              ? 'var(--ur-warn)'
                              : 'var(--ur-danger)',
                        }}
                      >
                        {review.ai_analysis.quality_score ?? '—'}
                        <span className="ur-meta ml-0.5">/100</span>
                      </p>
                    </div>
                    {review.ai_analysis.sentiment && (
                      <div>
                        <p className="ur-caption">Sentimento</p>
                        <p className="ur-label capitalize">
                          {review.ai_analysis.sentiment}
                        </p>
                      </div>
                    )}
                    {review.ai_analysis.is_synthetic && (
                      <div>
                        <p className="ur-caption">Sintético</p>
                        <p className="ur-label" style={{ color: 'var(--ur-danger)' }}>
                          {Math.round((review.ai_analysis.synthetic_confidence ?? 0) * 100)}%
                        </p>
                      </div>
                    )}
                  </div>
                  {(review.ai_analysis.topics?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {review.ai_analysis.topics!.map((t) => (
                        <span
                          key={t}
                          className="ur-caption px-2 py-0.5 rounded-full"
                          style={{
                            background: 'var(--ur-accent-glow)',
                            border: '1px solid var(--ur-accent-soft-2)',
                            color: 'var(--ur-accent)',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Replies */}
              {(review.replies?.length ?? 0) > 0 && (
                <div>
                  <p className="ur-overline mb-2">Respostas</p>
                  <div className="space-y-2">
                    {review.replies!.map((reply) => (
                      <div
                        key={reply.id}
                        className="px-3 py-2 rounded-lg"
                        style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border-soft)' }}
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="ur-label">{reply.author}</span>
                          {reply.ai_generated && (
                            <span
                              className="px-1.5 py-0.5 rounded ur-caption inline-flex items-center gap-0.5"
                              style={{
                                background: 'var(--ur-accent-glow)',
                                color: 'var(--ur-accent)',
                              }}
                            >
                              <Sparkles className="w-2.5 h-2.5" /> IA
                            </span>
                          )}
                        </div>
                        <p className="ur-body-soft">{reply.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div
              className="flex items-center gap-2 px-5 py-4 shrink-0"
              style={{ borderTop: '1px solid var(--ur-border)' }}
            >
              {review.status !== 'approved' && (
                <button
                  type="button"
                  onClick={() => {
                    statusMutation.mutate({ id: review.id, status: 'approved' })
                    onClose()
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: 'var(--ur-success-bg)',
                    border: '1px solid var(--ur-success-bg)',
                    color: 'var(--ur-success)',
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Aprovar
                </button>
              )}
              {review.status !== 'rejected' && (
                <button
                  type="button"
                  onClick={() => {
                    statusMutation.mutate({ id: review.id, status: 'rejected' })
                    onClose()
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: 'var(--ur-danger-bg)',
                    border: '1px solid var(--ur-danger-bg)',
                    color: 'var(--ur-danger)',
                  }}
                >
                  <XCircle className="w-4 h-4" />
                  Rejeitar
                </button>
              )}
              <Link
                href={`/${workspace}/reviews/${review.id}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'var(--ur-accent-glow)',
                  border: '1px solid var(--ur-accent-soft-2)',
                  color: 'var(--ur-accent)',
                }}
              >
                <MessageSquare className="w-4 h-4" />
                Responder
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

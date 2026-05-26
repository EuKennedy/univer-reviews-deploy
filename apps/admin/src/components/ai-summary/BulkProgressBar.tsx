/**
 * BulkProgressBar — sticky top bar surfacing live progress of the
 * "Gerar para todos" bulk job. Driven by the same 15s product-list
 * polling: the bar counts products that flipped from "pending" to
 * "generated" since the bulk was kicked off.
 *
 * Closes automatically when done = total (with a 1.5s celebration window)
 * or when the merchant dismisses it.
 */

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, Check } from 'lucide-react'

interface BulkProgressBarProps {
  active: boolean
  total: number
  done: number
  onDismiss: () => void
}

export function BulkProgressBar({ active, total, done, onDismiss }: BulkProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const finished = active && total > 0 && done >= total
  const finishedAt = useRef<number | null>(null)

  // Auto-dismiss 2s after we hit 100%.
  useEffect(() => {
    if (finished && finishedAt.current == null) {
      finishedAt.current = Date.now()
      const t = setTimeout(() => onDismiss(), 2200)
      return () => clearTimeout(t)
    }
    if (!finished) finishedAt.current = null
  }, [finished, onDismiss])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="sticky top-0 z-40 mx-auto"
          style={{
            background: 'linear-gradient(135deg, var(--ur-accent-glow), transparent 40%, var(--ur-accent-glow))',
            borderBottom: '1px solid var(--ur-accent-soft-2)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="px-5 py-3 flex items-center gap-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: finished
                  ? 'linear-gradient(135deg, var(--ur-success), #15803d)'
                  : 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
                color: '#fff',
              }}
            >
              {finished ? (
                <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
                  <Check className="w-4 h-4" />
                </motion.div>
              ) : (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles className="w-4 h-4" />
                </motion.div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 mb-1.5">
                <p className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
                  {finished
                    ? 'Sumários gerados'
                    : 'Extraindo tópicos com IA…'}
                </p>
                <p className="text-xs tabular-nums" style={{ color: 'var(--ur-text-muted)' }}>
                  <span className="font-medium" style={{ color: 'var(--ur-accent)' }}>{done}</span>
                  {' de '}
                  <span>{total}</span>
                  {' produtos · '}
                  {pct}%
                </p>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden relative"
                style={{ background: 'var(--ur-accent-soft)' }}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: finished
                      ? 'linear-gradient(90deg, var(--ur-success), #15803d)'
                      : 'linear-gradient(90deg, var(--ur-accent), var(--ur-accent-strong))',
                    boxShadow: '0 0 12px var(--ur-accent-ring)',
                  }}
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
                {!finished && (
                  <motion.div
                    className="absolute inset-y-0 w-12 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                    }}
                    animate={{ x: ['-12px', `${pct + 12}%`] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dispensar"
              className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors"
              style={{ color: 'var(--ur-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ur-surface-soft)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

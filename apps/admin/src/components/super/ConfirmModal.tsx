'use client'

/**
 * ConfirmModal — text-to-confirm modal for destructive super admin actions.
 *
 * Mirrors the modal shell from apps/admin/src/app/[workspace]/ai-summaries/
 * [productId]/page.tsx (focus trap, scale-in motion, backdrop blur) but
 * gates the primary action behind matching a free-text token (typically
 * the workspace slug). The button stays disabled until the typed value
 * matches verbatim — case-sensitive on purpose.
 */

import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import { useFocusTrap } from '@/lib/useFocusTrap'

interface ConfirmModalProps {
  title: string
  subtitle?: string
  /** Token the user must type verbatim to enable the confirm button. */
  confirmToken: string
  /** Label for the destructive primary button (e.g. "Suspender"). */
  confirmLabel: string
  /** Visual variant — "danger" = red action, "neutral" = accent. */
  variant?: 'danger' | 'neutral'
  /** Optional extra context shown above the input. Plain string. */
  description?: React.ReactNode
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  title,
  subtitle,
  confirmToken,
  confirmLabel,
  variant = 'danger',
  description,
  loading,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const titleId = useId()
  const inputId = useId()
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)
  const [value, setValue] = useState('')
  const matches = value === confirmToken

  const dangerStyles: React.CSSProperties = {
    background: 'var(--ur-danger)',
    color: '#fff',
    border: 'none',
  }
  const neutralStyles: React.CSSProperties = {
    background:
      'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
    color: 'var(--ur-text-on-accent)',
    border: 'none',
  }

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
            maxWidth: 480,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-5">
            <div className="flex gap-3">
              {variant === 'danger' && (
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: 'var(--ur-danger-bg)',
                    border: '1px solid var(--ur-danger)',
                  }}
                >
                  <AlertTriangle
                    className="w-4 h-4"
                    style={{ color: 'var(--ur-danger)' }}
                    aria-hidden="true"
                  />
                </div>
              )}
              <div>
                <h3
                  id={titleId}
                  className="text-lg font-semibold tracking-tight"
                  style={{ color: 'var(--ur-text)' }}
                >
                  {title}
                </h3>
                {subtitle && (
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--ur-text-muted)' }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              style={{ color: 'var(--ur-text-soft)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--ur-surface-soft)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {description && (
            <div
              className="text-sm mb-4 leading-relaxed"
              style={{ color: 'var(--ur-text-soft)' }}
            >
              {description}
            </div>
          )}

          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            Para confirmar, digite{' '}
            <code
              className="font-mono px-1 py-0.5 rounded"
              style={{
                background: 'var(--ur-surface-soft)',
                color: 'var(--ur-text)',
              }}
            >
              {confirmToken}
            </code>
          </label>
          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="w-full px-3 py-2.5 text-sm font-mono rounded-lg outline-none transition-all"
            style={{
              background: 'var(--ur-bg)',
              border: `1px solid ${matches ? 'var(--ur-accent-ring)' : 'var(--ur-border)'}`,
              color: 'var(--ur-text)',
            }}
          />

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text-soft)',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!matches || loading}
              className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={variant === 'danger' ? dangerStyles : neutralStyles}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

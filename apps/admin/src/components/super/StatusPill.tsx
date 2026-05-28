'use client'

/**
 * StatusPill — workspace status indicator for the super admin surface.
 *
 * Distinct from the existing ai-summary/StatusPill which is locked to
 * generation states. We include `suspended` (danger semantic) and
 * `deleted` (gray) that don't apply to the AI panel.
 */

import { motion } from 'framer-motion'
import type { SuperAdminStatus } from '@/types'

type StatusKey = SuperAdminStatus | 'deleted'

interface StatusPillProps {
  status: StatusKey
  size?: 'sm' | 'md'
}

const META: Record<StatusKey, { dot: string; ring: string; bg: string; text: string; label: string; pulse?: boolean }> = {
  active:    { dot: '#16a34a', ring: 'rgba(22, 163, 74, 0.35)',  bg: 'rgba(22, 163, 74, 0.1)',   text: '#15803d', label: 'Ativo' },
  trial:     { dot: '#d4a850', ring: 'rgba(212, 168, 80, 0.35)', bg: 'rgba(212, 168, 80, 0.1)',  text: '#a07830', label: 'Trial', pulse: true },
  suspended: { dot: '#dc2626', ring: 'rgba(220, 38, 38, 0.35)',  bg: 'rgba(220, 38, 38, 0.1)',   text: '#b91c1c', label: 'Suspenso' },
  // Distinct from `suspended` — voluntary churn, no abuse implied. Slate
  // tone keeps it visually neutral so the founder can scan an inactive
  // tenant without it screaming danger.
  cancelled: { dot: '#64748b', ring: 'rgba(100, 116, 139, 0.35)', bg: 'rgba(100, 116, 139, 0.1)', text: '#475569', label: 'Cancelado' },
  deleted:   { dot: '#9ca3af', ring: 'rgba(156, 163, 175, 0.3)', bg: 'rgba(156, 163, 175, 0.1)', text: '#6b7280', label: 'Excluído' },
}

export function StatusPill({ status, size = 'sm' }: StatusPillProps) {
  const meta = META[status]
  const dotSize = size === 'sm' ? 6 : 8
  const padding = size === 'sm' ? '4px 10px 4px 8px' : '6px 12px 6px 10px'
  const fontSize = size === 'sm' ? 11 : 12

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider whitespace-nowrap"
      style={{
        background: meta.bg,
        color: meta.text,
        padding,
        fontSize,
        letterSpacing: '0.06em',
        border: `1px solid ${meta.ring}`,
      }}
    >
      <span className="relative inline-flex items-center justify-center" style={{ width: dotSize, height: dotSize }}>
        {meta.pulse && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: meta.dot }}
            animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span
          className="relative rounded-full"
          style={{ width: dotSize, height: dotSize, background: meta.dot, boxShadow: `0 0 0 2px ${meta.bg}` }}
        />
      </span>
      {meta.label}
    </span>
  )
}

/**
 * StatusPill — semantic state indicator with dot + label.
 *
 * Designed for the AI Summary surface but lives standalone so it can be
 * dropped anywhere. Always-on subtle dot, ambient pulse for `processing`
 * state to communicate "work is happening".
 */

import { motion } from 'framer-motion'

type StatusKey = 'generated' | 'pending' | 'processing' | 'insufficient' | 'fresh'

interface StatusPillProps {
  status: StatusKey
  label?: string
  size?: 'sm' | 'md'
}

const META: Record<StatusKey, { dot: string; ring: string; bg: string; text: string; defaultLabel: string }> = {
  generated:    { dot: '#16a34a', ring: 'rgba(22, 163, 74, 0.35)',  bg: 'rgba(22, 163, 74, 0.1)',   text: '#15803d', defaultLabel: 'Gerado' },
  fresh:        { dot: '#22d3ee', ring: 'rgba(34, 211, 238, 0.35)', bg: 'rgba(34, 211, 238, 0.1)',  text: '#0e7490', defaultLabel: 'Atualizado' },
  pending:      { dot: '#d4a850', ring: 'rgba(212, 168, 80, 0.35)', bg: 'rgba(212, 168, 80, 0.1)',  text: '#a07830', defaultLabel: 'Pendente' },
  processing:   { dot: '#a855f7', ring: 'rgba(168, 85, 247, 0.35)', bg: 'rgba(168, 85, 247, 0.12)', text: '#7e22ce', defaultLabel: 'Processando' },
  insufficient: { dot: '#9ca3af', ring: 'rgba(156, 163, 175, 0.3)', bg: 'rgba(156, 163, 175, 0.1)', text: '#6b7280', defaultLabel: 'Sem dados' },
}

export function StatusPill({ status, label, size = 'sm' }: StatusPillProps) {
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
        {status === 'processing' && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: meta.dot }}
            animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span
          className="relative rounded-full"
          style={{ width: dotSize, height: dotSize, background: meta.dot, boxShadow: `0 0 0 2px ${meta.bg}` }}
        />
      </span>
      {label ?? meta.defaultLabel}
    </span>
  )
}

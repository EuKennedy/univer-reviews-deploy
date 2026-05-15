import type { ReviewStatus } from '@/types'

const config: Record<
  ReviewStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  pending: {
    label: 'Pendente',
    bg: 'rgba(245,158,11,0.1)',
    color: '#f59e0b',
    dot: '#f59e0b',
  },
  approved: {
    label: 'Aprovado',
    bg: 'rgba(34,197,94,0.1)',
    color: '#22c55e',
    dot: '#22c55e',
  },
  rejected: {
    label: 'Rejeitado',
    bg: 'rgba(239,68,68,0.1)',
    color: '#ef4444',
    dot: '#ef4444',
  },
  hidden: {
    label: 'Oculto',
    bg: 'rgba(107,114,128,0.1)',
    color: '#9ca3af',
    dot: '#6b7280',
  },
  spam: {
    label: 'Spam',
    bg: 'rgba(220,38,38,0.08)',
    color: '#dc2626',
    dot: '#dc2626',
  },
}

interface StatusBadgeProps {
  status: ReviewStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const c = config[status] ?? config.pending

  return (
    <span
      className="inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap"
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.color}25`,
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        fontSize: size === 'sm' ? 11 : 12,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: c.dot }}
      />
      {c.label}
    </span>
  )
}

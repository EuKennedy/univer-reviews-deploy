import type { ReviewStatus } from '@/types'

const config: Record<
  ReviewStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  draft: {
    label: 'Rascunho',
    bg: 'var(--ur-surface-soft)',
    color: 'var(--ur-text-muted)',
    dot: 'var(--ur-text-muted)',
  },
  pending: {
    label: 'Pendente',
    bg: 'var(--ur-warn-bg)',
    color: 'var(--ur-warn)',
    dot: 'var(--ur-warn)',
  },
  approved: {
    label: 'Aprovado',
    bg: 'var(--ur-success-bg)',
    color: 'var(--ur-success)',
    dot: 'var(--ur-success)',
  },
  rejected: {
    label: 'Rejeitado',
    bg: 'var(--ur-danger-bg)',
    color: 'var(--ur-danger)',
    dot: 'var(--ur-danger)',
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

import { CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export interface IntegrationCardProps {
  name: string
  description: string
  status: 'connected' | 'not_connected' | 'coming_soon'
  logo: React.ReactNode
  href?: string
  stats?: { label: string; value: string }[]
}

const statusConfig = {
  connected: {
    label: 'Conectado',
    bg: 'var(--ur-success-bg)',
    color: 'var(--ur-success)',
    border: 'var(--ur-success-bg)',
    icon: CheckCircle2,
  },
  not_connected: {
    label: 'Não conectado',
    bg: 'rgba(107,114,128,0.1)',
    color: '#6b7280',
    border: 'rgba(107,114,128,0.15)',
    icon: null,
  },
  coming_soon: {
    label: 'Em breve',
    bg: 'var(--ur-accent-glow)',
    color: 'var(--ur-accent)',
    border: 'var(--ur-accent-soft-2)',
    icon: Clock,
  },
}

export function IntegrationCard({
  name,
  description,
  status,
  logo,
  href,
  stats,
}: IntegrationCardProps) {
  const sc = statusConfig[status]
  const Icon = sc.icon

  const content = (
    <div
      className="rounded-xl p-5 transition-all duration-150 group relative overflow-hidden"
      style={{
        background: 'var(--ur-surface)',
        border: '1px solid var(--ur-border)',
        opacity: status === 'coming_soon' ? 0.7 : 1,
      }}
    >
      {/* Hover glow */}
      {status !== 'coming_soon' && (
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, var(--ur-accent-glow) 0%, transparent 70%)',
          }}
        />
      )}

      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--ur-surface-soft)', border: '1px solid var(--ur-border-strong)' }}
          aria-hidden="true"
        >
          {logo}
        </div>

        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{
            background: sc.bg,
            color: sc.color,
            border: `1px solid ${sc.border}`,
          }}
        >
          {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
          {sc.label}
        </span>
      </div>

      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: 'var(--ur-text)' }}
      >
        {name}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--ur-text-soft)' }}>
        {description}
      </p>

      {stats && stats.length > 0 && (
        <div
          className="flex gap-4 mt-4 pt-4"
          style={{ borderTop: '1px solid var(--ur-surface-soft)' }}
        >
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                {s.label}
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {status !== 'coming_soon' && (
        <div className="mt-4 flex items-center justify-between">
          <span
            className="text-xs font-medium transition-colors group-hover:text-[var(--ur-accent)]"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            {status === 'connected' ? 'Configurar' : 'Conectar'}
          </span>
          <ArrowRight
            aria-hidden="true"
            className="w-3.5 h-3.5 transition-all group-hover:translate-x-0.5 group-hover:text-[var(--ur-accent)]"
            style={{ color: 'var(--ur-text-faint)' }}
          />
        </div>
      )}
    </div>
  )

  if (href && status !== 'coming_soon') {
    const ariaLabel =
      status === 'connected'
        ? `Configurar integração ${name}`
        : `Conectar integração ${name}`
    return (
      <Link href={href} aria-label={ariaLabel}>
        {content}
      </Link>
    )
  }

  return content
}

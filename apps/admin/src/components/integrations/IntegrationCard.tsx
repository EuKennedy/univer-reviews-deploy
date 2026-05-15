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
    label: 'Connected',
    bg: 'rgba(34,197,94,0.1)',
    color: '#22c55e',
    border: 'rgba(34,197,94,0.2)',
    icon: CheckCircle2,
  },
  not_connected: {
    label: 'Not connected',
    bg: 'rgba(107,114,128,0.1)',
    color: '#6b7280',
    border: 'rgba(107,114,128,0.15)',
    icon: null,
  },
  coming_soon: {
    label: 'Coming soon',
    bg: 'rgba(212,168,80,0.08)',
    color: '#d4a850',
    border: 'rgba(212,168,80,0.15)',
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
        background: '#111113',
        border: '1px solid #1e1e21',
        opacity: status === 'coming_soon' ? 0.7 : 1,
      }}
    >
      {/* Hover glow */}
      {status !== 'coming_soon' && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,80,0.04) 0%, transparent 70%)',
          }}
        />
      )}

      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: '#1a1a1d', border: '1px solid #2a2a2d' }}
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
          {Icon && <Icon className="w-3 h-3" />}
          {sc.label}
        </span>
      </div>

      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: '#f0f0f2' }}
      >
        {name}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: '#8b8b96' }}>
        {description}
      </p>

      {stats && stats.length > 0 && (
        <div
          className="flex gap-4 mt-4 pt-4"
          style={{ borderTop: '1px solid #1a1a1d' }}
        >
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-xs" style={{ color: '#5a5a64' }}>
                {s.label}
              </p>
              <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {status !== 'coming_soon' && (
        <div className="mt-4 flex items-center justify-between">
          <span
            className="text-xs font-medium transition-colors group-hover:text-[#d4a850]"
            style={{ color: '#5a5a64' }}
          >
            {status === 'connected' ? 'Configure' : 'Connect'}
          </span>
          <ArrowRight
            className="w-3.5 h-3.5 transition-all group-hover:translate-x-0.5 group-hover:text-[#d4a850]"
            style={{ color: '#3a3a3e' }}
          />
        </div>
      )}
    </div>
  )

  if (href && status !== 'coming_soon') {
    return <Link href={href}>{content}</Link>
  }

  return content
}

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StatItem {
  label: string
  value: string | number
  delta?: number
  icon?: React.ReactNode
  suffix?: string
}

interface StatsBarProps {
  stats: StatItem[]
  isLoading?: boolean
  className?: string
}

function StatCard({ stat, isLoading }: { stat: StatItem; isLoading?: boolean }) {
  const deltaPositive = stat.delta !== undefined && stat.delta > 0
  const deltaNegative = stat.delta !== undefined && stat.delta < 0
  const deltaZero = stat.delta !== undefined && stat.delta === 0

  return (
    <div
      className="flex-1 min-w-0 px-5 py-4 relative overflow-hidden transition-all duration-150 group"
      style={{
        background: 'var(--ur-surface)',
        border: '1px solid var(--ur-border)',
        borderRadius: 12,
        boxShadow: 'var(--ur-shadow-sm)',
      }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, var(--ur-accent-glow) 0%, transparent 70%)',
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="ur-overline">{stat.label}</span>
          {stat.icon && (
            <span style={{ color: 'var(--ur-text-muted)' }}>{stat.icon}</span>
          )}
        </div>

        {isLoading ? (
          <>
            <div className="skeleton h-8 w-24 mb-2" />
            <div className="skeleton h-4 w-16" />
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="ur-display tabular-nums">{stat.value}</span>
              {stat.suffix && (
                <span className="ur-caption">{stat.suffix}</span>
              )}
            </div>

            {stat.delta !== undefined && (
              <div className="flex items-center gap-1 mt-1.5">
                {deltaPositive && (
                  <TrendingUp className="w-3 h-3" style={{ color: 'var(--ur-success)' }} />
                )}
                {deltaNegative && (
                  <TrendingDown className="w-3 h-3" style={{ color: 'var(--ur-danger)' }} />
                )}
                {deltaZero && (
                  <Minus className="w-3 h-3" style={{ color: 'var(--ur-text-muted)' }} />
                )}
                <span
                  className="ur-caption"
                  style={{
                    color: deltaPositive
                      ? 'var(--ur-success)'
                      : deltaNegative
                      ? 'var(--ur-danger)'
                      : 'var(--ur-text-soft)',
                  }}
                >
                  {stat.delta > 0 ? '+' : ''}
                  {stat.delta.toFixed(1)}% vs. mês anterior
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function StatsBar({ stats, isLoading, className }: StatsBarProps) {
  return (
    <div className={cn('flex gap-3 p-4', className)}>
      {stats.map((stat, i) => (
        <StatCard key={i} stat={stat} isLoading={isLoading} />
      ))}
    </div>
  )
}

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
        background: '#111113',
        border: '1px solid #1e1e21',
        borderRadius: 12,
      }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,80,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#5a5a64' }}>
            {stat.label}
          </span>
          {stat.icon && (
            <span style={{ color: '#3a3a3e' }}>{stat.icon}</span>
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
              <span
                className="text-2xl font-bold tracking-tight"
                style={{ color: '#f0f0f2' }}
              >
                {stat.value}
              </span>
              {stat.suffix && (
                <span className="text-sm" style={{ color: '#8b8b96' }}>
                  {stat.suffix}
                </span>
              )}
            </div>

            {stat.delta !== undefined && (
              <div className="flex items-center gap-1 mt-1.5">
                {deltaPositive && (
                  <TrendingUp className="w-3 h-3" style={{ color: '#22c55e' }} />
                )}
                {deltaNegative && (
                  <TrendingDown className="w-3 h-3" style={{ color: '#ef4444' }} />
                )}
                {deltaZero && (
                  <Minus className="w-3 h-3" style={{ color: '#5a5a64' }} />
                )}
                <span
                  className="text-xs font-medium"
                  style={{
                    color: deltaPositive
                      ? '#22c55e'
                      : deltaNegative
                      ? '#ef4444'
                      : '#5a5a64',
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

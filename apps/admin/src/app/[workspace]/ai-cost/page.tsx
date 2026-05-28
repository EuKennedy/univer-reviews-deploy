'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, BarChart, Bar, Cell,
} from 'recharts'
import { DollarSign, Cpu, AlertTriangle, Zap } from 'lucide-react'
import { PageHeader } from '@/components/godmode/PageHeader'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

const WINDOW_OPTIONS = [7, 14, 30, 90] as const

const TYPE_COLORS: Record<string, string> = {
  moderate: '#22c55e',
  generate: '#a855f7',
  reply: '#3b82f6',
  sentiment: '#f59e0b',
  translate: '#06b6d4',
  dedup: '#ef4444',
  embed: '#64748b',
}

const fmtUsd = (n: number) =>
  n < 1
    ? `$${n.toFixed(4)}`
    : n < 100
    ? `$${n.toFixed(2)}`
    : `$${Math.round(n)}`

export default function AICostPage() {
  const { getToken, isAuthenticated } = useAuth()
  const [windowDays, setWindowDays] = useState<7 | 14 | 30 | 90>(30)

  const { data, isLoading } = useQuery({
    queryKey: ['ai-cost', windowDays],
    queryFn: () => api.ai.costReport(getToken(), windowDays),
    enabled: isAuthenticated,
  })

  const pct = data?.plan_cap_monthly_usd
    ? Math.min(100, (data.month_cost / data.plan_cap_monthly_usd) * 100)
    : null

  const overCap =
    data?.plan_cap_monthly_usd != null && data.month_cost > data.plan_cap_monthly_usd

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Cpu className="w-5 h-5" />}
        title="Consumo de IA"
        subtitle="Custo da Anthropic por workspace + tendência"
        actions={
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}>
            {WINDOW_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: windowDays === d ? 'var(--ur-accent)' : 'transparent',
                  color: windowDays === d ? 'var(--ur-text-on-accent)' : 'var(--ur-text-soft)',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              icon={<DollarSign className="w-4 h-4" />}
              label="Custo no mês"
              value={fmtUsd(data?.month_cost ?? 0)}
              hint={
                data?.plan_cap_monthly_usd != null
                  ? `de ${fmtUsd(data.plan_cap_monthly_usd)}`
                  : 'sem cap (Enterprise)'
              }
              accent={overCap ? 'danger' : 'default'}
            />
            <Stat
              icon={<DollarSign className="w-4 h-4" />}
              label={`Custo (${windowDays}d)`}
              value={fmtUsd(data?.total_cost ?? 0)}
            />
            <Stat
              icon={<Zap className="w-4 h-4" />}
              label="Jobs IA"
              value={data?.total_jobs?.toLocaleString() ?? '—'}
              hint={`${(data?.total_tokens ?? 0).toLocaleString()} tokens`}
            />
            <Stat
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Falhas"
              value={data?.failed_count?.toLocaleString() ?? '—'}
              accent={data && data.failed_count > 0 ? 'warn' : 'default'}
            />
          </div>

          {/* Cap progress bar */}
          {data?.plan_cap_monthly_usd != null && pct != null && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
            >
              <div className="flex items-center justify-between text-sm mb-2">
                <span style={{ color: 'var(--ur-text-soft)' }}>
                  Uso do cap mensal do plano
                </span>
                <span className="font-mono tabular-nums" style={{ color: 'var(--ur-text)' }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ur-bg)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: overCap
                      ? 'var(--ur-danger)'
                      : pct > 80
                      ? 'var(--ur-warn)'
                      : 'linear-gradient(90deg, var(--ur-accent), var(--ur-accent-strong))',
                  }}
                />
              </div>
              {overCap && (
                <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: 'var(--ur-danger)' }}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Cap mensal estourado. Faça upgrade pra evitar interrupções.
                </p>
              )}
            </div>
          )}

          {/* Daily series chart */}
          <ChartCard title="Custo diário" subtitle={`Últimos ${windowDays} dias`}>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-sm" style={{ color: 'var(--ur-text-muted)' }}>
                Carregando…
              </div>
            ) : (data?.daily?.length ?? 0) === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm" style={{ color: 'var(--ur-text-muted)' }}>
                Sem jobs no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data?.daily ?? []} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--ur-border-soft)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="var(--ur-text-muted)" fontSize={11} />
                  <YAxis stroke="var(--ur-text-muted)" fontSize={11} tickFormatter={fmtUsd} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--ur-surface-soft)',
                      border: '1px solid var(--ur-border-strong)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => fmtUsd(v)}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost_usd"
                    stroke="var(--ur-accent)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Per-type breakdown */}
          <ChartCard title="Custo por tipo de job" subtitle="Onde está indo o orçamento de IA">
            {(data?.by_type?.length ?? 0) === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--ur-text-muted)' }}>
                Sem dados no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.by_type ?? []} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--ur-border-soft)" strokeDasharray="3 3" />
                  <XAxis dataKey="job_type" stroke="var(--ur-text-muted)" fontSize={11} />
                  <YAxis stroke="var(--ur-text-muted)" fontSize={11} tickFormatter={fmtUsd} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--ur-surface-soft)',
                      border: '1px solid var(--ur-border-strong)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => fmtUsd(v)}
                  />
                  <Bar dataKey="cost_usd" radius={[6, 6, 0, 0]}>
                    {(data?.by_type ?? []).map((entry) => (
                      <Cell
                        key={entry.job_type}
                        fill={TYPE_COLORS[entry.job_type] ?? '#a855f7'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon, label, value, hint, accent = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  accent?: 'default' | 'warn' | 'danger'
}) {
  const colorMap = {
    default: { bg: 'var(--ur-accent-glow)', text: 'var(--ur-accent)' },
    warn:    { bg: 'var(--ur-warn-bg)',    text: 'var(--ur-warn)'   },
    danger:  { bg: 'var(--ur-danger-bg)',  text: 'var(--ur-danger)' },
  }[accent]
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: colorMap.bg, color: colorMap.text }}
        >
          {icon}
        </div>
        <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>{label}</span>
      </div>
      <div className="text-xl font-bold tracking-tight mt-1" style={{ color: 'var(--ur-text)' }}>
        {value}
      </div>
      {hint && (
        <div className="text-[11px] mt-1" style={{ color: 'var(--ur-text-muted)' }}>{hint}</div>
      )}
    </div>
  )
}

function ChartCard({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>{title}</h3>
        {subtitle && (
          <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}

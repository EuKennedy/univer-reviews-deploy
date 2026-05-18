'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import {
  LayoutDashboard,
  Star,
  Clock,
  Calendar,
  Zap,
  Trash2,
  ArrowRight,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { StatsBar } from '@/components/godmode/StatsBar'
import { StatusBadge } from '@/components/reviews/StatusBadge'
import { RatingStars } from '@/components/reviews/RatingStars'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatNumber, truncate } from '@/lib/utils'
import type { WorkspaceStats } from '@/types'
import Link from 'next/link'

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{ background: 'var(--ur-surface-soft)', border: '1px solid var(--ur-border-strong)' }}
    >
      <p style={{ color: 'var(--ur-text-soft)' }}>{label}</p>
      <p style={{ color: 'var(--ur-accent)' }} className="font-semibold">
        {payload[0].value} avaliações
      </p>
    </div>
  )
}

export default function DashboardPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken } = useAuth()

  const { data: stats, isLoading } = useQuery<WorkspaceStats>({
    queryKey: ['workspace-stats', workspace],
    queryFn: () => api.workspace.stats(getToken()),
  })

  const { data: recentReviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews-recent', workspace],
    queryFn: () =>
      api.reviews.list(
        { per_page: 5, sort: 'created_at', direction: 'desc' },
        getToken()
      ),
  })

  const statItems = [
    {
      label: 'Total de avaliações',
      value: formatNumber(stats?.total_reviews ?? 0),
      delta: stats?.total_reviews_delta,
      icon: <Star className="w-4 h-4" />,
    },
    {
      label: 'Nota média',
      value: stats?.avg_rating?.toFixed(2) ?? '—',
      delta: stats?.avg_rating_delta,
      icon: <Star className="w-4 h-4" />,
      suffix: '/ 5',
    },
    {
      label: 'Aguardando moderação',
      value: formatNumber(stats?.pending_moderation ?? 0),
      delta: stats?.pending_moderation_delta,
      icon: <Clock className="w-4 h-4" />,
    },
    {
      label: 'Este mês',
      value: formatNumber(stats?.reviews_this_month ?? 0),
      delta: stats?.reviews_this_month_delta,
      icon: <Calendar className="w-4 h-4" />,
    },
  ]

  const ratingColors = ['var(--ur-danger)', '#f97316', 'var(--ur-warn)', '#84cc16', 'var(--ur-success)']

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<LayoutDashboard className="w-5 h-5" />}
        title="Dashboard"
        subtitle="Visão geral da sua plataforma de avaliações"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.info('Executando moderação…')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: 'var(--ur-accent-soft)',
                border: '1px solid var(--ur-accent-soft-3)',
                color: 'var(--ur-accent)',
              }}
            >
              <Zap className="w-3.5 h-3.5" />
              Moderar pendentes
            </button>
            <button
              onClick={() => toast.info('Executando limpeza de duplicatas…')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text-soft)',
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Executar limpeza
            </button>
          </div>
        }
      />

      <StatsBar stats={statItems} isLoading={isLoading} />

      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Reviews over time */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
                Avaliações ao longo do tempo
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ur-text-muted)' }}>
                Últimos 30 dias
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="skeleton h-48 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <LineChart
                data={stats?.reviews_over_time ?? []}
                margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ur-surface-soft)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), "d 'de' MMM", { locale: ptBR })}
                  tick={{ fill: 'var(--ur-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--ur-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--ur-accent)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--ur-accent)', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Rating distribution */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
        >
          <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--ur-text)' }}>
            Distribuição de notas
          </h3>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="skeleton w-6 h-4" />
                  <div className="skeleton flex-1 h-5 rounded" />
                  <div className="skeleton w-8 h-4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const item = stats?.rating_distribution?.find(
                  (r) => r.rating === rating
                )
                const count = item?.count ?? 0
                const total = stats?.total_reviews ?? 1
                const pct = Math.round((count / total) * 100)

                return (
                  <div key={rating} className="flex items-center gap-2">
                    <span
                      className="text-xs w-4 text-right tabular-nums"
                      style={{ color: 'var(--ur-text-soft)' }}
                    >
                      {rating}
                    </span>
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--ur-surface-soft)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: ratingColors[rating - 1],
                        }}
                      />
                    </div>
                    <span
                      className="text-xs w-8 text-right tabular-nums"
                      style={{ color: 'var(--ur-text-muted)' }}
                    >
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Recharts mini bar chart */}
          {!isLoading && stats?.rating_distribution && (
            <div className="mt-5">
              <ResponsiveContainer width="100%" height={80}>
                <BarChart
                  data={[1, 2, 3, 4, 5].map((r) => ({
                    rating: r,
                    count:
                      stats.rating_distribution.find((d) => d.rating === r)
                        ?.count ?? 0,
                  }))}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  barSize={20}
                >
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <Cell
                        key={r}
                        fill={ratingColors[r - 1]}
                        fillOpacity={0.7}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent reviews */}
        <div
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--ur-surface-soft)' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
              Avaliações recentes
            </h3>
            <Link
              href={`/${workspace}/reviews`}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'var(--ur-text-muted)' }}
            >
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--ur-surface-soft)' }}>
            {reviewsLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="skeleton w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-32" />
                      <div className="skeleton h-3 w-48" />
                    </div>
                    <div className="skeleton h-5 w-16 rounded-full" />
                  </div>
                ))
              : recentReviews?.data.map((review) => (
                  <Link
                    key={review.id}
                    href={`/${workspace}/reviews/${review.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors"
                    style={{ display: 'flex' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--ur-surface-soft)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: 'var(--ur-accent-soft)',
                        color: 'var(--ur-accent)',
                      }}
                    >
                      {review.author_name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: 'var(--ur-text)' }}
                        >
                          {review.author_name}
                        </span>
                        <RatingStars rating={review.rating} size="xs" />
                      </div>
                      <p
                        className="text-xs truncate"
                        style={{ color: 'var(--ur-text-muted)' }}
                      >
                        {truncate(review.body, 80)}
                      </p>
                    </div>
                    <StatusBadge status={review.status} size="sm" />
                  </Link>
                ))}
          </div>
        </div>

        {/* Quick actions */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ur-text)' }}>
            Ações rápidas
          </h3>

          <div className="space-y-2">
            {[
              {
                label: 'Moderar todas as pendentes',
                desc: 'Executar moderação por IA em avaliações pendentes',
                icon: '⚡',
                action: () => toast.info('Moderando…'),
              },
              {
                label: 'Limpar duplicatas',
                desc: 'Encontrar e remover avaliações duplicadas',
                icon: '🧹',
                action: () => toast.info('Executando limpeza…'),
              },
              {
                label: 'Exportar avaliações',
                desc: 'Baixar CSV com todas as avaliações',
                icon: '📥',
                action: () => toast.info('Preparando exportação…'),
              },
              {
                label: 'Sincronizar WooCommerce',
                desc: 'Importar últimos produtos e avaliações',
                icon: '🔄',
                action: () => toast.info('Sincronizando…'),
              },
            ].map((qa) => (
              <button
                key={qa.label}
                onClick={qa.action}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-150"
                style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-surface-soft)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)'
                  e.currentTarget.style.background = 'var(--ur-surface)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ur-surface-soft)'
                  e.currentTarget.style.background = 'var(--ur-bg-soft)'
                }}
              >
                <span className="text-lg">{qa.icon}</span>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--ur-text)' }}>
                    {qa.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ur-text-muted)' }}>
                    {qa.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

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
      style={{ background: '#1a1a1d', border: '1px solid #2a2a2e' }}
    >
      <p style={{ color: '#8b8b96' }}>{label}</p>
      <p style={{ color: '#d4a850' }} className="font-semibold">
        {payload[0].value} reviews
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
      label: 'Total Reviews',
      value: formatNumber(stats?.total_reviews ?? 0),
      delta: stats?.total_reviews_delta,
      icon: <Star className="w-4 h-4" />,
    },
    {
      label: 'Avg Rating',
      value: stats?.avg_rating?.toFixed(2) ?? '—',
      delta: stats?.avg_rating_delta,
      icon: <Star className="w-4 h-4" />,
      suffix: '/ 5',
    },
    {
      label: 'Pending Moderation',
      value: formatNumber(stats?.pending_moderation ?? 0),
      delta: stats?.pending_moderation_delta,
      icon: <Clock className="w-4 h-4" />,
    },
    {
      label: 'This Month',
      value: formatNumber(stats?.reviews_this_month ?? 0),
      delta: stats?.reviews_this_month_delta,
      icon: <Calendar className="w-4 h-4" />,
    },
  ]

  const ratingColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e']

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<LayoutDashboard className="w-5 h-5" />}
        title="Dashboard"
        subtitle="Overview of your review platform"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.info('Running moderation…')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: 'rgba(212,168,80,0.1)',
                border: '1px solid rgba(212,168,80,0.2)',
                color: '#d4a850',
              }}
            >
              <Zap className="w-3.5 h-3.5" />
              Moderate pending
            </button>
            <button
              onClick={() => toast.info('Running duplicate cleanup…')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: '#0a0a0b',
                border: '1px solid #1e1e21',
                color: '#8b8b96',
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Run cleanup
            </button>
          </div>
        }
      />

      <StatsBar stats={statItems} isLoading={isLoading} />

      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Reviews over time */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{ background: '#111113', border: '1px solid #1e1e21' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
                Reviews over time
              </h3>
              <p className="text-xs mt-0.5" style={{ color: '#5a5a64' }}>
                Last 30 days
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
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1d" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), 'MMM d')}
                  tick={{ fill: '#5a5a64', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#5a5a64', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#d4a850"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#d4a850', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Rating distribution */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#111113', border: '1px solid #1e1e21' }}
        >
          <h3 className="text-sm font-semibold mb-5" style={{ color: '#f0f0f2' }}>
            Rating distribution
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
                      style={{ color: '#8b8b96' }}
                    >
                      {rating}
                    </span>
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: '#1a1a1d' }}
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
                      style={{ color: '#5a5a64' }}
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
          style={{ background: '#111113', border: '1px solid #1e1e21' }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid #1a1a1d' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
              Recent reviews
            </h3>
            <Link
              href={`/${workspace}/reviews`}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: '#5a5a64' }}
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y" style={{ borderColor: '#1a1a1d' }}>
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
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: 'rgba(212,168,80,0.1)',
                        color: '#d4a850',
                      }}
                    >
                      {review.author_name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: '#f0f0f2' }}
                        >
                          {review.author_name}
                        </span>
                        <RatingStars rating={review.rating} size="xs" />
                      </div>
                      <p
                        className="text-xs truncate"
                        style={{ color: '#5a5a64' }}
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
          style={{ background: '#111113', border: '1px solid #1e1e21' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#f0f0f2' }}>
            Quick actions
          </h3>

          <div className="space-y-2">
            {[
              {
                label: 'Moderate all pending',
                desc: 'Run AI moderation on pending reviews',
                icon: '⚡',
                action: () => toast.info('Moderating…'),
              },
              {
                label: 'Run dedup cleanup',
                desc: 'Find and remove duplicate reviews',
                icon: '🧹',
                action: () => toast.info('Running cleanup…'),
              },
              {
                label: 'Export reviews',
                desc: 'Download CSV of all reviews',
                icon: '📥',
                action: () => toast.info('Preparing export…'),
              },
              {
                label: 'Sync WooCommerce',
                desc: 'Pull latest products and reviews',
                icon: '🔄',
                action: () => toast.info('Syncing…'),
              },
            ].map((qa) => (
              <button
                key={qa.label}
                onClick={qa.action}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-150"
                style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212,168,80,0.2)'
                  e.currentTarget.style.background = '#131316'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#1a1a1d'
                  e.currentTarget.style.background = '#0d0d0f'
                }}
              >
                <span className="text-lg">{qa.icon}</span>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#f0f0f2' }}>
                    {qa.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#5a5a64' }}>
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

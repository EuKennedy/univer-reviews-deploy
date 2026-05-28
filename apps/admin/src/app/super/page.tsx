'use client'

/**
 * Super admin dashboard — cross-tenant ops home.
 *
 * Top-line stats row (workspaces, active, MRR estimate, AI cost month),
 * filterable + sortable list of every workspace, click-through to detail.
 * Dark-first editorial design, accent gold, staggered entry motion.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Globe2,
  Building2,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ArrowUpDown,
  Inbox,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/godmode/PageHeader'
import { Toolbar, SearchInput } from '@/components/godmode/Toolbar'
import { FilterChips } from '@/components/ai-summary/FilterChips'
import { StatusPill } from '@/components/super/StatusPill'
import { PlanPill } from '@/components/super/PlanPill'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { SuperAdminPlan, SuperAdminStatus, SuperAdminWorkspaceRow } from '@/types'

type PlanFilter = 'all' | SuperAdminPlan
type StatusFilter = 'all' | SuperAdminStatus
type SortKey = 'mrr_desc' | 'last_active_desc' | 'signup_desc'

export default function SuperDashboardPage() {
  const { getToken, isAuthenticated } = useAuth()
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('signup_desc')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'workspaces', { planFilter, statusFilter, search, sort }],
    queryFn: () =>
      api.superAdmin.workspaces.list(
        {
          plan: planFilter === 'all' ? '' : planFilter,
          status: statusFilter === 'all' ? '' : statusFilter,
          q: search || undefined,
          sort,
        },
        getToken(),
      ),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  })

  const rows: SuperAdminWorkspaceRow[] = data?.data ?? []
  const meta = data?.meta

  const planCounts = useMemo(() => {
    const all = rows.length
    const counts: Record<SuperAdminPlan, number> = {
      free: 0, entry: 0, medium: 0, ultra: 0,
    }
    rows.forEach((r) => {
      counts[r.plan_label] = (counts[r.plan_label] ?? 0) + 1
    })
    return { all, ...counts }
  }, [rows])

  const statusCounts = useMemo(() => {
    return {
      all: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      trial: rows.filter((r) => r.status === 'trial').length,
      suspended: rows.filter((r) => r.status === 'suspended').length,
    }
  }, [rows])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Globe2 className="w-5 h-5" />}
        title="Visão geral"
        subtitle="Todos os workspaces da plataforma — ops cross-tenant"
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-4">
        <StatCard
          index={0}
          label="Total workspaces"
          value={fmtInt(meta?.total_workspaces ?? rows.length)}
          icon={<Building2 className="w-3.5 h-3.5" />}
        />
        <StatCard
          index={1}
          label="Workspaces ativos"
          value={fmtInt(meta?.active_workspaces ?? statusCounts.active)}
          icon={<Globe2 className="w-3.5 h-3.5" />}
          accent
        />
        <StatCard
          index={2}
          label="MRR estimado"
          value={fmtBrl(meta?.mrr_estimate_brl ?? rows.reduce((s, r) => s + (r.mrr_brl || 0), 0))}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
        />
        <StatCard
          index={3}
          label="Custo IA / mês"
          value={fmtUsd(meta?.ai_cost_month_usd ?? 0)}
          icon={<Sparkles className="w-3.5 h-3.5" />}
          subtle
        />
      </div>

      <Toolbar
        left={
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar slug ou nome…"
            />
            <FilterChips<PlanFilter>
              value={planFilter}
              onChange={setPlanFilter}
              options={[
                { value: 'all',    label: 'Todos',  count: planCounts.all },
                { value: 'free',   label: 'Free',   count: planCounts.free },
                { value: 'entry',  label: 'Entry',  count: planCounts.entry },
                { value: 'medium', label: 'Medium', count: planCounts.medium },
                { value: 'ultra',  label: 'Ultra',  count: planCounts.ultra },
              ]}
              ariaLabel="Filtrar por plano"
            />
            <FilterChips<StatusFilter>
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all',       label: 'Todos status', count: statusCounts.all },
                { value: 'active',    label: 'Ativos',       count: statusCounts.active },
                { value: 'trial',     label: 'Trial',        count: statusCounts.trial },
                { value: 'suspended', label: 'Suspensos',    count: statusCounts.suspended },
              ]}
              ariaLabel="Filtrar por status"
            />
          </div>
        }
        right={
          <div className="flex items-center gap-3">
            <div
              className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ur-text-muted)' }}
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>Ordenar</span>
            </div>
            <FilterChips<SortKey>
              value={sort}
              onChange={setSort}
              options={[
                { value: 'mrr_desc',         label: 'MRR' },
                { value: 'last_active_desc', label: 'Atividade' },
                { value: 'signup_desc',      label: 'Cadastro' },
              ]}
              ariaLabel="Ordenação"
            />
            <span
              className="text-xs hidden md:inline tabular-nums"
              style={{ color: 'var(--ur-text-muted)' }}
            >
              {rows.length} {rows.length === 1 ? 'workspace' : 'workspaces'}
            </span>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <RowSkeleton key={i} delay={i * 0.05} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <motion.div className="px-4 py-3 space-y-2">
            {rows.map((row, i) => (
              <WorkspaceRow key={row.id} row={row} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({
  index = 0,
  label,
  value,
  icon,
  accent,
  subtle,
}: {
  index?: number
  label: string
  value: string
  icon?: React.ReactNode
  accent?: boolean
  subtle?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 + index * 0.06, ease: [0.2, 0.0, 0.2, 1] }}
      className="rounded-xl p-4 relative overflow-hidden"
      style={{
        background: accent
          ? 'linear-gradient(135deg, var(--ur-accent-glow), transparent)'
          : 'var(--ur-bg-soft)',
        border: `1px solid ${accent ? 'var(--ur-accent-soft-2)' : 'var(--ur-border)'}`,
      }}
    >
      {accent && (
        <motion.div
          aria-hidden
          className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
          style={{ background: 'var(--ur-accent-ring)', filter: 'blur(28px)' }}
          animate={{ opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div
        className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: accent ? 'var(--ur-accent)' : 'var(--ur-text-muted)' }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <p
        className="relative font-semibold tabular-nums tracking-tight"
        style={{
          color: subtle ? 'var(--ur-text-soft)' : 'var(--ur-text)',
          fontSize: subtle ? 18 : 22,
        }}
      >
        {value}
      </p>
    </motion.div>
  )
}

function WorkspaceRow({ row, index }: { row: SuperAdminWorkspaceRow; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.03, 0.4), ease: [0.2, 0.0, 0.2, 1] }}
    >
      <Link
        href={`/super/workspaces/${row.id}`}
        className="group relative flex items-center gap-4 p-3.5 rounded-xl transition-all cursor-pointer overflow-hidden"
        style={{
          background: 'var(--ur-bg-soft)',
          border: '1px solid var(--ur-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)'
          e.currentTarget.style.background = 'var(--ur-surface)'
          e.currentTarget.style.boxShadow =
            '0 8px 24px -12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.04)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--ur-border)'
          e.currentTarget.style.background = 'var(--ur-bg-soft)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background:
              'linear-gradient(180deg, var(--ur-accent), transparent 90%)',
          }}
        />

        {/* Brand-color disc */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold tracking-wider uppercase"
          style={{
            background: row.brand_color ?? 'var(--ur-accent-soft-3)',
            color: '#0a0a0a',
            opacity: 0.92,
          }}
        >
          {row.slug.slice(0, 2)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--ur-text)' }}
            >
              {row.name}
            </span>
            <span
              className="text-xs font-mono truncate"
              style={{ color: 'var(--ur-text-muted)' }}
            >
              /{row.slug}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PlanPill plan={row.plan_label} />
            <StatusPill status={row.status} />
            {row.owner_email && (
              <span
                className="text-[11px] truncate"
                style={{ color: 'var(--ur-text-soft)' }}
              >
                {row.owner_email}
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
          <span
            className="text-sm font-semibold tabular-nums tracking-tight"
            style={{ color: 'var(--ur-text)' }}
          >
            {fmtBrl(row.mrr_brl)}
            <span
              className="text-[10px] font-normal ml-1 uppercase tracking-wider"
              style={{ color: 'var(--ur-text-muted)' }}
            >
              /mês
            </span>
          </span>
          <span className="text-[11px]" style={{ color: 'var(--ur-text-muted)' }}>
            {row.last_active_at
              ? `ativo ${formatDistanceToNow(new Date(row.last_active_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}`
              : 'sem atividade'}
          </span>
        </div>

        <ChevronRight
          className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          style={{ color: 'var(--ur-text-muted)' }}
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  )
}

function RowSkeleton({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl p-3.5 flex items-center gap-4"
      style={{
        background: 'var(--ur-bg-soft)',
        border: '1px solid var(--ur-border)',
      }}
    >
      <div className="w-9 h-9 rounded-lg shrink-0" style={{ background: 'var(--ur-surface-soft)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded" style={{ background: 'var(--ur-surface-soft)' }} />
        <div className="h-2.5 w-1/2 rounded" style={{ background: 'var(--ur-surface-soft)' }} />
      </div>
    </motion.div>
  )
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-20">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'var(--ur-accent-soft)',
          border: '1px solid var(--ur-accent-soft-2)',
        }}
      >
        <Inbox className="w-6 h-6" style={{ color: 'var(--ur-accent)' }} />
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
        {search ? 'Nada bate com essa busca' : 'Nenhum workspace ainda'}
      </h3>
      <p className="text-sm max-w-sm" style={{ color: 'var(--ur-text-soft)' }}>
        {search
          ? 'Tente outra palavra ou limpe os filtros — o universo é grande.'
          : 'Quando alguém criar uma conta, aparece aqui. Por ora, silêncio.'}
      </p>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtInt(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n)
}

/**
 * Brazilian-real currency formatter for everything tenant-facing — MRR,
 * billing copy, etc. AI cost stays in USD because Anthropic bills us in
 * USD; that path uses `fmtUsd` below.
 */
function fmtBrl(n: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: n < 100 ? 2 : 0,
  }).format(n)
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n < 100 ? 2 : 0,
  }).format(n)
}

'use client'

/**
 * Super admin — workspace detail.
 *
 * Five tabs (Overview / Members / Audit / Billing / Danger). Each tab is
 * rendered into the same scroll container so the chrome (header, tab bar)
 * stays sticky and the operator can flip between them without re-fetching
 * core workspace data. The active-tab underline uses framer-motion's
 * layoutId so the bar slides between tabs instead of popping.
 */

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Star,
  Package,
  TrendingUp,
  Activity,
  Pause,
  Play,
  Trash2,
  UserCheck,
  ArrowLeft,
  Loader2,
  Receipt,
  Users,
  ScrollText,
  CreditCard,
  AlertOctagon,
  Ban,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { ActionButton } from '@/components/godmode/Toolbar'
import { StatusPill } from '@/components/super/StatusPill'
import { PlanPill } from '@/components/super/PlanPill'
import { ConfirmModal } from '@/components/super/ConfirmModal'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type {
  SuperAdminPlan,
  SuperAdminWorkspaceDetail,
  SuperAdminAuditLog,
  SuperAdminWorkspaceMember,
} from '@/types'

type Tab = 'overview' | 'members' | 'audit' | 'billing' | 'danger'

export default function SuperWorkspaceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')

  const detailQuery = useQuery({
    queryKey: ['super-admin', 'workspace', id],
    queryFn: () => api.superAdmin.workspaces.get(id, getToken()),
    enabled: isAuthenticated && !!id,
  })

  const ws = detailQuery.data

  // ─── Mutations ──────────────────────────────────────────────────────────
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['super-admin', 'workspace', id] })
    void queryClient.invalidateQueries({ queryKey: ['super-admin', 'workspaces'] })
  }

  const suspendMut = useMutation({
    mutationFn: () => api.superAdmin.workspaces.suspend(id, getToken()),
    onSuccess: () => {
      toast.success('Workspace suspenso')
      invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha ao suspender'),
  })

  const unsuspendMut = useMutation({
    mutationFn: () => api.superAdmin.workspaces.unsuspend(id, getToken()),
    onSuccess: () => {
      toast.success('Workspace reativado')
      invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha ao reativar'),
  })

  const switchPlanMut = useMutation({
    mutationFn: (plan: SuperAdminPlan) =>
      api.superAdmin.workspaces.switchPlan(id, plan, getToken()),
    onSuccess: () => {
      toast.success('Plano atualizado')
      invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha ao trocar plano'),
  })

  const softDestroyMut = useMutation({
    mutationFn: (force: boolean) =>
      api.superAdmin.workspaces.softDestroy(id, getToken(), { force }),
    onSuccess: () => {
      toast.success('Workspace marcado para remoção')
      invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  })

  const cancelPlanMut = useMutation({
    mutationFn: (reason?: string) =>
      api.superAdmin.workspaces.cancelPlan(id, getToken(), { reason }),
    onSuccess: () => {
      toast.success('Plano cancelado — voluntary churn registrada')
      invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha ao cancelar plano'),
  })

  const setSeatLimitMut = useMutation({
    mutationFn: (limit: number | null) =>
      api.superAdmin.workspaces.setSeatLimit(id, limit, getToken()),
    onSuccess: () => {
      toast.success('Limite de assentos atualizado')
      invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha ao alterar limite'),
  })

  const removeMemberMut = useMutation({
    mutationFn: (memberId: string) =>
      api.superAdmin.members.remove(id, memberId, getToken()),
    onSuccess: () => {
      toast.success('Membro removido')
      invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha ao remover membro'),
  })

  const bulkRemoveMembersMut = useMutation({
    mutationFn: (memberIds: string[]) =>
      api.superAdmin.members.bulkRemove(id, memberIds, getToken()),
    onSuccess: (res) => {
      toast.success(
        `${res.removed_count} ${res.removed_count === 1 ? 'membro removido' : 'membros removidos'}` +
          (res.skipped_ids.length > 0 ? ` (${res.skipped_ids.length} ignorados)` : ''),
      )
      invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha na remoção em massa'),
  })

  const impersonateMut = useMutation({
    mutationFn: () => api.superAdmin.workspaces.impersonate(id, getToken()),
    onSuccess: async (payload) => {
      try {
        // Better Auth admin plugin endpoint. The session cookie we
        // already carry is reissued for the target user. After success
        // we land on the merchant home.
        const res = await fetch(payload.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId: payload.user_id }),
        })
        if (!res.ok) throw new Error(await res.text())
        toast.success(`Impersonando ${payload.email}`)
        window.location.href = payload.redirect_to || '/'
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `Falha na impersonação: ${err.message}`
            : 'Falha na impersonação',
        )
      }
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha ao impersonar'),
  })

  // ─── Confirm modal state ────────────────────────────────────────────────
  const [confirm, setConfirm] = useState<
    | { kind: 'suspend' }
    | { kind: 'unsuspend' }
    | { kind: 'soft_destroy' }
    | { kind: 'impersonate' }
    | { kind: 'switch_plan'; plan: SuperAdminPlan }
    | { kind: 'cancel_plan' }
    | null
  >(null)

  const runConfirmed = () => {
    if (!confirm || !ws) return
    switch (confirm.kind) {
      case 'suspend': suspendMut.mutate(); break
      case 'unsuspend': unsuspendMut.mutate(); break
      case 'cancel_plan': cancelPlanMut.mutate(undefined); break
      case 'soft_destroy':
        // We pass force=1 once the operator has typed the slug — the
        // backend's "has_data" guard exists for accidental destructive
        // clicks from a script, not for the founder typing the slug.
        softDestroyMut.mutate(true); break
      case 'impersonate': impersonateMut.mutate(); break
      case 'switch_plan': switchPlanMut.mutate(confirm.plan); break
    }
    setConfirm(null)
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Building2 className="w-5 h-5" />}
        title={ws ? ws.name : 'Carregando…'}
        subtitle={ws ? `/${ws.slug}` : undefined}
        breadcrumbs={[
          { label: 'Super admin', href: '/super' },
          { label: ws?.name ?? '…' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ActionButton onClick={() => router.push('/super')} variant="ghost">
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </ActionButton>
            {ws && (
              <ActionButton
                variant="primary"
                onClick={() => setConfirm({ kind: 'impersonate' })}
                disabled={impersonateMut.isPending}
              >
                {impersonateMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                Impersonar
              </ActionButton>
            )}
          </div>
        }
      />

      {/* Header summary strip */}
      {ws && (
        <div
          className="flex items-center gap-4 flex-wrap px-5 py-3"
          style={{ borderBottom: '1px solid var(--ur-border)' }}
        >
          <PlanPill plan={ws.plan_label} />
          <StatusPill status={ws.status} />
          <Sep />
          <Field label="MRR" value={fmtBrl(ws.mrr_brl) + '/mês'} />
          <Sep />
          <Field
            label="Cadastro"
            value={
              ws.created_at
                ? format(new Date(ws.created_at), 'dd MMM yyyy', { locale: ptBR })
                : '—'
            }
          />
          <Sep />
          <Field
            label="Atividade"
            value={
              ws.last_active_at
                ? formatDistanceToNow(new Date(ws.last_active_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : 'sem dados'
            }
          />
        </div>
      )}

      {/* Tab bar */}
      <div
        className="flex items-end gap-1 px-5 pt-3"
        style={{ borderBottom: '1px solid var(--ur-border)' }}
      >
        {(
          [
            { key: 'overview', label: 'Visão geral',  icon: TrendingUp },
            { key: 'members',  label: 'Membros',      icon: Users },
            { key: 'audit',    label: 'Auditoria',    icon: ScrollText },
            { key: 'billing',  label: 'Faturamento',  icon: CreditCard },
            { key: 'danger',   label: 'Zona de risco', icon: AlertOctagon },
          ] as { key: Tab; label: string; icon: React.ElementType }[]
        ).map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="relative px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              style={{
                color: active ? 'var(--ur-text)' : 'var(--ur-text-soft)',
              }}
            >
              <t.icon className="w-3.5 h-3.5" aria-hidden="true" />
              {t.label}
              {active && (
                <motion.span
                  layoutId="super-tab-underline"
                  className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full"
                  style={{ background: 'var(--ur-accent)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {detailQuery.isLoading || !ws ? (
          <div className="space-y-3">
            <div className="h-24 rounded-xl" style={{ background: 'var(--ur-bg-soft)' }} />
            <div className="h-48 rounded-xl" style={{ background: 'var(--ur-bg-soft)' }} />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.2, 0.0, 0.2, 1] }}
            >
              {tab === 'overview' && (
                <OverviewTab
                  ws={ws}
                  onSaveSeatLimit={(limit) => setSeatLimitMut.mutate(limit)}
                  seatLimitPending={setSeatLimitMut.isPending}
                />
              )}
              {tab === 'members' && (
                <MembersTab
                  workspaceId={ws.id}
                  members={ws.workspace_users}
                  effectiveSeatLimit={ws.effective_seat_limit}
                  onRemove={(memberId) => removeMemberMut.mutate(memberId)}
                  onBulkRemove={(memberIds) => bulkRemoveMembersMut.mutate(memberIds)}
                  removePending={removeMemberMut.isPending || bulkRemoveMembersMut.isPending}
                />
              )}
              {tab === 'audit' && <AuditTab workspaceId={ws.id} />}
              {tab === 'billing' && (
                <BillingTab
                  ws={ws}
                  onSwitchPlan={(plan) => setConfirm({ kind: 'switch_plan', plan })}
                  onCancelPlan={() => setConfirm({ kind: 'cancel_plan' })}
                  pending={switchPlanMut.isPending || cancelPlanMut.isPending}
                />
              )}
              {tab === 'danger' && (
                <DangerTab
                  ws={ws}
                  onSuspend={() => setConfirm({ kind: 'suspend' })}
                  onUnsuspend={() => setConfirm({ kind: 'unsuspend' })}
                  onSoftDestroy={() => setConfirm({ kind: 'soft_destroy' })}
                  pending={
                    suspendMut.isPending ||
                    unsuspendMut.isPending ||
                    softDestroyMut.isPending
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {confirm && ws && (
        <ConfirmModal
          {...confirmCopy(confirm, ws)}
          confirmToken={ws.slug}
          loading={
            suspendMut.isPending ||
            unsuspendMut.isPending ||
            softDestroyMut.isPending ||
            switchPlanMut.isPending ||
            impersonateMut.isPending
          }
          onConfirm={runConfirmed}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

// ─── Tab content ─────────────────────────────────────────────────────────────

function OverviewTab({
  ws,
  onSaveSeatLimit,
  seatLimitPending,
}: {
  ws: SuperAdminWorkspaceDetail
  onSaveSeatLimit: (limit: number | null) => void
  seatLimitPending: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Reviews" value={fmtInt(ws.reviews_count)} icon={<Star className="w-3.5 h-3.5" />} />
        <StatTile label="Produtos" value={fmtInt(ws.products_count)} icon={<Package className="w-3.5 h-3.5" />} />
        <StatTile
          label="Usuários"
          value={
            ws.effective_seat_limit !== null
              ? `${fmtInt(ws.users_count)} / ${fmtInt(ws.effective_seat_limit)}`
              : fmtInt(ws.users_count)
          }
          icon={<Users className="w-3.5 h-3.5" />}
        />
        <StatTile label="MRR" value={fmtBrl(ws.mrr_brl) + '/m'} icon={<TrendingUp className="w-3.5 h-3.5" />} accent />
      </div>

      <SeatLimitCard
        currentOverride={ws.seat_limit}
        effective={ws.effective_seat_limit}
        reached={ws.seat_limit_reached}
        onSave={onSaveSeatLimit}
        pending={seatLimitPending}
      />


      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="Custo de IA">
          <Row label="Este mês" value={fmtUsdPrecise(ws.ai_cost_month_usd)} />
          <Row label="Lifetime" value={fmtUsdPrecise(ws.ai_cost_lifetime_usd)} />
        </Card>

        <Card title="Identidade">
          <Row label="ID" value={<code className="font-mono text-[11px]">{ws.id}</code>} />
          <Row label="Slug" value={`/${ws.slug}`} />
          <Row label="Plano (DB)" value={ws.plan} />
          <Row
            label="Cor da marca"
            value={
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block w-4 h-4 rounded"
                  style={{
                    background: ws.brand_color ?? 'transparent',
                    border: '1px solid var(--ur-border)',
                  }}
                />
                <code className="font-mono text-[11px]">{ws.brand_color ?? '—'}</code>
              </span>
            }
          />
        </Card>
      </div>
    </div>
  )
}

function MembersTab({
  workspaceId,
  members,
  effectiveSeatLimit,
  onRemove,
  onBulkRemove,
  removePending,
}: {
  workspaceId: string
  members: SuperAdminWorkspaceMember[]
  effectiveSeatLimit: number | null
  onRemove: (memberId: string) => void
  onBulkRemove: (memberIds: string[]) => void
  removePending: boolean
}) {
  void workspaceId
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pendingConfirm, setPendingConfirm] = useState<
    | { kind: 'single'; member: SuperAdminWorkspaceMember }
    | { kind: 'bulk'; ids: string[] }
    | null
  >(null)

  if (members.length === 0) {
    return (
      <Card title="Membros">
        <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>
          Nenhum membro provisionado.
        </p>
      </Card>
    )
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = members.every((m) => selected.has(m.id))
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(members.map((m) => m.id)))
    }
  }

  const seatLabel =
    effectiveSeatLimit !== null
      ? `${members.length} / ${effectiveSeatLimit} ${effectiveSeatLimit === 1 ? 'assento' : 'assentos'}`
      : `${members.length} ${members.length === 1 ? 'pessoa' : 'pessoas'} · sem limite`

  return (
    <>
      <Card title="Membros" subtitle={seatLabel}>
        {/* Bulk action bar — only mounts when 1+ rows checked.
          * Self-confirm is required: bulk delete is irreversible and we
          * never want a stray click on the master checkbox + Remove to
          * wipe a tenant's team. */}
        {selected.size > 0 && (
          <div
            className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg"
            style={{
              background: 'var(--ur-accent-glow)',
              border: '1px solid var(--ur-accent-soft-2)',
            }}
          >
            <span className="text-xs font-semibold" style={{ color: 'var(--ur-accent)' }}>
              {selected.size} {selected.size === 1 ? 'selecionado' : 'selecionados'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-xs underline cursor-pointer"
                style={{ color: 'var(--ur-text-soft)' }}
              >
                limpar
              </button>
              <ActionButton
                variant="danger"
                disabled={removePending}
                onClick={() => setPendingConfirm({ kind: 'bulk', ids: Array.from(selected) })}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover {selected.size}
              </ActionButton>
            </div>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center gap-3 pb-2 mb-1" style={{ borderBottom: '1px solid var(--ur-border)' }}>
          <input
            type="checkbox"
            aria-label="Selecionar todos os membros"
            checked={allSelected}
            onChange={toggleAll}
            className="cursor-pointer"
            style={{ accentColor: 'var(--ur-accent)' }}
          />
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--ur-text-muted)' }}>
            Todos
          </span>
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--ur-border)' }}>
          {members.map((m) => {
            const isChecked = selected.has(m.id)
            return (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${m.email}`}
                  checked={isChecked}
                  onChange={() => toggle(m.id)}
                  className="cursor-pointer shrink-0"
                  style={{ accentColor: 'var(--ur-accent)' }}
                />
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: 'var(--ur-accent-soft-3)',
                    color: 'var(--ur-accent)',
                  }}
                >
                  {(m.name || m.email)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--ur-text)' }}
                  >
                    {m.name || m.email}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: 'var(--ur-text-muted)' }}
                  >
                    {m.email} ·{' '}
                    {m.last_login_at
                      ? `último acesso ${formatDistanceToNow(new Date(m.last_login_at), { addSuffix: true, locale: ptBR })}`
                      : 'nunca acessou'}
                    {m.better_auth_user_id ? '' : ' · sem login'}
                  </p>
                </div>
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded"
                  style={{
                    background:
                      m.role === 'owner'
                        ? 'var(--ur-accent-soft)'
                        : 'var(--ur-surface-soft)',
                    color:
                      m.role === 'owner'
                        ? 'var(--ur-accent)'
                        : 'var(--ur-text-soft)',
                  }}
                >
                  {m.role}
                </span>
                <button
                  type="button"
                  aria-label={`Remover ${m.email}`}
                  onClick={() => setPendingConfirm({ kind: 'single', member: m })}
                  disabled={removePending}
                  className="p-1.5 rounded-md cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: 'var(--ur-danger)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ur-danger-bg)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      {pendingConfirm && (
        <ConfirmModal
          title={pendingConfirm.kind === 'bulk' ? 'Remover membros selecionados' : 'Remover membro'}
          subtitle={
            pendingConfirm.kind === 'bulk'
              ? `${pendingConfirm.ids.length} ${pendingConfirm.ids.length === 1 ? 'pessoa' : 'pessoas'}`
              : pendingConfirm.member.email
          }
          confirmLabel="Remover"
          variant="danger"
          description={
            pendingConfirm.kind === 'bulk'
              ? `Os ${pendingConfirm.ids.length} membros perdem o acesso ao workspace imediatamente. O usuário Better Auth NÃO é removido — só o link com este workspace. Operação registrada em audit.`
              : `${pendingConfirm.member.email} perde acesso ao workspace imediatamente. O usuário Better Auth segue ativo (poderá ser reconvidado depois). Operação registrada em audit.`
          }
          // Bulk delete demands the literal "REMOVER" token so a stray
          // checkbox + click sequence can't wipe a team. Single delete
          // demands the member email verbatim — same defensive bar as
          // the rest of the Danger lane on this page.
          confirmToken={pendingConfirm.kind === 'bulk' ? 'REMOVER' : pendingConfirm.member.email}
          onClose={() => setPendingConfirm(null)}
          onConfirm={() => {
            if (pendingConfirm.kind === 'bulk') {
              onBulkRemove(pendingConfirm.ids)
              setSelected(new Set())
            } else {
              onRemove(pendingConfirm.member.id)
            }
            setPendingConfirm(null)
          }}
          loading={removePending}
        />
      )}
    </>
  )
}

function AuditTab({ workspaceId }: { workspaceId: string }) {
  const { getToken } = useAuth()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'workspace', workspaceId, 'audit', page],
    queryFn: () =>
      api.superAdmin.workspaces.audit(workspaceId, { page, per_page: 25 }, getToken()),
  })

  const logs: SuperAdminAuditLog[] = data?.data ?? []
  const meta = data?.meta

  return (
    <Card
      title="Auditoria"
      subtitle={meta ? `${meta.total_count} ${meta.total_count === 1 ? 'evento' : 'eventos'}` : undefined}
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg"
              style={{ background: 'var(--ur-surface-soft)' }}
            />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>
          Nenhum evento registrado.
        </p>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--ur-border)' }}>
          {logs.map((row) => (
            <div key={row.id} className="py-3 flex items-start gap-3">
              <div
                className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                style={{
                  background: row.action.startsWith('super_admin.')
                    ? 'var(--ur-accent)'
                    : 'var(--ur-text-muted)',
                }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-mono truncate"
                  style={{ color: 'var(--ur-text)' }}
                >
                  {row.action}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ur-text-muted)' }}>
                  {row.actor?.email ?? 'sistema'} ·{' '}
                  {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ptBR })}
                </p>
                {row.metadata && Object.keys(row.metadata).length > 0 && (
                  <pre
                    className="mt-2 text-[11px] font-mono rounded p-2 overflow-x-auto"
                    style={{
                      background: 'var(--ur-bg)',
                      color: 'var(--ur-text-soft)',
                      border: '1px solid var(--ur-border)',
                    }}
                  >
                    {JSON.stringify(row.metadata, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <ActionButton
            variant="ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </ActionButton>
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            Página {meta.current_page} de {meta.total_pages}
          </span>
          <ActionButton
            variant="ghost"
            onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
            disabled={page >= meta.total_pages}
          >
            Próxima
          </ActionButton>
        </div>
      )}
    </Card>
  )
}

function BillingTab({
  ws,
  onSwitchPlan,
  onCancelPlan,
  pending,
}: {
  ws: SuperAdminWorkspaceDetail
  onSwitchPlan: (plan: SuperAdminPlan) => void
  onCancelPlan: () => void
  pending: boolean
}) {
  const isCancelled = ws.status === 'cancelled'
  return (
    <div className="space-y-4">
      <Card title="Plano atual" subtitle={fmtBrl(ws.mrr_brl) + '/mês'}>
        <div className="flex items-center gap-2 flex-wrap">
          <PlanPill plan={ws.plan_label} size="md" />
          <StatusPill status={ws.status} />
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            slug DB: {ws.plan}
          </span>
        </div>
      </Card>

      <Card title="Trocar plano" subtitle="Ação registrada no audit log">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['free', 'entry', 'medium', 'ultra'] as SuperAdminPlan[]).map((plan) => {
            const current = plan === ws.plan_label
            return (
              <button
                key={plan}
                type="button"
                onClick={() => !current && onSwitchPlan(plan)}
                disabled={current || pending}
                className="rounded-xl p-4 text-left transition-all cursor-pointer disabled:cursor-not-allowed"
                style={{
                  background: current
                    ? 'var(--ur-accent-soft)'
                    : 'var(--ur-bg-soft)',
                  border: `1px solid ${current ? 'var(--ur-accent-soft-2)' : 'var(--ur-border)'}`,
                }}
              >
                <PlanPill plan={plan} />
                <p
                  className="text-xs mt-2 capitalize"
                  style={{ color: 'var(--ur-text-muted)' }}
                >
                  {current ? 'atual' : 'mudar para'}
                </p>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Cancel plan — voluntary churn lane. Distinct from Danger →
        * Suspend (which we use for moderation / abuse) so the audit log
        * can tell the two intents apart later. */}
      <Card
        title="Cancelar plano"
        subtitle="Marca como churn voluntário (diferente de suspender)"
      >
        <p className="text-sm mb-3" style={{ color: 'var(--ur-text-soft)' }}>
          {isCancelled
            ? 'Este workspace já está cancelado. Para reativar, troque o plano acima ou use Reativar em Danger.'
            : 'O painel segue acessível, mas todo gate de plano passa a bloquear. Use quando o cliente pediu para sair (não use para suspender por inadimplência ou abuso — isso vai em Danger).'}
        </p>
        <ActionButton
          variant="danger"
          onClick={onCancelPlan}
          disabled={isCancelled || pending}
        >
          <Ban className="w-3.5 h-3.5" />
          Cancelar plano
        </ActionButton>
      </Card>
    </div>
  )
}

/**
 * Per-workspace seat-limit override card. Lives in the Overview tab so
 * the founder can grant a custom seat pool (e.g., a Medium customer who
 * negotiates 10 seats instead of the default 5) without bumping the
 * plan or hard-coding it in PlanFeatures. Empty input = clear the
 * override and fall back to the plan default.
 */
function SeatLimitCard({
  currentOverride,
  effective,
  reached,
  onSave,
  pending,
}: {
  currentOverride: number | null
  effective: number | null
  reached: boolean
  onSave: (limit: number | null) => void
  pending: boolean
}) {
  const [draft, setDraft] = useState<string>(
    currentOverride === null ? '' : String(currentOverride),
  )
  const parsed = draft.trim() === '' ? null : Number(draft)
  const invalid =
    parsed !== null && (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000)

  // True when the input differs from the persisted override AND is valid.
  const dirty =
    !invalid && parsed !== currentOverride

  return (
    <Card
      title="Limite de assentos"
      subtitle={
        effective === null
          ? 'Sem limite — herdado do plano ultra'
          : `Cap efetivo: ${effective}${currentOverride === null ? ' (plano)' : ' (override)'}`
      }
    >
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <label
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            Override (vazio = usar plano)
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              effective === null ? 'sem limite' : `padrão: ${effective}`
            }
            className="rounded-lg px-3 py-2 text-sm outline-none w-40"
            style={{
              background: 'var(--ur-bg)',
              border: `1px solid ${invalid ? 'var(--ur-danger)' : 'var(--ur-border)'}`,
              color: 'var(--ur-text)',
            }}
          />
        </div>
        <ActionButton
          variant="primary"
          onClick={() => onSave(parsed)}
          disabled={!dirty || invalid || pending}
        >
          Salvar
        </ActionButton>
        {currentOverride !== null && (
          <ActionButton
            variant="ghost"
            onClick={() => {
              setDraft('')
              onSave(null)
            }}
            disabled={pending}
          >
            Limpar override
          </ActionButton>
        )}
      </div>
      {invalid && (
        <p className="text-xs mt-2" style={{ color: 'var(--ur-danger)' }}>
          Use um inteiro entre 1 e 10.000.
        </p>
      )}
      {reached && (
        <p className="text-xs mt-2" style={{ color: 'var(--ur-warn)' }}>
          Workspace atingiu o cap atual. Novos convites serão rejeitados.
        </p>
      )}
    </Card>
  )
}

function DangerTab({
  ws,
  onSuspend,
  onUnsuspend,
  onSoftDestroy,
  pending,
}: {
  ws: SuperAdminWorkspaceDetail
  onSuspend: () => void
  onUnsuspend: () => void
  onSoftDestroy: () => void
  pending: boolean
}) {
  return (
    <div className="space-y-3">
      <DangerCard
        title={ws.status === 'suspended' ? 'Reativar workspace' : 'Suspender workspace'}
        description={
          ws.status === 'suspended'
            ? 'Restaura o acesso para o cliente. Reviews e dashboard voltam imediatamente.'
            : 'O cliente perde acesso imediatamente. Reviews continuam armazenados, widget e dashboard mostram 401.'
        }
        actionLabel={ws.status === 'suspended' ? 'Reativar' : 'Suspender'}
        icon={ws.status === 'suspended' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
        variant={ws.status === 'suspended' ? 'neutral' : 'warning'}
        onClick={ws.status === 'suspended' ? onUnsuspend : onSuspend}
        disabled={pending}
      />

      <DangerCard
        title="Soft delete"
        description="Marca o workspace para remoção e esconde de todas as listas. Não apaga dados — pode ser revertido via SQL."
        actionLabel="Excluir"
        icon={<Trash2 className="w-3.5 h-3.5" />}
        variant="danger"
        onClick={onSoftDestroy}
        disabled={pending}
      />

      <DangerCard
        title="Impersonação rápida"
        description="Faz login como owner deste workspace. Use o botão no header para iniciar — a sessão atual é trocada."
        actionLabel="Impersonar (no header)"
        icon={<UserCheck className="w-3.5 h-3.5" />}
        variant="info"
        onClick={() => undefined}
        disabled
      />
    </div>
  )
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  accent?: boolean
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: accent
          ? 'linear-gradient(135deg, var(--ur-accent-glow), transparent)'
          : 'var(--ur-bg-soft)',
        border: `1px solid ${accent ? 'var(--ur-accent-soft-2)' : 'var(--ur-border)'}`,
      }}
    >
      <div
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: accent ? 'var(--ur-accent)' : 'var(--ur-text-muted)' }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <p
        className="font-semibold tabular-nums tracking-tight"
        style={{ color: 'var(--ur-text)', fontSize: 22 }}
      >
        {value}
      </p>
    </div>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-xl p-5"
      style={{
        background: 'var(--ur-bg-soft)',
        border: '1px solid var(--ur-border)',
      }}
    >
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--ur-text)' }}>
          {title}
        </h3>
        {subtitle && (
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            {subtitle}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between py-1.5"
      style={{ borderBottom: '1px solid var(--ur-border)' }}
    >
      <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--ur-text-muted)' }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: 'var(--ur-text)' }}>
        {value}
      </span>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-[10px] uppercase tracking-wider font-semibold"
        style={{ color: 'var(--ur-text-muted)' }}
      >
        {label}
      </p>
      <p className="text-sm tabular-nums mt-0.5" style={{ color: 'var(--ur-text)' }}>
        {value}
      </p>
    </div>
  )
}

function Sep() {
  return (
    <span
      className="w-px h-8"
      style={{ background: 'var(--ur-border)' }}
      aria-hidden="true"
    />
  )
}

function DangerCard({
  title,
  description,
  actionLabel,
  icon,
  variant,
  onClick,
  disabled,
}: {
  title: string
  description: string
  actionLabel: string
  icon: React.ReactNode
  variant: 'danger' | 'warning' | 'neutral' | 'info'
  onClick: () => void
  disabled?: boolean
}) {
  const styles: Record<typeof variant, React.CSSProperties> = {
    danger: { background: 'var(--ur-danger-bg)', color: 'var(--ur-danger)', border: '1px solid var(--ur-danger)' },
    warning: { background: 'rgba(212, 168, 80, 0.1)', color: 'var(--ur-accent)', border: '1px solid var(--ur-accent-soft-2)' },
    neutral: { background: 'rgba(22, 163, 74, 0.1)', color: '#15803d', border: '1px solid rgba(22, 163, 74, 0.35)' },
    info: { background: 'var(--ur-surface-soft)', color: 'var(--ur-text-soft)', border: '1px solid var(--ur-border)' },
  }
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-4 flex-wrap"
      style={{
        background: 'var(--ur-bg-soft)',
        border: '1px solid var(--ur-border)',
      }}
    >
      <div className="flex-1 min-w-[240px]">
        <h3
          className="text-sm font-semibold tracking-tight mb-1"
          style={{ color: 'var(--ur-text)' }}
        >
          {title}
        </h3>
        <p className="text-xs" style={{ color: 'var(--ur-text-soft)' }}>
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={styles[variant]}
      >
        {icon}
        {actionLabel}
      </button>
    </div>
  )
}

// ─── Confirm-modal copy ──────────────────────────────────────────────────────

function confirmCopy(
  c:
    | { kind: 'suspend' }
    | { kind: 'unsuspend' }
    | { kind: 'soft_destroy' }
    | { kind: 'impersonate' }
    | { kind: 'switch_plan'; plan: SuperAdminPlan }
    | { kind: 'cancel_plan' },
  ws: SuperAdminWorkspaceDetail,
): {
  title: string
  subtitle: string
  confirmLabel: string
  variant: 'danger' | 'neutral'
  description: React.ReactNode
} {
  switch (c.kind) {
    case 'cancel_plan':
      return {
        title: 'Cancelar plano',
        subtitle: ws.name,
        confirmLabel: 'Cancelar plano',
        variant: 'danger',
        description:
          'Marca o workspace como cancelado (voluntary churn). Diferente de suspender — o painel segue acessível, mas todo gate de plano passa a bloquear até o cliente reassinar ou trocar de plano.',
      }
    case 'suspend':
      return {
        title: 'Suspender workspace',
        subtitle: ws.name,
        confirmLabel: 'Suspender',
        variant: 'danger',
        description:
          'O cliente perde acesso ao painel e ao widget imediatamente. Reviews já enviados continuam armazenados.',
      }
    case 'unsuspend':
      return {
        title: 'Reativar workspace',
        subtitle: ws.name,
        confirmLabel: 'Reativar',
        variant: 'neutral',
        description: 'O acesso é restaurado imediatamente. Widget e painel voltam a funcionar.',
      }
    case 'soft_destroy':
      return {
        title: 'Excluir workspace',
        subtitle: ws.name,
        confirmLabel: 'Excluir',
        variant: 'danger',
        description: (
          <>
            Marca o workspace para remoção. Os dados continuam no banco — pode ser revertido via SQL.
            <br />
            <strong style={{ color: 'var(--ur-danger)' }}>Reviews existentes: {ws.reviews_count}.</strong>
          </>
        ),
      }
    case 'impersonate':
      return {
        title: 'Impersonar workspace',
        subtitle: ws.name,
        confirmLabel: 'Impersonar',
        variant: 'neutral',
        description: 'Você será logado como o owner deste workspace. Para voltar, faça logout e login novamente.',
      }
    case 'switch_plan':
      return {
        title: `Trocar plano para ${c.plan}`,
        subtitle: ws.name,
        confirmLabel: 'Trocar plano',
        variant: 'neutral',
        description: `Plano atual: ${ws.plan_label}. O novo plano entra em vigor imediatamente. Cobrança via Stripe não é afetada por aqui.`,
      }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtInt(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n)
}
/**
 * Brazilian-real formatter for everything tenant-facing — MRR, billing
 * copy, etc. Anthropic-side AI cost continues to use the USD path below.
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
function fmtUsdPrecise(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

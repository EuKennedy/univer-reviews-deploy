'use client'

/**
 * Rewards — rules + grants
 *
 * Merchants define rules ("approved review with photo → R$10 coupon") and
 * the backend issues RewardGrants automatically when matching reviews land.
 * This page is the management surface: list rules, create new ones, browse
 * the issued-grants ledger.
 *
 * Backend: apps/api/app/controllers/api/v1/reward_rules_controller.rb
 *          apps/api/app/controllers/api/v1/reward_grants_controller.rb
 */

import { useId, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Gift,
  Plus,
  Loader2,
  Trash2,
  Power,
  Ticket,
  Coins,
  Wallet,
  Package,
  X,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { Toolbar, ActionButton } from '@/components/godmode/Toolbar'
import { Pagination } from '@/components/godmode/Pagination'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { formatNumber } from '@/lib/utils'
import type {
  RewardRule,
  RewardRulePayload,
  RewardType,
  RewardTriggerEvent,
} from '@/types'

type Tab = 'rules' | 'grants'

const REWARD_TYPE_META: Record<RewardType, { label: string; icon: React.ReactNode }> = {
  coupon:   { label: 'Cupom de desconto', icon: <Ticket   className="w-3.5 h-3.5" /> },
  points:   { label: 'Pontos',            icon: <Coins    className="w-3.5 h-3.5" /> },
  cashback: { label: 'Cashback',          icon: <Wallet   className="w-3.5 h-3.5" /> },
  gift:     { label: 'Brinde',            icon: <Package  className="w-3.5 h-3.5" /> },
}

const TRIGGER_LABEL: Record<RewardTriggerEvent, string> = {
  review_approved:   'Avaliação aprovada',
  review_with_photo: 'Avaliação com foto',
  review_with_video: 'Avaliação com vídeo',
  review_long:       'Avaliação longa (texto extenso)',
}

export default function RewardsPage() {
  const [tab, setTab] = useState<Tab>('rules')

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Gift className="w-5 h-5" />}
        title="Recompensas"
        subtitle="Crie regras que premiam clientes que deixam avaliações"
      />

      <div
        role="tablist"
        aria-label="Seções de recompensas"
        className="flex items-center gap-1 px-6 pt-3 shrink-0"
        style={{ borderBottom: '1px solid var(--ur-border)', background: 'var(--ur-bg-soft)' }}
      >
        <TabButton active={tab === 'rules'} onClick={() => setTab('rules')} label="Regras" />
        <TabButton active={tab === 'grants'} onClick={() => setTab('grants')} label="Concessões" />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'rules' ? <RulesTab /> : <GrantsTab />}
      </div>
    </div>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="px-3 py-2 text-xs font-medium transition-all"
      style={{
        color: active ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
        borderBottom: active ? '2px solid var(--ur-accent)' : '2px solid transparent',
        marginBottom: '-1px',
      }}
    >
      {label}
    </button>
  )
}

// ─── Rules tab ────────────────────────────────────────────────────────────────

function RulesTab() {
  const { getToken, isAuthenticated } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<RewardRule | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reward-rules'],
    queryFn: () => api.rewardRules.list({}, getToken()),
    enabled: isAuthenticated,
  })
  const items = data?.data ?? []

  const inv = () => qc.invalidateQueries({ queryKey: ['reward-rules'] })

  const createMut = useMutation({
    mutationFn: (payload: RewardRulePayload) => api.rewardRules.create(payload, getToken()),
    onSuccess: () => { toast.success('Regra criada'); setShowCreate(false); inv() },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao criar regra'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RewardRulePayload }) =>
      api.rewardRules.update(id, payload, getToken()),
    onSuccess: () => { toast.success('Regra atualizada'); setEditing(null); inv() },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Falha ao atualizar'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.rewardRules.delete(id, getToken()),
    onSuccess: () => { toast.success('Regra desativada'); inv() },
  })

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        left={
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            {items.length} regra(s)
          </span>
        }
        right={
          <ActionButton variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />
            Nova regra
          </ActionButton>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--ur-text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma regra de recompensa ativa"
            subtitle="Crie uma regra pra começar a premiar clientes que deixam avaliações com foto, vídeo, ou textos extensos."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((r) => (
              <RuleCard
                key={r.id}
                rule={r}
                onEdit={() => setEditing(r)}
                onDelete={() => {
                  if (window.confirm(`Desativar regra "${r.name}"?`)) deleteMut.mutate(r.id)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <RuleFormModal
          onClose={() => setShowCreate(false)}
          onSubmit={(p) => createMut.mutate(p)}
          isSubmitting={createMut.isPending}
        />
      )}

      {editing && (
        <RuleFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(p) => updateMut.mutate({ id: editing.id, payload: p })}
          isSubmitting={updateMut.isPending}
        />
      )}
    </div>
  )
}

function RuleCard({ rule, onEdit, onDelete }: { rule: RewardRule; onEdit: () => void; onDelete: () => void }) {
  const meta = REWARD_TYPE_META[rule.reward_type]
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--ur-text)' }}>
              {rule.name}
            </p>
            {rule.active ? (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: 'var(--ur-success-bg)', color: 'var(--ur-success)' }}
              >
                Ativa
              </span>
            ) : (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: 'var(--ur-surface-soft)', color: 'var(--ur-text-muted)' }}
              >
                Inativa
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--ur-text-muted)' }}>
            Gatilho: {TRIGGER_LABEL[rule.trigger_event] ?? rule.trigger_event}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Desativar regra"
          className="p-1 rounded"
          style={{ color: 'var(--ur-danger)' }}
        >
          <Power className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className="mt-3 flex items-center gap-2 text-xs px-2 py-1.5 rounded"
        style={{ background: 'var(--ur-accent-glow)', border: '1px solid var(--ur-accent-soft-2)', color: 'var(--ur-accent)' }}
      >
        {meta.icon}
        <span className="font-medium">{meta.label}</span>
        {rule.reward_amount != null && (
          <span style={{ color: 'var(--ur-accent)' }}>
            · {rule.reward_type === 'cashback' ? `${rule.reward_amount}%` : `${rule.reward_currency ?? 'BRL'} ${rule.reward_amount}`}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="w-full mt-3 py-1.5 text-xs font-medium rounded"
        style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text-soft)' }}
      >
        Editar
      </button>
    </div>
  )
}

// ─── Rule form ────────────────────────────────────────────────────────────────

function RuleFormModal({
  initial,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  initial?: RewardRule
  onClose: () => void
  onSubmit: (p: RewardRulePayload) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [trigger, setTrigger] = useState<RewardTriggerEvent>(initial?.trigger_event ?? 'review_approved')
  const [type, setType] = useState<RewardType>(initial?.reward_type ?? 'coupon')
  const [amount, setAmount] = useState<string>(initial?.reward_amount != null ? String(initial.reward_amount) : '')
  const [currency, setCurrency] = useState(initial?.reward_currency ?? 'BRL')
  const [couponTemplate, setCouponTemplate] = useState(initial?.coupon_template ?? 'REVIEW-{CODE}')
  const [requirePurchase, setRequirePurchase] = useState(initial?.require_purchase ?? false)
  const [minBodyLength, setMinBodyLength] = useState<string>(
    initial?.min_body_length != null ? String(initial.min_body_length) : '',
  )
  const [maxPerCustomer, setMaxPerCustomer] = useState<string>(
    initial?.max_per_customer_per_month != null ? String(initial.max_per_customer_per_month) : '',
  )

  const submit = () => {
    if (!name.trim()) { toast.error('Nome obrigatório'); return }
    if (type === 'gift') {
      // nothing — amount optional
    } else if (!amount.trim()) {
      toast.error('Valor obrigatório')
      return
    }
    onSubmit({
      name: name.trim(),
      active,
      trigger_event: trigger,
      reward_type: type,
      reward_amount: amount.trim() ? Number(amount) : null,
      reward_currency: type === 'cashback' ? null : currency || null,
      coupon_template: type === 'coupon' ? (couponTemplate || null) : null,
      require_purchase: requirePurchase,
      min_body_length: minBodyLength.trim() ? Number(minBodyLength) : null,
      max_per_customer_per_month: maxPerCustomer.trim() ? Number(maxPerCustomer) : null,
    })
  }

  return (
    <Modal title={initial ? 'Editar regra' : 'Nova regra de recompensa'} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Cupom 10% para review com foto"
            className="w-full text-sm rounded-lg p-2.5 outline-none"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
          />
        </Field>

        <Field label="Gatilho">
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as RewardTriggerEvent)}
            className="w-full text-sm rounded-lg p-2.5 outline-none"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
          >
            <option value="review_approved">Avaliação aprovada</option>
            <option value="review_with_photo">Avaliação com foto</option>
            <option value="review_with_video">Avaliação com vídeo</option>
            <option value="review_long">Avaliação longa</option>
          </select>
        </Field>

        <Field label="Tipo de recompensa">
          <div className="grid grid-cols-4 gap-2">
            {(['coupon', 'points', 'cashback', 'gift'] as RewardType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="px-2 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1"
                style={{
                  background: type === t ? 'var(--ur-accent-glow)' : 'var(--ur-bg)',
                  border: `1px solid ${type === t ? 'var(--ur-accent-soft-3)' : 'var(--ur-border)'}`,
                  color: type === t ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
                }}
              >
                {REWARD_TYPE_META[t].icon}
                {REWARD_TYPE_META[t].label.split(' ')[0]}
              </button>
            ))}
          </div>
        </Field>

        {type !== 'gift' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={type === 'cashback' ? 'Porcentagem (%)' : type === 'points' ? 'Pontos' : 'Valor (R$)'}>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step={type === 'cashback' ? 0.5 : 1}
                placeholder={type === 'cashback' ? '5' : '10'}
                className="w-full text-sm rounded-lg p-2.5 outline-none"
                style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
              />
            </Field>
            {type === 'coupon' && (
              <Field label="Moeda">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-sm rounded-lg p-2.5 outline-none"
                  style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
                >
                  <option value="BRL">BRL (R$)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </Field>
            )}
          </div>
        )}

        {type === 'coupon' && (
          <Field label="Template do cupom">
            <input
              value={couponTemplate}
              onChange={(e) => setCouponTemplate(e.target.value)}
              placeholder="REVIEW-{CODE}"
              className="w-full text-sm rounded-lg p-2.5 outline-none font-mono"
              style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--ur-text-muted)' }}>
              {'{CODE}'} é substituído por um hash único por cupom. Ex: <code>REVIEW-A1B2C3</code>
            </p>
          </Field>
        )}

        <div
          className="pt-3 mt-1"
          style={{ borderTop: '1px solid var(--ur-border)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ur-text-soft)' }}>
            Critérios adicionais (opcional)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mínimo de caracteres no review">
              <input
                type="number"
                value={minBodyLength}
                onChange={(e) => setMinBodyLength(e.target.value)}
                placeholder="100"
                min={0}
                className="w-full text-sm rounded-lg p-2.5 outline-none"
                style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
              />
            </Field>
            <Field label="Máx. por cliente / mês">
              <input
                type="number"
                value={maxPerCustomer}
                onChange={(e) => setMaxPerCustomer(e.target.value)}
                placeholder="1"
                min={0}
                className="w-full text-sm rounded-lg p-2.5 outline-none"
                style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer" style={{ color: 'var(--ur-text)' }}>
            <input
              type="checkbox"
              checked={requirePurchase}
              onChange={(e) => setRequirePurchase(e.target.checked)}
              className="accent-[var(--ur-accent)]"
            />
            Exigir compra verificada
          </label>

          <label className="flex items-center gap-2 mt-2 text-sm cursor-pointer" style={{ color: 'var(--ur-text)' }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="accent-[var(--ur-accent)]"
            />
            Regra ativa
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <ActionButton onClick={onClose}>Cancelar</ActionButton>
        <ActionButton variant="primary" onClick={submit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {initial ? 'Salvar' : 'Criar regra'}
        </ActionButton>
      </div>
    </Modal>
  )
}

// ─── Grants tab ───────────────────────────────────────────────────────────────

function GrantsTab() {
  const { getToken, isAuthenticated } = useAuth()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['reward-grants', page],
    queryFn: () => api.rewardGrants.list({ page, per_page: 25 }, getToken()),
    enabled: isAuthenticated,
  })

  const items = data?.data ?? []

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        left={
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            {data?.meta?.total_count ?? 0} concessões emitidas
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--ur-text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma recompensa emitida ainda"
            subtitle="Quando uma avaliação aprovada bater os critérios da sua regra ativa, ela aparece aqui."
          />
        ) : (
          <div className="px-4 py-3 space-y-2">
            {items.map((g) => <GrantRow key={g.id} grant={g} />)}
          </div>
        )}
      </div>

      {data && data.meta && data.meta.total_pages > 1 && (
        <Pagination
          currentPage={data.meta.current_page}
          totalPages={data.meta.total_pages}
          totalCount={data.meta.total_count}
          perPage={data.meta.per_page}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function GrantRow({ grant }: { grant: import('@/types').RewardGrant }) {
  const statusMeta: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
    issued:   { color: 'var(--ur-accent)',  bg: 'var(--ur-accent-glow)',  label: 'Emitido',  icon: <CheckCircle2 className="w-3 h-3" /> },
    redeemed: { color: 'var(--ur-success)', bg: 'var(--ur-success-bg)',   label: 'Resgatado', icon: <CheckCircle2 className="w-3 h-3" /> },
    revoked:  { color: 'var(--ur-danger)',  bg: 'var(--ur-danger-bg)',    label: 'Revogado', icon: <XCircle      className="w-3 h-3" /> },
    expired:  { color: 'var(--ur-text-muted)', bg: 'var(--ur-surface-soft)', label: 'Expirado', icon: <XCircle  className="w-3 h-3" /> },
  }
  const sm = statusMeta[grant.status] ?? statusMeta.issued
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg"
      style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--ur-text)' }}>
          {grant.customer_name || grant.customer_email || '—'}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
          {grant.coupon_code && (
            <code className="font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--ur-bg)', color: 'var(--ur-text-soft)' }}>
              {grant.coupon_code}
            </code>
          )}
          {grant.amount != null && (
            <span>{grant.currency ?? 'BRL'} {grant.amount}</span>
          )}
          <time>{new Date(grant.created_at).toLocaleDateString('pt-BR')}</time>
        </div>
      </div>
      <span
        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded"
        style={{ background: sm.bg, color: sm.color }}
      >
        {sm.icon}
        {sm.label}
      </span>
    </div>
  )
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5"
        style={{ color: 'var(--ur-text-soft)' }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
        style={{ background: 'var(--ur-accent-glow)', border: '1px solid var(--ur-accent-soft-2)' }}
      >
        <Gift className="w-5 h-5" style={{ color: 'var(--ur-accent)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>{title}</p>
      <p className="text-xs mt-1 max-w-md" style={{ color: 'var(--ur-text-muted)' }}>{subtitle}</p>
    </div>
  )
}

function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const titleId = useId()
  const dialogRef = useFocusTrap<HTMLDivElement>(true, onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--ur-overlay)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full rounded-xl p-5 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--ur-bg-soft)',
          border: '1px solid var(--ur-border)',
          maxWidth: wide ? 560 : 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="text-base font-semibold" style={{ color: 'var(--ur-text)' }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md"
            style={{ color: 'var(--ur-text-soft)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

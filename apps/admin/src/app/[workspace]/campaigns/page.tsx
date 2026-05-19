'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Pencil,
  Copy as CopyIcon,
  Trash2,
  Send,
  MoreHorizontal,
  Mail,
  Sparkles,
  Loader2,
  Clock,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { StatsBar } from '@/components/godmode/StatsBar'
import {
  Toolbar,
  SearchInput,
  FilterSelect,
  ActionButton,
} from '@/components/godmode/Toolbar'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type {
  Campaign,
  CampaignStatus,
  CampaignTriggerEvent,
} from '@/types'
import { formatNumber } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<CampaignTriggerEvent, string> = {
  order_completed: 'Concluído',
  order_delivered: 'Entregue',
  order_paid: 'Pago',
  order_refunded: 'Reembolsado',
}

const STATUS_OPTIONS: { label: string; value: CampaignStatus | '' }[] = [
  { label: 'Todas', value: '' },
  { label: 'Ativas', value: 'active' },
  { label: 'Pausadas', value: 'paused' },
  { label: 'Rascunhos', value: 'draft' },
  { label: 'Arquivadas', value: 'archived' },
]

function formatDelay(minutes: number): string {
  if (!minutes || minutes <= 0) return 'Envia imediatamente'
  if (minutes < 60) return `Envia ${minutes} min depois`
  if (minutes < 60 * 24) {
    const h = Math.round(minutes / 60)
    return `Envia ${h}h depois`
  }
  const d = Math.round(minutes / (60 * 24))
  return `Envia ${d} dia${d > 1 ? 's' : ''} depois`
}

function pct(num: number, den: number): string {
  if (!den) return '0%'
  return `${Math.round((num / den) * 100)}%`
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const params = useParams()
  const router = useRouter()
  const workspace = params?.workspace as string
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<CampaignStatus | ''>('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', workspace, page, status],
    queryFn: () =>
      api.campaigns.list(
        { page, per_page: 25, status: status || undefined },
        getToken(),
      ),
    enabled: isAuthenticated && Boolean(workspace),
  })

  const campaigns = data?.data ?? []
  const filtered = useMemo(() => {
    if (!search.trim()) return campaigns
    const q = search.toLowerCase()
    return campaigns.filter((c) => c.name.toLowerCase().includes(q))
  }, [campaigns, search])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['campaigns', workspace] })

  const pauseMut = useMutation({
    mutationFn: (id: string) => api.campaigns.pause(id, getToken()),
    onSuccess: () => {
      toast.success('Campanha pausada')
      void invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao pausar'),
  })

  const resumeMut = useMutation({
    mutationFn: (id: string) => api.campaigns.resume(id, getToken()),
    onSuccess: () => {
      toast.success('Campanha ativada')
      void invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao ativar'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.campaigns.remove(id, getToken()),
    onSuccess: () => {
      toast.success('Campanha excluída')
      void invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir'),
  })

  const duplicateMut = useMutation({
    mutationFn: async (c: Campaign) =>
      api.campaigns.create(
        {
          name: `${c.name} (cópia)`,
          status: 'draft',
          trigger_events: c.trigger_events,
          trigger_after_minutes: c.trigger_after_minutes,
          from_name: c.from_name,
          from_email: c.from_email,
          reply_to: c.reply_to,
          subject_template: c.subject_template,
          html_template: c.html_template,
        },
        getToken(),
      ),
    onSuccess: () => {
      toast.success('Campanha duplicada')
      void invalidate()
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao duplicar'),
  })

  const [testTarget, setTestTarget] = useState<Campaign | null>(null)

  // ── Aggregate stats (last 30 days approximation uses sent_count totals) ──
  const stats = useMemo(() => {
    const ativas = campaigns.filter((c) => c.status === 'active').length
    const totalSent = campaigns.reduce((s, c) => s + (c.sent_count ?? 0), 0)
    const totalOpen = campaigns.reduce((s, c) => s + (c.open_count ?? 0), 0)
    const totalReviews = campaigns.reduce((s, c) => s + (c.review_count ?? 0), 0)
    const openRate = totalSent ? Math.round((totalOpen / totalSent) * 100) : 0
    const convRate = totalSent ? Math.round((totalReviews / totalSent) * 100) : 0
    return [
      { label: 'Ativas', value: formatNumber(ativas) },
      { label: 'Enviados (total)', value: formatNumber(totalSent) },
      { label: 'Taxa de abertura', value: `${openRate}%` },
      { label: 'Taxa de conversão', value: `${convRate}%` },
    ]
  }, [campaigns])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Megaphone className="w-5 h-5" />}
        title="Campanhas"
        subtitle="Email automatizado pós-compra"
        actions={
          <ActionButton
            variant="primary"
            onClick={() => router.push(`/${workspace}/campaigns/new`)}
          >
            <Plus className="w-3.5 h-3.5" />
            Nova campanha
          </ActionButton>
        }
      />

      <StatsBar stats={stats} isLoading={isLoading} />

      <Toolbar
        left={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar campanhas…"
            />
            <FilterSelect
              value={status}
              onChange={(v) => {
                setStatus(v as CampaignStatus | '')
                setPage(1)
              }}
              options={STATUS_OPTIONS.filter((o) => o.value).map((o) => ({
                label: o.label,
                value: o.value as string,
              }))}
              placeholder="Todas"
            />
          </>
        }
        right={
          <span className="ur-meta">
            {filtered.length} {filtered.length === 1 ? 'campanha' : 'campanhas'}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div
            className="flex items-center justify-center py-20"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          campaigns.length === 0 ? (
            <EmptyState
              onCreate={() => router.push(`/${workspace}/campaigns/new`)}
            />
          ) : (
            <div className="text-center py-12 ur-body-soft">
              Nenhuma campanha corresponde aos filtros.
            </div>
          )
        ) : (
          <div className="grid gap-3 max-w-5xl">
            {filtered.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                onOpen={() => router.push(`/${workspace}/campaigns/${c.id}`)}
                onEdit={() => router.push(`/${workspace}/campaigns/${c.id}`)}
                onPause={() => pauseMut.mutate(c.id)}
                onResume={() => resumeMut.mutate(c.id)}
                onDuplicate={() => duplicateMut.mutate(c)}
                onDelete={() => {
                  if (confirm(`Excluir a campanha "${c.name}"?`)) {
                    deleteMut.mutate(c.id)
                  }
                }}
                onTestSend={() => setTestTarget(c)}
              />
            ))}
          </div>
        )}
      </div>

      {testTarget && (
        <TestSendModal
          campaign={testTarget}
          onClose={() => setTestTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Campaign card ───────────────────────────────────────────────────────────

function CampaignRow({
  campaign,
  onOpen,
  onEdit,
  onPause,
  onResume,
  onDuplicate,
  onDelete,
  onTestSend,
}: {
  campaign: Campaign
  onOpen: () => void
  onEdit: () => void
  onPause: () => void
  onResume: () => void
  onDuplicate: () => void
  onDelete: () => void
  onTestSend: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const sent = campaign.sent_count ?? 0
  const open = campaign.open_count ?? 0
  const click = campaign.click_count ?? 0
  const reviews = campaign.review_count ?? 0

  return (
    <div
      className="rounded-xl p-5 transition-all duration-150 group"
      style={{
        background: 'var(--ur-surface)',
        border: '1px solid var(--ur-border)',
        boxShadow: 'var(--ur-shadow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--ur-border)'
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <button
          onClick={onOpen}
          className="flex items-start gap-3 text-left min-w-0 flex-1"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'var(--ur-accent-soft)',
              border: '1px solid var(--ur-accent-soft-2)',
            }}
          >
            <Mail className="w-4 h-4" style={{ color: 'var(--ur-accent)' }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="ur-h3 truncate" style={{ color: 'var(--ur-text)' }}>
                {campaign.name}
              </h3>
              <StatusBadge status={campaign.status} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {(campaign.trigger_events ?? []).map((ev) => (
                <span
                  key={ev}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--ur-surface-soft)',
                    border: '1px solid var(--ur-border)',
                    color: 'var(--ur-text-soft)',
                  }}
                >
                  {TRIGGER_LABEL[ev]}
                </span>
              ))}
              <span
                className="flex items-center gap-1 ur-caption"
                style={{ color: 'var(--ur-text-muted)' }}
              >
                <Clock className="w-3 h-3" />
                {formatDelay(campaign.trigger_after_minutes ?? 0)}
              </span>
            </div>
          </div>
        </button>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--ur-text-soft)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--ur-surface-soft)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
            aria-label="Ações"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg overflow-hidden"
                style={{
                  background: 'var(--ur-surface)',
                  border: '1px solid var(--ur-border-strong)',
                  boxShadow: 'var(--ur-shadow-md)',
                }}
              >
                <MenuItem
                  icon={<Pencil className="w-3.5 h-3.5" />}
                  label="Editar"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit()
                  }}
                />
                <MenuItem
                  icon={<CopyIcon className="w-3.5 h-3.5" />}
                  label="Duplicar"
                  onClick={() => {
                    setMenuOpen(false)
                    onDuplicate()
                  }}
                />
                {campaign.status === 'active' ? (
                  <MenuItem
                    icon={<Pause className="w-3.5 h-3.5" />}
                    label="Pausar"
                    onClick={() => {
                      setMenuOpen(false)
                      onPause()
                    }}
                  />
                ) : (
                  <MenuItem
                    icon={<Play className="w-3.5 h-3.5" />}
                    label="Ativar"
                    onClick={() => {
                      setMenuOpen(false)
                      onResume()
                    }}
                  />
                )}
                <MenuItem
                  icon={<Send className="w-3.5 h-3.5" />}
                  label="Enviar teste"
                  onClick={() => {
                    setMenuOpen(false)
                    onTestSend()
                  }}
                />
                <MenuItem
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  label="Excluir"
                  tone="danger"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3"
        style={{ borderTop: '1px solid var(--ur-border-soft)' }}
      >
        <Stat label="Enviados" value={formatNumber(sent)} />
        <Stat label="Abertura" value={pct(open, sent)} />
        <Stat label="Cliques" value={pct(click, sent)} />
        <Stat label="Conversão" value={pct(reviews, sent)} highlight />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <p
        className="ur-h3 tabular-nums"
        style={{ color: highlight ? 'var(--ur-accent)' : 'var(--ur-text)' }}
      >
        {value}
      </p>
      <p className="ur-overline">{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const map: Record<
    CampaignStatus,
    { label: string; bg: string; color: string }
  > = {
    draft: {
      label: 'Rascunho',
      bg: 'var(--ur-surface-soft)',
      color: 'var(--ur-text-soft)',
    },
    active: {
      label: 'Ativa',
      bg: 'var(--ur-success-bg)',
      color: 'var(--ur-success)',
    },
    paused: {
      label: 'Pausada',
      bg: 'var(--ur-warn-bg)',
      color: 'var(--ur-warn)',
    },
    archived: {
      label: 'Arquivada',
      bg: 'var(--ur-surface-soft)',
      color: 'var(--ur-text-muted)',
    },
    completed: {
      label: 'Concluída',
      bg: 'var(--ur-accent-soft)',
      color: 'var(--ur-accent)',
    },
  }
  const s = map[status] ?? map.draft
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  const color = tone === 'danger' ? 'var(--ur-danger)' : 'var(--ur-text)'
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
      style={{ color }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--ur-surface-soft)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ color }}>{icon}</span>
      {label}
    </button>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative"
        style={{
          background:
            'linear-gradient(135deg, var(--ur-accent-soft-3), var(--ur-accent-glow))',
          border: '1px solid var(--ur-accent-soft-3)',
          boxShadow: '0 0 40px var(--ur-accent-glow)',
        }}
      >
        <Megaphone className="w-7 h-7" style={{ color: 'var(--ur-accent)' }} />
        <Sparkles
          className="w-3 h-3 absolute -top-1 -right-1"
          style={{ color: 'var(--ur-accent)' }}
        />
      </div>
      <h2 className="ur-h2 mb-1.5">Solicite avaliações no piloto automático</h2>
      <p
        className="ur-body-soft max-w-md mb-6"
        style={{ color: 'var(--ur-text-muted)' }}
      >
        Configure uma campanha para enviar emails personalizados depois que cada
        pedido é concluído — e veja sua taxa de avaliação subir sozinha.
      </p>
      <ActionButton variant="primary" onClick={onCreate}>
        <Plus className="w-3.5 h-3.5" />
        Criar primeira campanha
      </ActionButton>
    </div>
  )
}

// ─── Test send modal ────────────────────────────────────────────────────────

function TestSendModal({
  campaign,
  onClose,
}: {
  campaign: Campaign
  onClose: () => void
}) {
  const { getToken } = useAuth()
  const [email, setEmail] = useState('')

  const mut = useMutation({
    mutationFn: () =>
      api.campaigns.testSend(campaign.id, { recipient_email: email }, getToken()),
    onSuccess: () => {
      toast.success(`Email de teste enviado para ${email}`)
      onClose()
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 404) {
        toast.error('Endpoint de teste ainda não disponível')
      } else {
        toast.error(e instanceof Error ? e.message : 'Falha no envio de teste')
      }
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--ur-overlay)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl p-5"
        style={{
          background: 'var(--ur-surface)',
          border: '1px solid var(--ur-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="ur-h3">Enviar teste · {campaign.name}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md"
            style={{ color: 'var(--ur-text-soft)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="ur-body-soft mb-3">
          Envia uma cópia exata desta campanha para o email informado, com dados
          de exemplo nos placeholders.
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="w-full text-sm rounded-lg p-2.5 outline-none"
          style={{
            background: 'var(--ur-bg)',
            border: '1px solid var(--ur-border)',
            color: 'var(--ur-text)',
          }}
        />
        <div className="flex items-center justify-end gap-2 mt-4">
          <ActionButton onClick={onClose}>Cancelar</ActionButton>
          <ActionButton
            variant="primary"
            disabled={!email.includes('@') || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Send className="w-3.5 h-3.5" />
            Enviar teste
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import {
  Award,
  Camera,
  Video,
  ShieldCheck,
  Lock,
  Type,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/godmode/PageHeader'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export default function LoyaltyPage() {
  useParams()
  const { getToken } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-configs'],
    queryFn: () => api.loyalty.list(getToken()),
  })

  const configs = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Award className="w-5 h-5" />}
        title="Fidelidade por avaliação"
        subtitle="Campanhas sincronizadas do plugin Univer Loyalty"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Plugin connection banner */}
        <SyncStatusBanner
          connected={meta?.plugin_connected ?? false}
          lastSyncedAt={meta?.last_synced_at ?? null}
          loading={isLoading}
        />

        {/* Configs grid */}
        {isLoading ? (
          <div className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>
            Carregando…
          </div>
        ) : configs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {configs.map((c) => (
              <ConfigCard key={c.id} config={c} />
            ))}
          </div>
        )}

        {/* Help footer */}
        <div
          className="rounded-xl p-4 text-xs"
          style={{
            background: 'var(--ur-surface-soft)',
            border: '1px solid var(--ur-border-soft)',
            color: 'var(--ur-text-muted)',
          }}
        >
          <p>
            <strong style={{ color: 'var(--ur-text)' }}>Como funciona:</strong>{' '}
            esta página é somente leitura. Edite as regras diretamente no plugin
            Univer Loyalty (WordPress → Loyalty → Campanhas). Os pontos são
            creditados automaticamente quando a avaliação é aprovada.
          </p>
        </div>
      </div>
    </div>
  )
}

function SyncStatusBanner({
  connected,
  lastSyncedAt,
  loading,
}: {
  connected: boolean
  lastSyncedAt: string | null
  loading: boolean
}) {
  if (loading) return null

  if (!connected) {
    return (
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background: 'var(--ur-surface-soft)',
          border: '1px solid var(--ur-border-strong)',
        }}
      >
        <AlertCircle
          className="w-5 h-5 mt-0.5"
          style={{ color: 'var(--ur-text-muted)' }}
        />
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
            Plugin não conectado
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ur-text-muted)' }}>
            Instale o plugin Univer Loyalty no seu WordPress e crie uma campanha
            do tipo &quot;Avaliação&quot; para começar a creditar pontos.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: '#22c55e' }}
      />
      Plugin conectado{' '}
      {lastSyncedAt && (
        <span>
          · última sincronização há{' '}
          {formatDistanceToNow(new Date(lastSyncedAt), { locale: ptBR, addSuffix: false })}
        </span>
      )}
    </div>
  )
}

function ConfigCard({
  config,
}: {
  config: {
    id: string
    source_campaign_id: number
    name: string
    description: string | null
    is_active: boolean
    rule_type: string
    points_text: number
    points_photo: number
    points_video: number
    base_points: number
    min_chars: number
    only_logged_in: boolean
    bonus_photo: number
    bonus_video: number
    bonus_verified: number
    priority: number
  }
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--ur-surface)',
        border: '1px solid var(--ur-border-soft)',
        opacity: config.is_active ? 1 : 0.5,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--ur-text)' }}
          >
            {config.name || `Campanha #${config.source_campaign_id}`}
          </h3>
          {config.description && (
            <p
              className="text-xs mt-1 line-clamp-2"
              style={{ color: 'var(--ur-text-muted)' }}
            >
              {config.description}
            </p>
          )}
        </div>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide"
          style={{
            background: config.is_active ? 'var(--ur-accent-glow)' : 'var(--ur-surface-soft)',
            color: config.is_active ? 'var(--ur-accent)' : 'var(--ur-text-muted)',
            border: `1px solid ${
              config.is_active ? 'var(--ur-accent-soft-2)' : 'var(--ur-border-soft)'
            }`,
          }}
        >
          {config.is_active ? 'Ativa' : 'Inativa'}
        </span>
      </div>

      {/* Tier breakdown — three categorical brackets, video > photo > text */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <TierBox
          icon={<Type className="w-3.5 h-3.5" />}
          label="Texto"
          points={config.points_text}
        />
        <TierBox
          icon={<Camera className="w-3.5 h-3.5" />}
          label="Foto"
          points={config.points_photo}
        />
        <TierBox
          icon={<Video className="w-3.5 h-3.5" />}
          label="Vídeo"
          points={config.points_video}
        />
      </div>

      {/* Conditions */}
      <div className="space-y-2 mb-4">
        <RuleRow
          icon={<Type className="w-3.5 h-3.5" />}
          label={`Mínimo de ${config.min_chars} caracteres`}
        />
        {config.only_logged_in && (
          <RuleRow
            icon={<Lock className="w-3.5 h-3.5" />}
            label="Somente usuários logados"
          />
        )}
      </div>

      {/* Verified-purchase bonus (additive, orthogonal to tier) */}
      {config.bonus_verified > 0 && (
        <>
          <div
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            Bônus adicional
          </div>
          <div className="space-y-1.5">
            <BonusRow
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              label="Compra verificada"
              points={config.bonus_verified}
            />
          </div>
        </>
      )}
    </div>
  )
}

function TierBox({
  icon,
  label,
  points,
}: {
  icon: React.ReactNode
  label: string
  points: number
}) {
  return (
    <div
      className="rounded-lg p-3 text-center"
      style={{
        background: 'var(--ur-accent-glow)',
        border: '1px solid var(--ur-accent-soft-2)',
      }}
    >
      <div
        className="flex items-center justify-center gap-1 mb-1"
        style={{ color: 'var(--ur-text-muted)' }}
      >
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div
        className="text-xl font-bold"
        style={{ color: 'var(--ur-accent)' }}
      >
        {points}
      </div>
    </div>
  )
}

function RuleRow({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <div
      className="flex items-center gap-2 text-xs"
      style={{ color: 'var(--ur-text-muted)' }}
    >
      <span style={{ color: 'var(--ur-text-muted)' }}>{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function BonusRow({
  icon,
  label,
  points,
}: {
  icon: React.ReactNode
  label: string
  points: number
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span
        className="flex items-center gap-2"
        style={{ color: 'var(--ur-text-muted)' }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </span>
      <span className="font-semibold" style={{ color: 'var(--ur-accent)' }}>
        +{points}
      </span>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-xl p-12 text-center"
      style={{
        background: 'var(--ur-surface)',
        border: '1px dashed var(--ur-border-strong)',
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{
          background: 'var(--ur-accent-glow)',
          border: '1px solid var(--ur-accent-soft-2)',
        }}
      >
        <Award className="w-8 h-8" style={{ color: 'var(--ur-accent)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
        Nenhuma campanha sincronizada ainda
      </p>
      <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: 'var(--ur-text-muted)' }}>
        Crie uma campanha do tipo &quot;Avaliação&quot; no plugin Univer Loyalty
        (WordPress) para começar a creditar pontos automaticamente quando uma
        avaliação for aprovada.
      </p>
      <a
        href="https://univerbeauty.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs mt-4"
        style={{ color: 'var(--ur-accent)' }}
      >
        Saiba mais sobre o plugin
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}

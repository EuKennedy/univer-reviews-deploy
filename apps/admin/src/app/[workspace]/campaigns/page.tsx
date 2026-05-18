'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Megaphone, Plus, Mail, MessageSquare, Send } from 'lucide-react'
import { PageHeader } from '@/components/godmode/PageHeader'
import { StatsBar } from '@/components/godmode/StatsBar'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Campaign, CampaignStatus } from '@/types'

const statusConfig: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Rascunho', color: 'var(--ur-text-soft)', bg: 'var(--ur-neutral-bg)' },
  active: { label: 'Ativa', color: 'var(--ur-success)', bg: 'var(--ur-success-bg)' },
  paused: { label: 'Pausada', color: 'var(--ur-warn)', bg: 'var(--ur-warn-bg)' },
  completed: { label: 'Concluída', color: 'var(--ur-info)', bg: 'var(--ur-info-bg)' },
}

const typeIcons = {
  email: Mail,
  sms: MessageSquare,
  whatsapp: Send,
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const sc = statusConfig[campaign.status]
  const TypeIcon = typeIcons[campaign.type] ?? Mail

  return (
    <div
      className="rounded-xl p-5 transition-all duration-150 group"
      style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
      onMouseEnter={(e) => { e.currentTarget.style.border = '1px solid var(--ur-accent-soft-3)' }}
      onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid var(--ur-border)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--ur-surface-soft)', border: '1px solid var(--ur-border-strong)' }}
          >
            <TypeIcon className="w-4 h-4" style={{ color: 'var(--ur-text-soft)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
              {campaign.name}
            </h3>
            <p className="text-xs capitalize" style={{ color: 'var(--ur-text-muted)' }}>
              Campanha de {campaign.type}
            </p>
          </div>
        </div>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
          style={{ background: sc.bg, color: sc.color }}
        >
          {sc.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--ur-surface-soft)' }}>
        {[
          { label: 'Enviadas', value: formatNumber(campaign.sent_count) },
          { label: 'Aberturas', value: `${campaign.sent_count > 0 ? Math.round((campaign.open_count / campaign.sent_count) * 100) : 0}%` },
          { label: 'Cliques', value: `${campaign.sent_count > 0 ? Math.round((campaign.click_count / campaign.sent_count) * 100) : 0}%` },
          { label: 'Avaliações', value: formatNumber(campaign.review_count) },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-base font-bold" style={{ color: 'var(--ur-text)' }}>
              {value}
            </p>
            <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
        Criada em {format(new Date(campaign.created_at), "d 'de' MMM, yyyy", { locale: ptBR })}
      </p>
    </div>
  )
}

export default function CampaignsPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken } = useAuth()

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', workspace],
    queryFn: () => api.campaigns.list(getToken()),
  })

  const active = (campaigns ?? []).filter((c) => c.status === 'active').length
  const totalSent = (campaigns ?? []).reduce((s, c) => s + c.sent_count, 0)
  const totalReviews = (campaigns ?? []).reduce((s, c) => s + c.review_count, 0)

  const statsItems = [
    { label: 'Total de campanhas', value: formatNumber(campaigns?.length ?? 0) },
    { label: 'Ativas', value: formatNumber(active) },
    { label: 'Total enviado', value: formatNumber(totalSent) },
    { label: 'Avaliações geradas', value: formatNumber(totalReviews) },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Megaphone className="w-5 h-5" />}
        title="Campanhas"
        subtitle="Campanhas de coleta de avaliações por e-mail e SMS"
        actions={
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
              color: 'var(--ur-text-on-accent)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Nova campanha
          </button>
        }
      />

      <StatsBar stats={statsItems} isLoading={isLoading} />

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-40 rounded-xl" />
            ))}
          </div>
        ) : (campaigns ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <Megaphone className="w-12 h-12" style={{ color: 'var(--ur-border-strong)' }} />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
                Ainda não há campanhas
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ur-text-muted)' }}>
                Crie sua primeira campanha para começar a coletar avaliações
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {(campaigns ?? []).map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

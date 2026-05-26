'use client'

/**
 * Sumário de IA — listagem de produtos + status de geração
 *
 * Tela principal. Mostra cada produto com:
 *   - foto + título
 *   - avaliações aprovadas
 *   - status (gerado / pendente / processando / insuficiente)
 *   - última geração (relative time)
 * E expõe o botão "Gerar para todos" que enfileira o job pra todos os
 * produtos elegíveis (>=5 reviews aprovadas).
 *
 * Click numa linha → /ai-summaries/[productId] (página de edição).
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Sparkles,
  Loader2,
  Wand2,
  ChevronRight,
  Package,
  CheckCircle2,
  Clock,
  Ban,
  RefreshCw,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { Toolbar, SearchInput, ActionButton } from '@/components/godmode/Toolbar'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatNumber } from '@/lib/utils'
import type { AiSummaryProductRow } from '@/types'

type StatusKey = AiSummaryProductRow['status']

const STATUS_META: Record<StatusKey, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  generated:    { label: 'Gerado',       bg: 'var(--ur-success-bg)',  color: 'var(--ur-success)',    icon: <CheckCircle2 className="w-3 h-3" /> },
  pending:      { label: 'Pendente',     bg: 'var(--ur-accent-glow)', color: 'var(--ur-accent)',     icon: <Clock        className="w-3 h-3" /> },
  insufficient: { label: 'Sem reviews',  bg: 'var(--ur-surface-soft)', color: 'var(--ur-text-muted)', icon: <Ban         className="w-3 h-3" /> },
}

export default function AiSummariesIndexPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ai-summaries-index'],
    queryFn: () => api.ai.summariesIndex(getToken()).then(r => r.data),
    enabled: isAuthenticated,
    refetchInterval: 15000, // refresh every 15s so "Processando" → "Gerado" reflects
  })

  const bulkMut = useMutation({
    mutationFn: () => api.ai.generateSummaryTopicsBulk(undefined, getToken()),
    onSuccess: (r) => {
      toast.success(`Extração enfileirada para ${r.queued} produto(s).`)
      void queryClient.invalidateQueries({ queryKey: ['ai-summaries-index'] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao iniciar geração'),
  })

  const allRows = data ?? []
  const visible = search
    ? allRows.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
    : allRows

  const eligibleCount = allRows.filter(r => r.status !== 'insufficient').length

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Sparkles className="w-5 h-5" />}
        title="Sumário de IA"
        subtitle="Tópicos do que clientes estão falando — gerados por IA ou curados manualmente"
        actions={
          <ActionButton
            variant="primary"
            onClick={() => {
              if (window.confirm(`Gerar tópicos para ${eligibleCount} produtos elegíveis? Roda em background.`)) {
                bulkMut.mutate()
              }
            }}
            disabled={bulkMut.isPending || eligibleCount === 0}
          >
            {bulkMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Gerar para todos ({eligibleCount})
          </ActionButton>
        }
      />

      <Toolbar
        left={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar produto…"
          />
        }
        right={
          <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
            {allRows.length} produtos
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--ur-text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={search ? 'Nenhum produto bate com a busca' : 'Nenhum produto sincronizado'}
            subtitle={search ? 'Tente outra palavra.' : 'Sincronize sua loja em Integrações primeiro.'}
          />
        ) : (
          <div className="px-4 py-3 space-y-2">
            {visible.map(p => (
              <ProductRow key={p.id} workspace={workspace} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductRow({ workspace, product }: { workspace: string; product: AiSummaryProductRow }) {
  const sm = STATUS_META[product.status]
  return (
    <Link
      href={`/${workspace}/ai-summaries/${product.id}`}
      className="flex items-center gap-3 p-3 rounded-lg transition-colors"
      style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ur-border)' }}
    >
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
      ) : (
        <div
          className="w-10 h-10 rounded flex items-center justify-center shrink-0"
          style={{ background: 'var(--ur-surface-soft)' }}
        >
          <Package className="w-4 h-4" style={{ color: 'var(--ur-text-muted)' }} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--ur-text)' }}>
          {product.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
          <span>{formatNumber(product.approved_reviews)} aprovadas</span>
          {product.topic_count > 0 && (
            <span>{product.topic_count} tópicos</span>
          )}
          {product.last_generated_at && (
            <span>
              <RefreshCw className="w-2.5 h-2.5 inline mr-0.5" />
              {formatDistanceToNow(new Date(product.last_generated_at), { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </div>
      </div>

      <span
        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded shrink-0"
        style={{ background: sm.bg, color: sm.color }}
      >
        {sm.icon}
        {sm.label}
      </span>

      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--ur-text-muted)' }} />
    </Link>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
        style={{ background: 'var(--ur-accent-glow)', border: '1px solid var(--ur-accent-soft-2)' }}
      >
        <Sparkles className="w-5 h-5" style={{ color: 'var(--ur-accent)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>{title}</p>
      <p className="text-xs mt-1 max-w-md" style={{ color: 'var(--ur-text-muted)' }}>{subtitle}</p>
    </div>
  )
}

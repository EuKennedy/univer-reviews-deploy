'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Activity, ChevronDown, Filter, User, Globe, FileText, Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/godmode/PageHeader'
import { Pagination } from '@/components/godmode/Pagination'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

/**
 * Workspace audit log — quem fez o quê, quando.
 *
 * Plano Enterprise pode exportar; planos abaixo só visualizam. Filter
 * de action vem do endpoint /audit_logs/actions (distinct lista no
 * workspace).
 */
export default function AuditLogPage() {
  const { getToken, isAuthenticated } = useAuth()
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: actions } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: () => api.ai.auditActions(getToken()),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter],
    queryFn: () =>
      api.ai.auditLogs(
        {
          page,
          per_page: 30,
          action: actionFilter || undefined,
        },
        getToken(),
      ),
    enabled: isAuthenticated,
  })

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Activity className="w-5 h-5" />}
        title="Auditoria"
        subtitle="Todas as ações administrativas registradas neste workspace"
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Filter */}
          <div
            className="rounded-xl p-4 flex items-center gap-3 flex-wrap"
            style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
          >
            <Filter className="w-4 h-4" style={{ color: 'var(--ur-text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>Ação:</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                setPage(1)
              }}
              className="text-xs px-2 py-1.5 rounded-md outline-none"
              style={{
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text)',
              }}
            >
              <option value="">Todas ({actions?.length ?? 0})</option>
              {actions?.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* List */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
          >
            {isLoading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--ur-text-muted)' }} />
              </div>
            ) : (data?.data.length ?? 0) === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--ur-text-muted)' }}>
                Nenhuma ação registrada {actionFilter && `para "${actionFilter}"`}.
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--ur-border-soft)' }}>
                {data?.data.map((log) => {
                  const isOpen = expanded === log.id
                  return (
                    <li key={log.id}>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                        className="w-full text-left px-5 py-3 flex items-center gap-4 transition-colors"
                        style={{
                          background: isOpen ? 'var(--ur-bg-soft)' : 'transparent',
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                          style={{
                            background: 'var(--ur-accent-glow)',
                            color: 'var(--ur-accent)',
                          }}
                        >
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <code
                              className="text-xs font-semibold"
                              style={{ color: 'var(--ur-text)' }}
                            >
                              {log.action}
                            </code>
                            {log.entity_type && (
                              <span
                                className="text-[11px] px-1.5 py-0.5 rounded"
                                style={{
                                  background: 'var(--ur-bg)',
                                  color: 'var(--ur-text-muted)',
                                }}
                              >
                                {log.entity_type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--ur-text-muted)' }}>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.actor?.email || 'sistema'}
                            </span>
                            {log.ip_address && (
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {log.ip_address}
                              </span>
                            )}
                            <span>
                              {format(new Date(log.created_at), "d 'de' MMM, HH:mm:ss", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <ChevronDown
                          className="w-4 h-4 shrink-0 transition-transform"
                          style={{
                            color: 'var(--ur-text-muted)',
                            transform: isOpen ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      </button>

                      {isOpen && (
                        <div
                          className="px-5 pb-4"
                          style={{ background: 'var(--ur-bg-soft)' }}
                        >
                          <pre
                            className="text-[11px] font-mono p-3 rounded-md overflow-x-auto"
                            style={{
                              background: 'var(--ur-bg)',
                              border: '1px solid var(--ur-border-soft)',
                              color: 'var(--ur-text-soft)',
                              maxHeight: 300,
                            }}
                          >
{JSON.stringify(
  {
    entity: log.entity_type && log.entity_id ? { type: log.entity_type, id: log.entity_id } : null,
    metadata: log.metadata,
    user_agent: log.user_agent,
  },
  null,
  2,
)}
                          </pre>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {data?.meta && (
            <Pagination
              currentPage={data.meta.current_page}
              totalPages={data.meta.total_pages}
              totalCount={data.meta.total_count}
              perPage={data.meta.per_page}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>
    </div>
  )
}

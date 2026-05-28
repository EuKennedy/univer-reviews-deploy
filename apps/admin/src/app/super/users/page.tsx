'use client'

/**
 * Super admin — global user search.
 *
 * Searches Better Auth's `auth.user` table cross-tenant. Only the founder
 * (role='admin') can land here; the layout enforces that. Lets the
 * operator promote/demote between user/admin and see which workspaces
 * each identity belongs to.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users2,
  ShieldCheck,
  User,
  Loader2,
  Inbox,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { Toolbar, SearchInput } from '@/components/godmode/Toolbar'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { SuperAdminUser } from '@/types'

export default function SuperUsersPage() {
  const { getToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'users', search],
    queryFn: () => api.superAdmin.users.list({ q: search || undefined, per_page: 50 }, getToken()),
    enabled: isAuthenticated,
  })

  const users: SuperAdminUser[] = data?.data ?? []

  const setRoleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'user' }) =>
      api.superAdmin.users.setRole(id, role, getToken()),
    onSuccess: (_u, vars) => {
      toast.success(vars.role === 'admin' ? 'Promovido para admin' : 'Removido de admin')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Falha ao trocar role'),
  })

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Users2 className="w-5 h-5" />}
        title="Usuários"
        subtitle="Busca global na tabela de identidade (auth.user)"
      />

      <Toolbar
        left={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar email ou nome…"
          />
        }
        right={
          <span className="text-xs tabular-nums" style={{ color: 'var(--ur-text-muted)' }}>
            {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl"
                style={{ background: 'var(--ur-bg-soft)' }}
              />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <div className="space-y-2">
            {users.map((u, i) => (
              <UserRow
                key={u.id}
                user={u}
                index={i}
                onSetRole={(role) => setRoleMut.mutate({ id: u.id, role })}
                pending={setRoleMut.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserRow({
  user,
  index,
  onSetRole,
  pending,
}: {
  user: SuperAdminUser
  index: number
  onSetRole: (role: 'admin' | 'user') => void
  pending: boolean
}) {
  const isAdmin = user.role === 'admin'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4) }}
      className="rounded-xl p-4 flex items-center gap-4 flex-wrap"
      style={{
        background: 'var(--ur-bg-soft)',
        border: `1px solid ${isAdmin ? 'var(--ur-accent-soft-2)' : 'var(--ur-border)'}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: isAdmin ? 'var(--ur-accent)' : 'var(--ur-accent-soft-3)',
          color: isAdmin ? 'var(--ur-text-on-accent)' : 'var(--ur-accent)',
        }}
      >
        {(user.name || user.email)[0]?.toUpperCase()}
      </div>

      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
            {user.name || user.email}
          </span>
          {isAdmin && <RoleBadge>admin</RoleBadge>}
          {user.banned && <RoleBadge tone="danger">banido</RoleBadge>}
        </div>
        <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
          {user.email}
          {user.created_at && ` · criado em ${format(new Date(user.created_at), 'dd/MM/yyyy')}`}
        </p>
        {user.memberships.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {user.memberships.slice(0, 6).map((m, i) => (
              <span
                key={i}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--ur-surface-soft)',
                  color: 'var(--ur-text-soft)',
                }}
                title={`${m.workspace_name} (${m.role})`}
              >
                /{m.workspace_slug ?? '?'}
                <span style={{ color: 'var(--ur-text-muted)' }}> · {m.role}</span>
              </span>
            ))}
            {user.memberships.length > 6 && (
              <span className="text-[10px]" style={{ color: 'var(--ur-text-muted)' }}>
                +{user.memberships.length - 6}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSetRole(isAdmin ? 'user' : 'admin')}
        disabled={pending}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={
          isAdmin
            ? {
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text-soft)',
              }
            : {
                background:
                  'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
                border: 'none',
                color: 'var(--ur-text-on-accent)',
              }
        }
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isAdmin ? (
          <User className="w-3.5 h-3.5" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5" />
        )}
        {isAdmin ? 'Remover admin' : 'Tornar admin'}
      </button>
    </motion.div>
  )
}

function RoleBadge({
  children,
  tone = 'accent',
}: {
  children: React.ReactNode
  tone?: 'accent' | 'danger'
}) {
  const colors =
    tone === 'danger'
      ? {
          background: 'var(--ur-danger-bg)',
          color: 'var(--ur-danger)',
          border: '1px solid var(--ur-danger)',
        }
      : {
          background: 'var(--ur-accent-soft)',
          color: 'var(--ur-accent)',
          border: '1px solid var(--ur-accent-soft-2)',
        }
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={colors}
    >
      {children}
    </span>
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
        {search ? 'Ninguém com esse nome' : 'Nenhum usuário cadastrado'}
      </h3>
      <p className="text-sm max-w-sm" style={{ color: 'var(--ur-text-soft)' }}>
        {search
          ? 'Refaça a busca com email completo ou parte do nome.'
          : 'Quando alguém criar conta, vai aparecer aqui.'}
      </p>
    </div>
  )
}

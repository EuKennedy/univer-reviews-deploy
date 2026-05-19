'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import {
  Settings,
  Palette,
  Users,
  Key,
  Globe,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Send,
  Wand2,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/godmode/PageHeader'
import { AppearanceTab } from '@/components/settings/AppearanceTab'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Workspace, ApiKey, UserRole } from '@/types'

type Tab = 'general' | 'branding' | 'appearance' | 'team' | 'api-keys' | 'domains' | 'email'

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'Geral', icon: Settings },
  { id: 'branding', label: 'Marca', icon: Palette },
  { id: 'appearance', label: 'Aparência do Widget', icon: Wand2 },
  { id: 'team', label: 'Time', icon: Users },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'api-keys', label: 'Chaves de API', icon: Key },
  { id: 'domains', label: 'Domínios', icon: Globe },
]

const inputClass = 'w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all'
const inputStyle: React.CSSProperties = {
  background: 'var(--ur-bg-soft)',
  border: '1px solid var(--ur-surface-soft)',
  color: 'var(--ur-text)',
}
const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.border = '1px solid var(--ur-accent-soft-3)'
}
const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.border = '1px solid var(--ur-surface-soft)'
}

function GeneralTab({ workspace }: { workspace: Workspace }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      name: workspace.name,
      slug: workspace.slug,
      default_locale: workspace.default_locale,
      currency: workspace.currency,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: Partial<Workspace>) => api.workspace.update(data, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      toast.success('Configurações salvas')
    },
    onError: () => toast.error('Falha ao salvar'),
  })

  return (
    <div className="max-w-lg space-y-5 mx-4 sm:mx-0">
      {/* Identidade — Workspace ID copiável para integrações (plugin WP, API, etc) */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ur-text-muted)' }}>
          Identidade do workspace
        </h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="settings-workspace-id" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
              Workspace ID <span style={{ color: 'var(--ur-accent)' }}>(use no plugin WP)</span>
            </label>
            <div className="flex gap-2">
              <code
                id="settings-workspace-id"
                className="flex-1 px-3 py-2 rounded-lg text-xs font-mono select-all break-all"
                style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-surface-soft)', color: 'var(--ur-text)' }}
              >
                {workspace.id}
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(workspace.id)
                  toast.success('Workspace ID copiado')
                }}
                aria-label="Copiar Workspace ID"
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all min-h-[40px] sm:min-h-0"
                style={{ background: 'var(--ur-accent-soft)', border: '1px solid var(--ur-accent-soft-3)', color: 'var(--ur-accent)' }}
              >
                Copiar
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="settings-api-url" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
              URL da API
            </label>
            <div className="flex gap-2">
              <code
                id="settings-api-url"
                className="flex-1 px-3 py-2 rounded-lg text-xs font-mono select-all"
                style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-surface-soft)', color: 'var(--ur-text)' }}
              >
                https://api.univerreviews.com
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText('https://api.univerreviews.com')
                  toast.success('URL copiada')
                }}
                aria-label="Copiar URL da API"
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all min-h-[40px] sm:min-h-0"
                style={{ background: 'var(--ur-accent-soft)', border: '1px solid var(--ur-accent-soft-3)', color: 'var(--ur-accent)' }}
              >
                Copiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      {[
        { label: 'Nome do workspace', key: 'name', placeholder: 'Minha Loja' },
        { label: 'Slug', key: 'slug', placeholder: 'minha-loja' },
        { label: 'Idioma padrão', key: 'default_locale', placeholder: 'pt-BR' },
        { label: 'Moeda', key: 'currency', placeholder: 'BRL' },
      ].map(({ label, key, placeholder }) => {
        const inputId = `settings-general-${key}`
        return (
          <div key={key}>
            <label htmlFor={inputId} className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
              {label}
            </label>
            <input
              id={inputId}
              {...register(key as 'name' | 'slug' | 'default_locale' | 'currency')}
              placeholder={placeholder}
              className={inputClass}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
          </div>
        )
      })}

      <button
        type="submit"
        disabled={!isDirty || mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
        style={{ background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))', color: 'var(--ur-text-on-accent)' }}
      >
        {mutation.isPending && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span className="sr-only" role="status">Salvando…</span>
          </>
        )}
        Salvar alterações
      </button>
      </form>
    </div>
  )
}

function BrandingTab({ workspace }: { workspace: Workspace }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [brandColor, setBrandColor] = useState(workspace.branding?.brand_color ?? 'var(--ur-accent)')
  const [ratingIcon, setRatingIcon] = useState<'star' | 'heart' | 'flame' | 'thumb' | 'diamond'>(workspace.branding?.rating_icon ?? 'star')
  const [brandVoice, setBrandVoice] = useState(workspace.branding?.brand_voice ?? '')

  const mutation = useMutation({
    mutationFn: (data: Partial<Workspace>) => api.workspace.update(data, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      toast.success('Marca salva')
    },
    onError: () => toast.error('Falha ao salvar'),
  })

  const icons = [
    { id: 'star', label: '⭐' },
    { id: 'heart', label: '❤️' },
    { id: 'flame', label: '🔥' },
    { id: 'thumb', label: '👍' },
    { id: 'diamond', label: '💎' },
  ]

  return (
    <div className="max-w-lg space-y-6 mx-4 sm:mx-0">
      <div>
        <label htmlFor="branding-color-picker" className="block text-xs font-medium mb-2" style={{ color: 'var(--ur-text-muted)' }}>
          Cor da marca
        </label>
        <div className="flex items-center gap-3">
          <input
            id="branding-color-picker"
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            aria-label="Selecionar cor da marca"
            className="w-12 h-10 rounded-lg cursor-pointer"
            style={{ background: 'none', border: '1px solid var(--ur-surface-soft)', padding: '2px' }}
          />
          <input
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            placeholder="var(--ur-accent)"
            aria-label="Valor hexadecimal da cor da marca"
            className={inputClass}
            style={{ ...inputStyle, flex: 1 }}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </div>
        <div
          aria-hidden="true"
          className="mt-2 h-2 rounded-full"
          style={{ background: brandColor, opacity: 0.8 }}
        />
      </div>

      <div role="radiogroup" aria-label="Ícone da nota">
        <span className="block text-xs font-medium mb-2" style={{ color: 'var(--ur-text-muted)' }}>
          Ícone da nota
        </span>
        <div className="flex gap-2">
          {icons.map((icon) => {
            const selected = ratingIcon === icon.id
            return (
              <button
                key={icon.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Ícone ${icon.id}`}
                onClick={() => setRatingIcon(icon.id as 'star' | 'heart' | 'flame' | 'thumb' | 'diamond')}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all"
                style={{
                  background: selected ? 'var(--ur-accent-soft)' : 'var(--ur-bg-soft)',
                  border: `2px solid ${selected ? 'var(--ur-accent)' : 'var(--ur-surface-soft)'}`,
                }}
              >
                <span aria-hidden="true">{icon.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label htmlFor="branding-brand-voice" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
          Tom de marca
        </label>
        <p id="branding-brand-voice-help" className="text-xs mb-2" style={{ color: 'var(--ur-text-faint)' }}>
          Descreva o tom de voz da sua marca para respostas geradas por IA.
        </p>
        <textarea
          id="branding-brand-voice"
          aria-describedby="branding-brand-voice-help"
          value={brandVoice}
          onChange={(e) => setBrandVoice(e.target.value)}
          rows={4}
          placeholder="Somos uma marca amigável e profissional que valoriza a honestidade…"
          className={inputClass + ' resize-none'}
          style={inputStyle}
          onFocus={inputFocus}
          onBlur={inputBlur}
        />
      </div>

      <button
        type="button"
        onClick={() =>
          mutation.mutate({
            branding: {
              brand_color: brandColor,
              rating_icon: ratingIcon as Workspace['branding']['rating_icon'],
              brand_voice: brandVoice,
              logo_url: workspace.branding?.logo_url ?? null,
            },
          })
        }
        disabled={mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
        style={{ background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))', color: 'var(--ur-text-on-accent)' }}
      >
        {mutation.isPending && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span className="sr-only" role="status">Salvando…</span>
          </>
        )}
        Salvar marca
      </button>
    </div>
  )
}

function TeamTab({ workspace }: { workspace: Workspace }) {
  const { getToken } = useAuth()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('moderator')

  const mutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      api.workspace.inviteUser(email, role, getToken()),
    onSuccess: () => {
      toast.success('Convite enviado')
      setInviteEmail('')
    },
    onError: () => toast.error('Falha ao convidar'),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.workspace.removeUser(userId, getToken()),
    onSuccess: () => toast.success('Usuário removido'),
    onError: () => toast.error('Falha ao remover usuário'),
  })

  const roleColors: Record<UserRole, string> = {
    owner: 'var(--ur-accent)',
    admin: '#a78bfa',
    moderator: 'var(--ur-info)',
    viewer: 'var(--ur-text-muted)',
  }

  return (
    <div className="max-w-lg space-y-5 mx-4 sm:mx-0">
      {/* Current members */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--ur-border)' }}
      >
        <div
          className="px-4 py-3"
          style={{ background: 'var(--ur-bg-soft)', borderBottom: '1px solid var(--ur-surface-soft)' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ur-text-muted)' }}>
            Membros ({workspace.users?.length ?? 0})
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--ur-surface-soft)' }}>
          {workspace.users?.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: 'var(--ur-surface)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'var(--ur-accent-soft)', color: 'var(--ur-accent)' }}
              >
                {user.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--ur-text)' }}>
                  {user.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--ur-text-muted)' }}>
                  {user.email}
                </p>
              </div>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: `${roleColors[user.role]}15`,
                  color: roleColors[user.role],
                }}
              >
                {({ owner: 'Proprietário', admin: 'Admin', moderator: 'Moderador', viewer: 'Visualizador' } as Record<UserRole, string>)[user.role]}
              </span>
              {user.role !== 'owner' && (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(user.id)}
                  aria-label={`Remover ${user.name} do workspace`}
                  title={`Remover ${user.name}`}
                  className="p-1 rounded transition-colors ml-1"
                  style={{ color: 'var(--ur-text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ur-danger)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ur-text-muted)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invite */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
      >
        <h3 id="settings-invite-heading" className="text-sm font-semibold mb-3" style={{ color: 'var(--ur-text)' }}>
          Convidar membro do time
        </h3>
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <label htmlFor="settings-invite-email" className="sr-only">
              Email do convidado
            </label>
            <input
              id="settings-invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colega@empresa.com"
              className={inputClass}
              style={{ ...inputStyle }}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
          </div>
          <label htmlFor="settings-invite-role" className="sr-only">
            Papel do convidado
          </label>
          <select
            id="settings-invite-role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as UserRole)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={inputStyle}
          >
            {([
              { value: 'admin' as UserRole, label: 'Admin' },
              { value: 'moderator' as UserRole, label: 'Moderador' },
              { value: 'viewer' as UserRole, label: 'Visualizador' },
            ]).map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => mutation.mutate({ email: inviteEmail, role: inviteRole })}
          disabled={!inviteEmail.trim() || mutation.isPending}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
          style={{ background: 'var(--ur-accent-soft)', border: '1px solid var(--ur-accent-soft-3)', color: 'var(--ur-accent)' }}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Enviar convite
        </button>
      </div>
    </div>
  )
}

function ApiKeysTab() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [newKeyName, setNewKeyName] = useState('')
  const [showKey, setShowKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const { data: apiKeysResp, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.workspace.listApiKeys(getToken()),
  })
  const apiKeys: ApiKey[] = apiKeysResp?.data ?? []

  // AI provider (Anthropic) health — drives the "Configurar Claude" card.
  // This card is read-only because the key is env-scoped at the server
  // level today; we show status, the model versions in use, and a copyable
  // setup snippet so ops know exactly what to edit.
  const { data: aiHealth } = useQuery({
    queryKey: ['ai-health'],
    queryFn: () => api.ai.health(getToken()),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.workspace.createApiKey(name, getToken()),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setNewKeyName('')
      // Show the raw key exactly once — backend never returns it again.
      if (resp?.key) {
        setShowKey(resp.key)
      }
      toast.success('Chave criada — copie agora, não será mostrada de novo')
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao criar chave de API'
      const issues = (err as { issues?: string[] })?.issues
      toast.error(issues?.length ? `${msg}: ${issues.join(', ')}` : msg)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.workspace.revokeApiKey(keyId, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('Chave de API revogada')
    },
    onError: () => toast.error('Falha ao revogar chave'),
  })

  const aiOk = aiHealth?.configured ?? false
  const aiReason = aiHealth?.reason ?? ''

  return (
    <div className="max-w-lg space-y-5 mx-4 sm:mx-0" id="api-keys">
      {/* Anthropic / Claude provider status — server-side env var, read-only. */}
      <div
        className="rounded-xl p-4"
        style={{
          background: aiOk ? 'var(--ur-surface)' : 'var(--ur-danger-bg)',
          border: `1px solid ${aiOk ? 'var(--ur-border)' : 'var(--ur-danger-bg)'}`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: aiOk ? 'var(--ur-success-bg)' : 'var(--ur-danger-bg)',
              border: `1px solid ${aiOk ? 'var(--ur-success-bg)' : 'var(--ur-danger-bg)'}`,
            }}
          >
            <Key
              className="w-4 h-4"
              style={{ color: aiOk ? 'var(--ur-success)' : 'var(--ur-danger)' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
                Anthropic Claude
              </h3>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: aiOk ? 'var(--ur-success-bg)' : 'var(--ur-danger-bg)',
                  color: aiOk ? 'var(--ur-success)' : 'var(--ur-danger)',
                  border: `1px solid ${aiOk ? 'var(--ur-success-bg)' : 'var(--ur-danger-bg)'}`,
                }}
              >
                {aiOk ? 'Configurada' : aiReason === 'placeholder' ? 'Placeholder' : 'Faltando'}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--ur-text-soft)' }}>
              Provedor de IA usado pelo Lab de IA, moderação automática e
              respostas geradas. A chave é lida do servidor — para alterá-la,
              edite <code style={{ color: 'var(--ur-accent)' }}>ANTHROPIC_API_KEY</code>{' '}
              no <code style={{ color: 'var(--ur-accent)' }}>apps/api/.env</code> e reinicie a API.
            </p>
            {aiHealth && (
              <div className="flex flex-wrap gap-3 mt-2.5 text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                <span>
                  Sonnet:{' '}
                  <code style={{ color: 'var(--ur-text)' }}>{aiHealth.models.sonnet}</code>
                </span>
                <span>
                  Haiku:{' '}
                  <code style={{ color: 'var(--ur-text)' }}>{aiHealth.models.haiku}</code>
                </span>
              </div>
            )}
            {!aiOk && (
              <div
                className="mt-3 p-2 rounded font-mono text-xs"
                style={{
                  background: 'var(--ur-bg)',
                  border: '1px solid var(--ur-surface-soft)',
                  color: 'var(--ur-accent)',
                }}
              >
                ANTHROPIC_API_KEY=sk-ant-…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create key */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ur-text)' }}>
          Criar chave de API
        </h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="settings-api-key-name" className="sr-only">
              Nome da nova chave de API
            </label>
            <input
              id="settings-api-key-name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Nome da chave (ex.: Produção)"
              className={inputClass}
              style={{ ...inputStyle }}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
          </div>
          <button
            type="button"
            onClick={() => createMutation.mutate(newKeyName)}
            disabled={!newKeyName.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all whitespace-nowrap"
            style={{ background: 'var(--ur-accent-soft)', border: '1px solid var(--ur-accent-soft-3)', color: 'var(--ur-accent)' }}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Criar
          </button>
        </div>
      </div>

      {/* One-time key reveal */}
      {showKey && (
        <div
          className="rounded-xl p-4"
          style={{
            background: 'var(--ur-accent-glow)',
            border: '1px solid var(--ur-accent-soft-3)',
          }}
        >
          <div className="flex items-start gap-3">
            <Key className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--ur-accent)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ur-accent)' }}>
                Copie agora — esta chave não será mostrada de novo
              </p>
              <code
                className="block text-xs font-mono break-all p-2 rounded mt-2"
                style={{ background: 'var(--ur-bg)', color: 'var(--ur-text)', border: '1px solid var(--ur-surface-soft)' }}
              >
                {showKey}
              </code>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(showKey)
                    toast.success('Chave copiada')
                  }}
                  aria-label="Copiar chave de API recém-criada"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
                  style={{ background: 'var(--ur-accent)', color: 'var(--ur-text-on-accent)' }}
                >
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={() => setShowKey(null)}
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ background: 'var(--ur-surface-soft)', color: 'var(--ur-text-soft)', border: '1px solid var(--ur-border-strong)' }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--ur-border)' }}
      >
        <div
          className="px-4 py-3"
          style={{ background: 'var(--ur-bg-soft)', borderBottom: '1px solid var(--ur-surface-soft)' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ur-text-muted)' }}>
            Chaves ativas
          </h3>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : !apiKeys?.length ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>Ainda não há chaves de API</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--ur-surface-soft)' }}>
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ background: 'var(--ur-surface)' }}
              >
                <Key className="w-4 h-4 shrink-0" style={{ color: 'var(--ur-text-muted)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
                    {key.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono" style={{ color: 'var(--ur-text-soft)' }}>
                      {key.prefix}••••••••
                    </code>
                    <span className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                      Criada em {format(new Date(key.created_at), "d 'de' MMM, yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(key.prefix)
                    setCopiedKey(key.id)
                    setTimeout(() => setCopiedKey(null), 2000)
                  }}
                  aria-label={copiedKey === key.id ? `Chave ${key.name} copiada` : `Copiar prefixo da chave ${key.name}`}
                  title="Copiar prefixo"
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--ur-text-muted)' }}
                >
                  {copiedKey === key.id ? (
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ur-success)' }} aria-hidden="true" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Revogar esta chave de API?')) revokeMutation.mutate(key.id)
                  }}
                  aria-label={`Revogar chave ${key.name}`}
                  title="Revogar chave"
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--ur-text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ur-danger)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ur-text-muted)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DomainsTab({ workspace }: { workspace: Workspace }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [newDomain, setNewDomain] = useState('')

  const addMutation = useMutation({
    mutationFn: (domain: string) => api.workspace.addDomain(domain, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      setNewDomain('')
      toast.success('Domínio adicionado')
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao adicionar domínio'
      const issues = (err as { issues?: string[] })?.issues
      toast.error(issues?.length ? `${msg}: ${issues.join(', ')}` : msg)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (idOrDomain: string) => api.workspace.removeDomain(idOrDomain, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      toast.success('Domínio removido')
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao remover domínio'
      toast.error(msg)
    },
  })

  return (
    <div className="max-w-lg space-y-5 mx-4 sm:mx-0">
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
          Domínios autorizados
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--ur-text-muted)' }}>
          Domínios em que o widget de avaliações pode ser incorporado.
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="settings-domain-input" className="sr-only">
              Novo domínio autorizado
            </label>
            <input
              id="settings-domain-input"
              type="url"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="https://sualoja.com"
              className={inputClass}
              style={{ ...inputStyle }}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
          </div>
          <button
            type="button"
            onClick={() => addMutation.mutate(newDomain)}
            disabled={!newDomain.trim() || addMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--ur-accent-soft)', border: '1px solid var(--ur-accent-soft-3)', color: 'var(--ur-accent)' }}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Adicionar
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {(workspace.domains ?? []).map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
          >
            <Globe className="w-4 h-4 shrink-0" style={{ color: 'var(--ur-text-muted)' }} aria-hidden="true" />
            <span className="flex-1 text-sm font-mono" style={{ color: 'var(--ur-text)' }}>
              {d.domain}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: d.verified ? 'var(--ur-success-bg)' : 'var(--ur-accent-soft)',
                color: d.verified ? 'var(--ur-success)' : 'var(--ur-accent)',
                border: `1px solid ${d.verified ? 'var(--ur-success-bg)' : 'var(--ur-accent-soft-3)'}`,
              }}
            >
              {d.verified ? 'Verificado' : 'Pendente'}
            </span>
            <button
              type="button"
              onClick={() => removeMutation.mutate(d.id)}
              aria-label={`Remover domínio ${d.domain}`}
              title="Remover domínio"
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--ur-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ur-danger)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ur-text-muted)' }}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}

        {(!workspace.domains || workspace.domains.length === 0) && (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>
              Nenhum domínio adicionado ainda
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Email tab ──────────────────────────────────────────────────────────────

function EmailTab({ workspace }: { workspace: Workspace }) {
  const { getToken } = useAuth()
  const [replyTo, setReplyTo] = useState('suporte@univerreviews.com')
  const [testEmail, setTestEmail] = useState('')

  const testMut = useMutation({
    mutationFn: () => api.email.testSend(testEmail, getToken()),
    onSuccess: () => toast.success(`Email de teste enviado para ${testEmail}`),
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 404) {
        toast.error('Endpoint de teste ainda não disponível')
      } else {
        toast.error(e instanceof Error ? e.message : 'Falha no envio de teste')
      }
    },
  })

  return (
    <div className="max-w-2xl space-y-4 mx-4 sm:mx-0">
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
          Domínio de envio
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--ur-text-muted)' }}>
          Todas as suas campanhas enviam via UniverReviews. White-label
          personalizado em breve.
        </p>
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-lg"
          style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}
        >
          <code className="text-sm font-mono flex-1" style={{ color: 'var(--ur-text)' }}>
            univerreviews.com
          </code>
          <span
            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--ur-success-bg)',
              color: 'var(--ur-success)',
            }}
          >
            <CheckCircle2 className="w-3 h-3" />
            Verificado
          </span>
        </div>
      </div>

      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
          From padrão
        </h3>
        <p
          className="text-xs mb-3"
          style={{ color: 'var(--ur-text-muted)' }}
          title="From name resolve para o nome do seu workspace."
        >
          From name resolve para o nome do seu workspace.
        </p>
        <code
          className="block text-sm font-mono px-3 py-2 rounded-lg"
          style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
        >
          {workspace.name} &lt;noreply@univerreviews.com&gt;
        </code>
      </div>

      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
      >
        <label htmlFor="settings-reply-to" className="text-sm font-semibold mb-1 block" style={{ color: 'var(--ur-text)' }}>
          Reply-to padrão
        </label>
        <p id="settings-reply-to-help" className="text-xs mb-3" style={{ color: 'var(--ur-text-muted)' }}>
          Endereço para onde as respostas dos clientes serão direcionadas.
        </p>
        <input
          id="settings-reply-to"
          type="email"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="suporte@suaempresa.com"
          aria-describedby="settings-reply-to-help"
          className={inputClass + ' font-mono'}
          style={inputStyle}
          onFocus={inputFocus}
          onBlur={inputBlur}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--ur-text-faint)' }}>
          Salvar reply-to global em breve — por enquanto cada campanha define o seu.
        </p>
      </div>

      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
          Envio de teste
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--ur-text-muted)' }}>
          Confirme que o seu provedor está aceitando emails de univerreviews.com.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label htmlFor="settings-test-email" className="sr-only">
              Email de destino para o teste
            </label>
            <input
              id="settings-test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="seu@email.com"
              className={inputClass}
              style={{ ...inputStyle }}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
          </div>
          <button
            type="button"
            onClick={() => testMut.mutate()}
            disabled={!testEmail.includes('@') || testMut.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
              color: 'var(--ur-text-on-accent)',
            }}
          >
            {testMut.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span className="sr-only" role="status">Enviando teste…</span>
              </>
            ) : (
              <Send className="w-4 h-4" aria-hidden="true" />
            )}
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('general')

  // Deep-link support: /settings#api-keys (used by the AI Lab "Configurar"
  // banner) lands directly on the API keys tab.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace('#', '')
    const validTabs: Tab[] = ['general', 'branding', 'appearance', 'team', 'email', 'api-keys', 'domains']
    if (hash && (validTabs as string[]).includes(hash)) {
      setActiveTab(hash as Tab)
    }
  }, [])

  const { data: workspaceData, isLoading } = useQuery<Workspace>({
    queryKey: ['workspace', workspace],
    queryFn: () => api.workspace.get(getToken()),
  })

  if (isLoading || !workspaceData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--ur-accent)' }} />
      </div>
    )
  }

  const tabContent: Record<Tab, React.ReactNode> = {
    general: <GeneralTab workspace={workspaceData} />,
    branding: <BrandingTab workspace={workspaceData} />,
    appearance: <AppearanceTab workspace={workspaceData} />,
    team: <TeamTab workspace={workspaceData} />,
    email: <EmailTab workspace={workspaceData} />,
    'api-keys': <ApiKeysTab />,
    domains: <DomainsTab workspace={workspaceData} />,
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Settings className="w-5 h-5" />}
        title="Configurações"
        subtitle="Gerencie a configuração do seu workspace"
      />

      <div
        role="tablist"
        aria-label="Seções de configurações"
        className="flex items-center gap-1 px-5 py-3 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--ur-border)' }}
        onKeyDown={(e) => {
          const idx = tabs.findIndex((t) => t.id === activeTab)
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            const next = tabs[(idx + 1) % tabs.length]
            setActiveTab(next.id)
            document.getElementById(`settings-tab-${next.id}`)?.focus()
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            const prev = tabs[(idx - 1 + tabs.length) % tabs.length]
            setActiveTab(prev.id)
            document.getElementById(`settings-tab-${prev.id}`)?.focus()
          } else if (e.key === 'Home') {
            e.preventDefault()
            setActiveTab(tabs[0].id)
            document.getElementById(`settings-tab-${tabs[0].id}`)?.focus()
          } else if (e.key === 'End') {
            e.preventDefault()
            const last = tabs[tabs.length - 1]
            setActiveTab(last.id)
            document.getElementById(`settings-tab-${last.id}`)?.focus()
          }
        }}
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: selected ? 'var(--ur-accent-soft)' : 'transparent',
                border: `1px solid ${selected ? 'var(--ur-accent-soft-3)' : 'transparent'}`,
                color: selected ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
              }}
            >
              <tab.icon className="w-3.5 h-3.5" aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            id={`settings-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${activeTab}`}
            tabIndex={0}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tabContent[activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

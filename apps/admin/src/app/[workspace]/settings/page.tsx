'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/godmode/PageHeader'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Workspace, ApiKey, UserRole } from '@/types'

type Tab = 'general' | 'branding' | 'team' | 'api-keys' | 'domains'

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'Geral', icon: Settings },
  { id: 'branding', label: 'Marca', icon: Palette },
  { id: 'team', label: 'Time', icon: Users },
  { id: 'api-keys', label: 'Chaves de API', icon: Key },
  { id: 'domains', label: 'Domínios', icon: Globe },
]

const inputClass = 'w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all'
const inputStyle: React.CSSProperties = {
  background: '#0d0d0f',
  border: '1px solid #1a1a1d',
  color: '#f0f0f2',
}
const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.border = '1px solid rgba(212,168,80,0.3)'
}
const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.border = '1px solid #1a1a1d'
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
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="max-w-lg space-y-4">
      {[
        { label: 'Nome do workspace', key: 'name', placeholder: 'Minha Loja' },
        { label: 'Slug', key: 'slug', placeholder: 'minha-loja' },
        { label: 'Idioma padrão', key: 'default_locale', placeholder: 'pt-BR' },
        { label: 'Moeda', key: 'currency', placeholder: 'BRL' },
      ].map(({ label, key, placeholder }) => (
        <div key={key}>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
            {label}
          </label>
          <input
            {...register(key as 'name' | 'slug' | 'default_locale' | 'currency')}
            placeholder={placeholder}
            className={inputClass}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </div>
      ))}

      <button
        type="submit"
        disabled={!isDirty || mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
        style={{ background: 'linear-gradient(135deg, #d4a850, #c49040)', color: '#0a0a0b' }}
      >
        {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Salvar alterações
      </button>
    </form>
  )
}

function BrandingTab({ workspace }: { workspace: Workspace }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [brandColor, setBrandColor] = useState(workspace.branding?.brand_color ?? '#d4a850')
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
    <div className="max-w-lg space-y-6">
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: '#5a5a64' }}>
          Cor da marca
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="w-12 h-10 rounded-lg cursor-pointer"
            style={{ background: 'none', border: '1px solid #1a1a1d', padding: '2px' }}
          />
          <input
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            placeholder="#d4a850"
            className={inputClass}
            style={{ ...inputStyle, flex: 1 }}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </div>
        <div
          className="mt-2 h-2 rounded-full"
          style={{ background: brandColor, opacity: 0.8 }}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: '#5a5a64' }}>
          Ícone da nota
        </label>
        <div className="flex gap-2">
          {icons.map((icon) => (
            <button
              key={icon.id}
              onClick={() => setRatingIcon(icon.id as 'star' | 'heart' | 'flame' | 'thumb' | 'diamond')}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all"
              style={{
                background: ratingIcon === icon.id ? 'rgba(212,168,80,0.1)' : '#0d0d0f',
                border: `2px solid ${ratingIcon === icon.id ? '#d4a850' : '#1a1a1d'}`,
              }}
            >
              {icon.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
          Tom de marca
        </label>
        <p className="text-xs mb-2" style={{ color: '#3a3a3e' }}>
          Descreva o tom de voz da sua marca para respostas geradas por IA.
        </p>
        <textarea
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
        style={{ background: 'linear-gradient(135deg, #d4a850, #c49040)', color: '#0a0a0b' }}
      >
        {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
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
    owner: '#d4a850',
    admin: '#a78bfa',
    moderator: '#60a5fa',
    viewer: '#5a5a64',
  }

  return (
    <div className="max-w-lg space-y-5">
      {/* Current members */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid #1e1e21' }}
      >
        <div
          className="px-4 py-3"
          style={{ background: '#0d0d0f', borderBottom: '1px solid #1a1a1d' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#5a5a64' }}>
            Membros ({workspace.users?.length ?? 0})
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: '#1a1a1d' }}>
          {workspace.users?.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: '#111113' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'rgba(212,168,80,0.1)', color: '#d4a850' }}
              >
                {user.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#f0f0f2' }}>
                  {user.name}
                </p>
                <p className="text-xs truncate" style={{ color: '#5a5a64' }}>
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
                  onClick={() => removeMutation.mutate(user.id)}
                  className="p-1 rounded transition-colors ml-1"
                  style={{ color: '#5a5a64' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#5a5a64' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invite */}
      <div
        className="rounded-xl p-4"
        style={{ background: '#111113', border: '1px solid #1e1e21' }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#f0f0f2' }}>
          Convidar membro do time
        </h3>
        <div className="flex gap-2 mb-2">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colega@empresa.com"
            className={inputClass}
            style={{ ...inputStyle, flex: 1 }}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          <select
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
          onClick={() => mutation.mutate({ email: inviteEmail, role: inviteRole })}
          disabled={!inviteEmail.trim() || mutation.isPending}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
          style={{ background: 'rgba(212,168,80,0.1)', border: '1px solid rgba(212,168,80,0.2)', color: '#d4a850' }}
        >
          <Plus className="w-3.5 h-3.5" />
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

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.workspace.listApiKeys(getToken()),
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.workspace.createApiKey(name, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setNewKeyName('')
      toast.success('Chave de API criada')
    },
    onError: () => toast.error('Falha ao criar chave de API'),
  })

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.workspace.revokeApiKey(keyId, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('Chave de API revogada')
    },
    onError: () => toast.error('Falha ao revogar chave'),
  })

  return (
    <div className="max-w-lg space-y-5">
      {/* Create key */}
      <div
        className="rounded-xl p-4"
        style={{ background: '#111113', border: '1px solid #1e1e21' }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#f0f0f2' }}>
          Criar chave de API
        </h3>
        <div className="flex gap-2">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Nome da chave (ex.: Produção)"
            className={inputClass}
            style={{ ...inputStyle, flex: 1 }}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          <button
            onClick={() => createMutation.mutate(newKeyName)}
            disabled={!newKeyName.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-all whitespace-nowrap"
            style={{ background: 'rgba(212,168,80,0.1)', border: '1px solid rgba(212,168,80,0.2)', color: '#d4a850' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Criar
          </button>
        </div>
      </div>

      {/* Key list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid #1e1e21' }}
      >
        <div
          className="px-4 py-3"
          style={{ background: '#0d0d0f', borderBottom: '1px solid #1a1a1d' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#5a5a64' }}>
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
            <p className="text-sm" style={{ color: '#5a5a64' }}>Ainda não há chaves de API</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a1a1d' }}>
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ background: '#111113' }}
              >
                <Key className="w-4 h-4 shrink-0" style={{ color: '#5a5a64' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: '#f0f0f2' }}>
                    {key.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono" style={{ color: '#8b8b96' }}>
                      {key.prefix}••••••••
                    </code>
                    <span className="text-xs" style={{ color: '#5a5a64' }}>
                      Criada em {format(new Date(key.created_at), "d 'de' MMM, yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(key.prefix)
                    setCopiedKey(key.id)
                    setTimeout(() => setCopiedKey(null), 2000)
                  }}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: '#5a5a64' }}
                >
                  {copiedKey === key.id ? (
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Revogar esta chave de API?')) revokeMutation.mutate(key.id)
                  }}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: '#5a5a64' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#5a5a64' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
    onError: () => toast.error('Falha ao adicionar domínio'),
  })

  const removeMutation = useMutation({
    mutationFn: (domain: string) => api.workspace.removeDomain(domain, getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      toast.success('Domínio removido')
    },
    onError: () => toast.error('Falha ao remover domínio'),
  })

  return (
    <div className="max-w-lg space-y-5">
      <div
        className="rounded-xl p-4"
        style={{ background: '#111113', border: '1px solid #1e1e21' }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#f0f0f2' }}>
          Domínios autorizados
        </h3>
        <p className="text-xs mb-4" style={{ color: '#5a5a64' }}>
          Domínios em que o widget de avaliações pode ser incorporado.
        </p>
        <div className="flex gap-2">
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="https://sualoja.com"
            className={inputClass}
            style={{ ...inputStyle, flex: 1 }}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          <button
            onClick={() => addMutation.mutate(newDomain)}
            disabled={!newDomain.trim() || addMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'rgba(212,168,80,0.1)', border: '1px solid rgba(212,168,80,0.2)', color: '#d4a850' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {(workspace.domains ?? []).map((domain) => (
          <div
            key={domain}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: '#111113', border: '1px solid #1e1e21' }}
          >
            <Globe className="w-4 h-4 shrink-0" style={{ color: '#5a5a64' }} />
            <span className="flex-1 text-sm font-mono" style={{ color: '#f0f0f2' }}>
              {domain}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(34,197,94,0.1)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              Ativo
            </span>
            <button
              onClick={() => removeMutation.mutate(domain)}
              className="p-1 rounded transition-colors"
              style={{ color: '#5a5a64' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#5a5a64' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {(!workspace.domains || workspace.domains.length === 0) && (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: '#5a5a64' }}>
              Nenhum domínio adicionado ainda
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('general')

  const { data: workspaceData, isLoading } = useQuery<Workspace>({
    queryKey: ['workspace', workspace],
    queryFn: () => api.workspace.get(getToken()),
  })

  if (isLoading || !workspaceData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#d4a850' }} />
      </div>
    )
  }

  const tabContent: Record<Tab, React.ReactNode> = {
    general: <GeneralTab workspace={workspaceData} />,
    branding: <BrandingTab workspace={workspaceData} />,
    team: <TeamTab workspace={workspaceData} />,
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
        className="flex items-center gap-1 px-5 py-3 overflow-x-auto"
        style={{ borderBottom: '1px solid #1e1e21' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={{
              background: activeTab === tab.id ? 'rgba(212,168,80,0.1)' : 'transparent',
              border: `1px solid ${activeTab === tab.id ? 'rgba(212,168,80,0.2)' : 'transparent'}`,
              color: activeTab === tab.id ? '#d4a850' : '#8b8b96',
            }}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
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

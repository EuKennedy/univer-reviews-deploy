'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowRight, Check, ExternalLink, Globe, Loader2, Package,
  ShoppingBag, Sparkles, Store,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  workspaceId: string
  workspaceSlug: string
  workspaceName: string
  userName: string
  hasDomain: boolean
  hasProducts: boolean
}

type Step = 'welcome' | 'platform' | 'domain' | 'install' | 'done'

const PLATFORM_OPTIONS: Array<{
  id: 'woocommerce' | 'shopify' | 'generic'
  label: string
  desc: string
  icon: React.ReactNode
}> = [
  { id: 'woocommerce', label: 'WooCommerce', desc: 'Sincronizar produtos + reviews + pedidos via API REST', icon: <ShoppingBag className="w-5 h-5" /> },
  { id: 'shopify',     label: 'Shopify',     desc: 'Webhooks + storefront API (em breve)',                  icon: <Store className="w-5 h-5" /> },
  { id: 'generic',     label: 'Outro',       desc: 'Vou instalar o widget manualmente via shortcode',       icon: <Package className="w-5 h-5" /> },
]

export function OnboardingFlow({
  workspaceId: _workspaceId,
  workspaceSlug,
  workspaceName,
  userName,
  hasDomain,
}: Props) {
  void _workspaceId
  const router = useRouter()
  const { getToken } = useAuth()
  const [step, setStep] = useState<Step>(hasDomain ? 'install' : 'welcome')
  const [platform, setPlatform] = useState<'woocommerce' | 'shopify' | 'generic'>('woocommerce')
  const [domain, setDomain] = useState('')

  const addDomain = useMutation({
    mutationFn: (d: string) => api.workspace.addDomain(d, getToken(), platform),
    onSuccess: () => {
      toast.success('Domínio adicionado.')
      setStep('install')
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao adicionar domínio'),
  })

  const STEPS: Step[] = ['welcome', 'platform', 'domain', 'install', 'done']
  const idx = STEPS.indexOf(step)

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--ur-bg)', color: 'var(--ur-text)' }}
    >
      {/* Top bar — branded */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--ur-border)' }}
      >
        <div className="flex items-center gap-2 text-sm font-bold">
          <span
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))', color: 'var(--ur-text-on-accent)' }}
          >
            U
          </span>
          UniverReviews
        </div>
        <button
          type="button"
          onClick={() => router.push(`/${workspaceSlug}/dashboard`)}
          className="text-xs"
          style={{ color: 'var(--ur-text-muted)' }}
        >
          Pular por enquanto →
        </button>
      </header>

      {/* Progress dots */}
      <div className="px-6 py-4 flex items-center justify-center gap-2">
        {STEPS.slice(0, -1).map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all"
            style={{
              width: i === idx ? 32 : 8,
              background: i <= idx ? 'var(--ur-accent)' : 'var(--ur-border)',
            }}
          />
        ))}
      </div>

      {/* Step content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-xl">
          {step === 'welcome' && (
            <StepWelcome
              userName={userName}
              workspaceName={workspaceName}
              onNext={() => setStep('platform')}
            />
          )}
          {step === 'platform' && (
            <StepPlatform
              platform={platform}
              onPlatformChange={setPlatform}
              onNext={() => setStep('domain')}
            />
          )}
          {step === 'domain' && (
            <StepDomain
              domain={domain}
              onDomainChange={setDomain}
              loading={addDomain.isPending}
              onNext={() => addDomain.mutate(domain.trim())}
              onSkip={() => setStep('install')}
            />
          )}
          {step === 'install' && (
            <StepInstall
              platform={platform}
              workspaceSlug={workspaceSlug}
              onNext={() => setStep('done')}
            />
          )}
          {step === 'done' && (
            <StepDone
              workspaceSlug={workspaceSlug}
              onFinish={() => router.push(`/${workspaceSlug}/dashboard`)}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function StepWelcome({
  userName, workspaceName, onNext,
}: { userName: string; workspaceName: string; onNext: () => void }) {
  return (
    <div className="text-center">
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))', color: 'var(--ur-text-on-accent)' }}
      >
        <Sparkles className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Olá, {userName}.</h1>
      <p className="mb-1" style={{ color: 'var(--ur-text-soft)' }}>
        Workspace <span style={{ color: 'var(--ur-text)' }}>{workspaceName}</span> criado.
      </p>
      <p className="text-sm mb-8" style={{ color: 'var(--ur-text-muted)' }}>
        Vamos conectar sua loja em 3 passos. Leva menos de 2 minutos.
      </p>
      <PrimaryButton onClick={onNext}>
        Começar <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </div>
  )
}

function StepPlatform({
  platform, onPlatformChange, onNext,
}: {
  platform: 'woocommerce' | 'shopify' | 'generic'
  onPlatformChange: (p: 'woocommerce' | 'shopify' | 'generic') => void
  onNext: () => void
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2 text-center">Qual sua plataforma?</h1>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--ur-text-muted)' }}>
        Vamos otimizar a integração para o e-commerce certo.
      </p>
      <div className="space-y-3 mb-8">
        {PLATFORM_OPTIONS.map((p) => {
          const selected = platform === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPlatformChange(p.id)}
              className="w-full flex items-start gap-3 p-4 rounded-xl text-left transition-all"
              style={{
                background: selected ? 'var(--ur-accent-soft)' : 'var(--ur-surface)',
                border: `2px solid ${selected ? 'var(--ur-accent)' : 'var(--ur-border)'}`,
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: selected ? 'var(--ur-accent)' : 'var(--ur-bg-soft)',
                  color: selected ? 'var(--ur-text-on-accent)' : 'var(--ur-text-soft)',
                }}
              >
                {p.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-0.5">{p.label}</div>
                <div className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>{p.desc}</div>
              </div>
              {selected && <Check className="w-4 h-4" style={{ color: 'var(--ur-accent)' }} />}
            </button>
          )
        })}
      </div>
      <PrimaryButton onClick={onNext}>
        Próximo <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </div>
  )
}

function StepDomain({
  domain, onDomainChange, loading, onNext, onSkip,
}: {
  domain: string
  onDomainChange: (d: string) => void
  loading: boolean
  onNext: () => void
  onSkip: () => void
}) {
  const sanitized = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim().toLowerCase()
  const valid = /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(sanitized)

  return (
    <div>
      <div
        className="w-12 h-12 mx-auto mb-5 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--ur-accent-glow)', color: 'var(--ur-accent)' }}
      >
        <Globe className="w-6 h-6" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2 text-center">Domínio da loja</h1>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--ur-text-muted)' }}>
        Onde o widget vai rodar. Sem <code>https://</code>.
      </p>
      <div className="mb-3">
        <input
          type="text"
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
          placeholder="suamarca.com.br"
          autoFocus
          className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
          style={{
            background: 'var(--ur-surface)',
            border: `1px solid ${valid ? 'var(--ur-accent-soft-3)' : 'var(--ur-border)'}`,
            color: 'var(--ur-text)',
          }}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--ur-text-muted)' }}>
          O widget só carrega em domínios registrados aqui.
        </p>
      </div>
      <div className="flex flex-col gap-2 mt-6">
        <PrimaryButton onClick={onNext} disabled={!valid || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Adicionar domínio
        </PrimaryButton>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs"
          style={{ color: 'var(--ur-text-muted)' }}
        >
          Configurar mais tarde
        </button>
      </div>
    </div>
  )
}

function StepInstall({
  platform, workspaceSlug, onNext,
}: { platform: 'woocommerce' | 'shopify' | 'generic'; workspaceSlug: string; onNext: () => void }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2 text-center">Instalar o widget</h1>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--ur-text-muted)' }}>
        Escolha o método e siga as instruções da loja escolhida.
      </p>

      {platform === 'woocommerce' && (
        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
        >
          <h3 className="text-sm font-semibold mb-3">Plugin WordPress</h3>
          <ol className="text-sm space-y-2 list-decimal pl-5" style={{ color: 'var(--ur-text-soft)' }}>
            <li>Baixe o plugin <code>univer-reviews.zip</code> em <span style={{ color: 'var(--ur-accent)' }}>Configurações → Integrações</span>.</li>
            <li>WordPress Admin → Plugins → Adicionar Novo → Upload → ative.</li>
            <li>Cole a API key fornecida em Configurações do plugin.</li>
            <li>O shortcode <code>[univer_reviews]</code> já aparece nas páginas de produto.</li>
          </ol>
          <a
            href={`/${workspaceSlug}/integrations/woocommerce`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: 'var(--ur-accent)' }}
          >
            Abrir guia completo <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {platform === 'shopify' && (
        <div
          className="rounded-xl p-5 mb-6 text-sm"
          style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)', color: 'var(--ur-text-soft)' }}
        >
          App Shopify em revisão. Por enquanto, use o método genérico (script tag) na thema.liquid.
        </div>
      )}

      {platform === 'generic' && (
        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
        >
          <h3 className="text-sm font-semibold mb-3">Script tag</h3>
          <pre
            className="text-xs p-3 rounded-md overflow-x-auto"
            style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border-soft)', color: 'var(--ur-text-soft)' }}
          >
{`<script async src="https://api.univerreviews.com/widget.js"></script>

<univer-reviews
  workspace-id="<seu-uuid>"
  product-id="<product-id-da-loja>"
></univer-reviews>`}
          </pre>
        </div>
      )}

      <PrimaryButton onClick={onNext}>
        Concluí a instalação <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </div>
  )
}

function StepDone({
  workspaceSlug, onFinish,
}: { workspaceSlug: string; onFinish: () => void }) {
  void workspaceSlug
  return (
    <div className="text-center">
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--ur-success-bg)', color: 'var(--ur-success)' }}
      >
        <Check className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Tudo pronto.</h1>
      <p className="mb-8" style={{ color: 'var(--ur-text-soft)' }}>
        Seu workspace está configurado. Quando o primeiro review chegar, você vê
        no dashboard.
      </p>
      <PrimaryButton onClick={onFinish}>
        Ir pro dashboard <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </div>
  )
}

function PrimaryButton({
  children, onClick, disabled = false,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
        color: 'var(--ur-text-on-accent)',
      }}
    >
      {children}
    </button>
  )
}

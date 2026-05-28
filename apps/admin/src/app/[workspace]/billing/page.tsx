'use client'

import { CreditCard, Loader2, ExternalLink } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

// Three-tier paid ladder (T1.3). Source of truth for the tier names is
// Rails (Workspace::PLANS) — renaming here without the DB migration will
// desync the dropdown from the backend's CHECK constraint.
type PlanKey = 'entry' | 'medium' | 'ultra'

interface Plan {
  key: PlanKey
  name: string
  price: string
  reviews: string
  users: string
  tagline: string
  features: string[]
}

// Layout intentionally identical to pre-T1.3 cards — only strings + tier
// keys changed. The external payment platform handles the actual
// purchase, so we no longer redirect to an in-app checkout; the CTA
// opens the merchant's external billing area.
const PLANS: Plan[] = [
  {
    key: 'entry',
    name: 'Entry',
    price: 'R$29',
    reviews: '1.000',
    users: '1',
    tagline: 'O essencial para começar a coletar avaliações.',
    features: [
      'Widget completo na vitrine',
      'Moderação por IA',
      'Geração de avaliações por IA',
      'Importação por CSV',
      'Campanhas por e-mail',
    ],
  },
  {
    key: 'medium',
    name: 'Medium',
    price: 'R$99',
    reviews: '10.000',
    users: '5',
    tagline: 'Para a operação rodando — equipe, dedup e marca.',
    features: [
      'Tudo do Entry',
      'Deduplicação por IA',
      'Sumários de IA por produto',
      'Equipe com até 5 usuários',
      'Marca personalizada (ícone + CSS)',
      'Acesso à API e webhooks automáticos',
      'Programa de fidelidade',
    ],
  },
  {
    key: 'ultra',
    name: 'Ultra',
    price: 'R$299',
    reviews: 'Ilimitado',
    users: 'Ilimitado',
    tagline: 'Para escalar sem teto — bulk AI e governança.',
    features: [
      'Tudo do Medium',
      'Geração em massa de avaliações por IA',
      'Geração em massa de Q&A por IA',
      'Sumários em massa de IA',
      'Whitelabel completo',
      'SSO e exportação de audit log',
      'SLA e suporte prioritário',
    ],
  },
]

export default function BillingPage() {
  const { getToken, isAuthenticated } = useAuth()

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.billing.get(getToken()).then(r => r.data),
    enabled: isAuthenticated,
  })

  const currentPlan: PlanKey = subscription?.plan ?? 'entry'

  const checkoutMut = useMutation({
    mutationFn: (plan: PlanKey) => api.billing.createCheckout(plan, getToken()),
    onSuccess: (r) => {
      // External payment platform — full-page redirect so the merchant
      // lands on the hosted payment form. window.location wins over
      // router.push because the target is a third-party domain.
      window.location.href = r.url
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao iniciar a contratação'),
  })

  const portalMut = useMutation({
    mutationFn: () => api.billing.portal(getToken()),
    onSuccess: (r) => { window.location.href = r.url },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao abrir o portal de cobrança'),
  })

  const current = PLANS.find(p => p.key === currentPlan) ?? PLANS[0]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<CreditCard className="w-5 h-5" />}
        title="Faturamento"
        subtitle="Gerencie sua assinatura e uso"
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto">
          {/* Current plan */}
          <div
            className="rounded-xl p-5 mb-6"
            style={{ background: 'var(--ur-accent-glow)', border: '1px solid var(--ur-accent-soft-3)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--ur-accent)' }}>
                  Plano atual
                </p>
                <h3 className="text-xl font-bold" style={{ color: 'var(--ur-text)' }}>
                  {isLoading ? '…' : current.name}
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--ur-text-soft)' }}>
                  {current.reviews} avaliações/mês · {current.users} usuário(s)
                </p>
                {subscription?.current_period_end && (
                  <p className="text-xs mt-2" style={{ color: 'var(--ur-text-muted)' }}>
                    {subscription.cancel_at_period_end
                      ? `Será cancelado em ${new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}`
                      : `Renova em ${new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}`}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: 'var(--ur-text)' }}>{current.price}</p>
                <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>por mês</p>

                {subscription?.stripe_customer_id && (
                  <button
                    onClick={() => portalMut.mutate()}
                    disabled={portalMut.isPending}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
                    style={{ color: 'var(--ur-accent)' }}
                  >
                    {portalMut.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ExternalLink className="w-3 h-3" />
                    )}
                    Gerenciar cobrança
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* External-platform notice. T1.3 moved the actual purchase to
              a third-party gateway — make this explicit so the merchant
              doesn't expect the upgrade to happen inside this UI. */}
          <p
            className="text-xs mb-6 leading-relaxed"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            A contratação e os pagamentos são processados na plataforma de pagamentos
            externa. Ao escolher um plano abaixo, você é direcionado ao checkout seguro
            e, após a confirmação, seu workspace é atualizado automaticamente.
          </p>

          {/* Plans */}
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ur-text)' }}>
            {currentPlan === 'ultra' ? 'Sua assinatura' : 'Escolha o plano ideal'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan
              const isPopular = plan.key === 'medium'

              const handleClick = () => {
                if (isCurrent) return
                checkoutMut.mutate(plan.key)
              }

              const pending = checkoutMut.isPending && checkoutMut.variables === plan.key

              return (
                <div
                  key={plan.key}
                  className="rounded-xl p-5 relative"
                  style={{
                    background: isPopular ? 'var(--ur-accent-glow)' : 'var(--ur-surface)',
                    border: isPopular ? '1px solid var(--ur-accent-soft-3)' : '1px solid var(--ur-border)',
                  }}
                >
                  {isPopular && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full"
                      style={{ background: 'var(--ur-accent)', color: 'var(--ur-text-on-accent)' }}
                    >
                      Mais popular
                    </div>
                  )}
                  <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
                    {plan.name}
                  </h3>
                  <p
                    className="text-xs mb-3 leading-snug"
                    style={{ color: 'var(--ur-text-muted)' }}
                  >
                    {plan.tagline}
                  </p>
                  <p
                    className="text-2xl font-bold mb-4"
                    style={{ color: isPopular ? 'var(--ur-accent)' : 'var(--ur-text)' }}
                  >
                    {plan.price}
                    <span
                      className="text-xs font-normal ml-1"
                      style={{ color: 'var(--ur-text-muted)' }}
                    >
                      /mês
                    </span>
                  </p>

                  <div className="space-y-2 mb-5">
                    {plan.features.map((f) => (
                      <p
                        key={f}
                        className="text-xs flex items-start gap-1.5"
                        style={{ color: 'var(--ur-text-soft)' }}
                      >
                        <span style={{ color: 'var(--ur-success)' }}>✓</span> {f}
                      </p>
                    ))}
                  </div>

                  <button
                    onClick={handleClick}
                    disabled={isCurrent || pending}
                    className="w-full py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: isPopular && !isCurrent
                        ? 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))'
                        : 'var(--ur-surface-soft)',
                      color: isPopular && !isCurrent ? 'var(--ur-bg)' : 'var(--ur-text-soft)',
                      border: isPopular && !isCurrent ? 'none' : '1px solid var(--ur-border-strong)',
                    }}
                  >
                    {pending ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" /> Redirecionando…
                      </span>
                    ) : isCurrent ? (
                      'Plano atual'
                    ) : (
                      `Contratar ${plan.name}`
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { CreditCard, Loader2, ExternalLink } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise'

interface Plan {
  key: PlanKey
  name: string
  price: string
  reviews: string
  users: string
  features: string[]
  // null = not purchasable via checkout (free = default, enterprise = contact sales)
  checkoutKey: 'starter' | 'pro' | 'enterprise' | null
}

const PLANS: Plan[] = [
  { key: 'free',       name: 'Free',       price: 'R$0',           reviews: '500',       users: '1',         features: ['Widget', 'Moderação básica'], checkoutKey: null },
  { key: 'starter',    name: 'Starter',    price: 'R$29',          reviews: '5.000',     users: '3',         features: ['Widget', 'Moderação por IA', 'Campanhas'], checkoutKey: 'starter' },
  { key: 'pro',        name: 'Pro',        price: 'R$99',          reviews: '50.000',    users: '10',        features: ['Tudo do Starter', 'Lab de IA', 'Marca personalizada', 'Acesso à API'], checkoutKey: 'pro' },
  { key: 'enterprise', name: 'Enterprise', price: 'Sob consulta',  reviews: 'Ilimitado', users: 'Ilimitado', features: ['Tudo do Pro', 'SLA', 'Suporte dedicado', 'SSO'], checkoutKey: 'enterprise' },
]

export default function BillingPage() {
  const { getToken, isAuthenticated } = useAuth()

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.billing.get(getToken()).then(r => r.data),
    enabled: isAuthenticated,
  })

  const currentPlan: PlanKey = subscription?.plan ?? 'free'

  const checkoutMut = useMutation({
    mutationFn: (plan: 'starter' | 'pro' | 'enterprise') =>
      api.billing.createCheckout(plan, getToken()),
    onSuccess: (r) => {
      // Stripe Checkout — full-page redirect so the merchant lands on the
      // hosted payment form. window.location wins over router.push here
      // because the target is on a third-party domain.
      window.location.href = r.url
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao iniciar checkout'),
  })

  const portalMut = useMutation({
    mutationFn: () => api.billing.portal(getToken()),
    onSuccess: (r) => { window.location.href = r.url },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao abrir portal de billing'),
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
            className="rounded-xl p-5 mb-8"
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
                    Gerenciar no Stripe
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Plans */}
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ur-text)' }}>
            {currentPlan === 'enterprise' ? 'Sua assinatura' : 'Faça upgrade do seu plano'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan, i) => {
              const isCurrent = plan.key === currentPlan
              const isPopular = plan.key === 'pro'
              const canCheckout = plan.checkoutKey != null && !isCurrent
              const isContactSales = plan.key === 'enterprise'

              const handleClick = () => {
                if (isCurrent || !canCheckout) return
                if (isContactSales) {
                  window.location.href = 'mailto:vendas@univerreviews.com?subject=Plano%20Enterprise%20-%20UniverReviews'
                  return
                }
                checkoutMut.mutate(plan.checkoutKey as 'starter' | 'pro')
              }

              const pending = checkoutMut.isPending && checkoutMut.variables === plan.checkoutKey

              return (
                <div
                  key={plan.name}
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
                  <p className="text-xl font-bold mb-4" style={{ color: isPopular ? 'var(--ur-accent)' : 'var(--ur-text)' }}>
                    {plan.price}
                    {plan.price !== 'Sob consulta' && (
                      <span className="text-xs font-normal ml-1" style={{ color: 'var(--ur-text-muted)' }}>
                        /mês
                      </span>
                    )}
                  </p>

                  <div className="space-y-2 mb-5">
                    {plan.features.map((f) => (
                      <p key={f} className="text-xs flex items-center gap-1.5" style={{ color: 'var(--ur-text-soft)' }}>
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
                        <Loader2 className="w-3 h-3 animate-spin" /> Iniciando…
                      </span>
                    ) : isCurrent ? (
                      'Plano atual'
                    ) : isContactSales ? (
                      'Falar com vendas'
                    ) : (
                      `Fazer upgrade para ${plan.name}`
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

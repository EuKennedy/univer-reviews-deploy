import { CreditCard } from 'lucide-react'
import { PageHeader } from '@/components/godmode/PageHeader'

export default function BillingPage() {
  const plans = [
    { name: 'Free', price: 'R$0', reviews: '500', users: '1', features: ['Widget', 'Moderação básica'] },
    { name: 'Starter', price: 'R$29', reviews: '5.000', users: '3', features: ['Widget', 'Moderação por IA', 'Campanhas'] },
    { name: 'Pro', price: 'R$99', reviews: '50.000', users: '10', features: ['Tudo do Starter', 'Lab de IA', 'Marca personalizada', 'Acesso à API'] },
    { name: 'Enterprise', price: 'Sob consulta', reviews: 'Ilimitado', users: 'Ilimitado', features: ['Tudo do Pro', 'SLA', 'Suporte dedicado', 'SSO'] },
  ]

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
                <h3 className="text-xl font-bold" style={{ color: 'var(--ur-text)' }}>Free</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--ur-text-soft)' }}>
                  500 avaliações/mês · 1 usuário
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: 'var(--ur-text)' }}>R$0</p>
                <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>por mês</p>
              </div>
            </div>
          </div>

          {/* Plans */}
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ur-text)' }}>
            Faça upgrade do seu plano
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className="rounded-xl p-5 relative"
                style={{
                  background: i === 2 ? 'var(--ur-accent-glow)' : 'var(--ur-surface)',
                  border: i === 2 ? '1px solid var(--ur-accent-soft-3)' : '1px solid var(--ur-border)',
                }}
              >
                {i === 2 && (
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
                <p className="text-xl font-bold mb-4" style={{ color: i === 2 ? 'var(--ur-accent)' : 'var(--ur-text)' }}>
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
                  className="w-full py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: i === 2 ? 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))' : 'var(--ur-surface-soft)',
                    color: i === 2 ? 'var(--ur-bg)' : 'var(--ur-text-soft)',
                    border: i === 2 ? 'none' : '1px solid var(--ur-border-strong)',
                  }}
                >
                  {i === 0 ? 'Plano atual' : `Fazer upgrade para ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

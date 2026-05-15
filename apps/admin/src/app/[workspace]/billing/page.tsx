import { CreditCard } from 'lucide-react'
import { PageHeader } from '@/components/godmode/PageHeader'

export default function BillingPage() {
  const plans = [
    { name: 'Free', price: '$0', reviews: '500', users: '1', features: ['Widget', 'Basic moderation'] },
    { name: 'Starter', price: '$29', reviews: '5,000', users: '3', features: ['Widget', 'AI moderation', 'Campaigns'] },
    { name: 'Pro', price: '$99', reviews: '50,000', users: '10', features: ['Everything in Starter', 'AI Lab', 'Custom branding', 'API access'] },
    { name: 'Enterprise', price: 'Custom', reviews: 'Unlimited', users: 'Unlimited', features: ['Everything in Pro', 'SLA', 'Dedicated support', 'SSO'] },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<CreditCard className="w-5 h-5" />}
        title="Billing"
        subtitle="Manage your subscription and usage"
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto">
          {/* Current plan */}
          <div
            className="rounded-xl p-5 mb-8"
            style={{ background: 'rgba(212,168,80,0.06)', border: '1px solid rgba(212,168,80,0.2)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#d4a850' }}>
                  Current plan
                </p>
                <h3 className="text-xl font-bold" style={{ color: '#f0f0f2' }}>Free</h3>
                <p className="text-sm mt-1" style={{ color: '#8b8b96' }}>
                  500 reviews/month · 1 user
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>$0</p>
                <p className="text-xs" style={{ color: '#5a5a64' }}>per month</p>
              </div>
            </div>
          </div>

          {/* Plans */}
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#f0f0f2' }}>
            Upgrade your plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className="rounded-xl p-5 relative"
                style={{
                  background: i === 2 ? 'rgba(212,168,80,0.06)' : '#111113',
                  border: i === 2 ? '1px solid rgba(212,168,80,0.3)' : '1px solid #1e1e21',
                }}
              >
                {i === 2 && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full"
                    style={{ background: '#d4a850', color: '#0a0a0b' }}
                  >
                    Popular
                  </div>
                )}
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#f0f0f2' }}>
                  {plan.name}
                </h3>
                <p className="text-xl font-bold mb-4" style={{ color: i === 2 ? '#d4a850' : '#f0f0f2' }}>
                  {plan.price}
                  {plan.price !== 'Custom' && (
                    <span className="text-xs font-normal ml-1" style={{ color: '#5a5a64' }}>
                      /mo
                    </span>
                  )}
                </p>

                <div className="space-y-2 mb-5">
                  {plan.features.map((f) => (
                    <p key={f} className="text-xs flex items-center gap-1.5" style={{ color: '#8b8b96' }}>
                      <span style={{ color: '#22c55e' }}>✓</span> {f}
                    </p>
                  ))}
                </div>

                <button
                  className="w-full py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: i === 2 ? 'linear-gradient(135deg, #d4a850, #c49040)' : '#1a1a1d',
                    color: i === 2 ? '#0a0a0b' : '#8b8b96',
                    border: i === 2 ? 'none' : '1px solid #2a2a2d',
                  }}
                >
                  {i === 0 ? 'Current plan' : `Upgrade to ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

import { Plug } from 'lucide-react'
import { PageHeader } from '@/components/godmode/PageHeader'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'

const integrations = [
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description:
      'Sync products, import customer reviews, and automate review collection for your WooCommerce store.',
    status: 'connected' as const,
    href: 'integrations/woocommerce',
    logo: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#7f54b3">
        <path d="M3.1 8.7c-.3-.4-.3-1 .1-1.4C4 6.5 5 6 6.2 6h11.6c1.2 0 2.2.5 2.9 1.4.7.9.9 2 .6 3.1l-2.1 8c-.3 1.3-1.5 2.3-2.8 2.3H7.6c-1.3 0-2.5-1-2.8-2.3l-2.1-8c-.1-.7 0-1.3.4-1.8z" />
        <circle cx="9" cy="19.5" r="1.5" fill="#fff" />
        <circle cx="15" cy="19.5" r="1.5" fill="#fff" />
      </svg>
    ),
    stats: [
      { label: 'Products', value: '1,248' },
      { label: 'Reviews synced', value: '3,421' },
    ],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description:
      'Connect your Shopify store to collect reviews automatically after purchase.',
    status: 'coming_soon' as const,
    logo: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#96bf48">
        <path d="M15.3 3.5c-.1 0-.2 0-.3.1-.7 2.1-2.1 2.6-2.6 2.6H9.7c-.9 0-1.6.7-1.6 1.6v11.6c0 .9.7 1.6 1.6 1.6h6.6c.9 0 1.6-.7 1.6-1.6V5.1c0-.9-.7-1.6-1.6-1.6z" />
      </svg>
    ),
  },
  {
    id: 'nuvemshop',
    name: 'Nuvemshop',
    description:
      'Integrate with Nuvemshop (Tiendanube) to collect reviews from Latin American customers.',
    status: 'coming_soon' as const,
    logo: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#005cff">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l2.5 2.5L16 9" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'mercadolivre',
    name: 'Mercado Livre',
    description:
      "Import and manage reviews from Brazil's largest marketplace automatically.",
    status: 'coming_soon' as const,
    logo: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#ffe600">
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <path d="M8 12l2 2 4-4" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description:
      'Connect UniverReviews to 5000+ apps via Zapier for custom automation workflows.',
    status: 'coming_soon' as const,
    logo: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#ff4a00">
        <polygon points="12,2 22,7 22,17 12,22 2,17 2,7" />
      </svg>
    ),
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    description:
      'Send real-time events to your own endpoints when reviews are created or updated.',
    status: 'not_connected' as const,
    href: 'integrations/webhooks',
    logo: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#8b8b96" strokeWidth="1.5">
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
]

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Plug className="w-5 h-5" />}
        title="Integrations"
        subtitle="Connect your store and automate review collection"
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#5a5a64' }}>
              Available integrations
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                name={integration.name}
                description={integration.description}
                status={integration.status}
                logo={integration.logo}
                href={integration.href}
                stats={integration.stats}
              />
            ))}
          </div>

          <div
            className="mt-8 rounded-xl p-5"
            style={{ background: '#111113', border: '1px solid #1e1e21' }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(212,168,80,0.1)', border: '1px solid rgba(212,168,80,0.15)' }}
              >
                <Plug className="w-5 h-5" style={{ color: '#d4a850' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
                  Request an integration
                </h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#8b8b96' }}>
                  Don&apos;t see your platform? We ship integrations fast. Reach out and
                  we&apos;ll prioritize based on demand.
                </p>
                <button
                  className="mt-3 text-xs font-medium transition-colors"
                  style={{ color: '#d4a850' }}
                >
                  Request integration →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

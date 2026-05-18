import { Gift } from 'lucide-react'
import { PageHeader } from '@/components/godmode/PageHeader'

export default function RewardsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Gift className="w-5 h-5" />}
        title="Recompensas"
        subtitle="Incentive clientes a deixar avaliações"
      />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'var(--ur-accent-glow)',
              border: '1px solid var(--ur-accent-soft-2)',
            }}
          >
            <Gift className="w-8 h-8" style={{ color: 'var(--ur-accent)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
            Recompensas — Em breve
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ur-text-muted)' }}>
            Cupons de desconto, cashback e pontos de fidelidade para quem avalia
          </p>
        </div>
      </div>
    </div>
  )
}

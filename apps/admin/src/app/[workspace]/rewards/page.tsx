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
              background: 'rgba(212,168,80,0.08)',
              border: '1px solid rgba(212,168,80,0.15)',
            }}
          >
            <Gift className="w-8 h-8" style={{ color: '#d4a850' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#f0f0f2' }}>
            Recompensas — Em breve
          </p>
          <p className="text-xs mt-1" style={{ color: '#5a5a64' }}>
            Cupons de desconto, cashback e pontos de fidelidade para quem avalia
          </p>
        </div>
      </div>
    </div>
  )
}

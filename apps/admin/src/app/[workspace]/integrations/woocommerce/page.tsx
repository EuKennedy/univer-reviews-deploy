'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import {
  Plug,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/godmode/PageHeader'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { WooCommerceConfig } from '@/types'

const STEPS = ['URL da loja', 'Chaves de API', 'Teste', 'Configurar', 'Pronto']

function StepIndicator({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
              style={{
                background:
                  i < current
                    ? '#22c55e'
                    : i === current
                    ? 'rgba(212,168,80,0.2)'
                    : '#1a1a1d',
                border: `2px solid ${i < current ? '#22c55e' : i === current ? '#d4a850' : '#2a2a2d'}`,
                color:
                  i < current ? '#fff' : i === current ? '#d4a850' : '#5a5a64',
              }}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className="text-xs mt-1 whitespace-nowrap"
              style={{
                color:
                  i < current ? '#22c55e' : i === current ? '#d4a850' : '#5a5a64',
              }}
            >
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="h-px mx-2 mb-4 transition-all duration-300"
              style={{
                width: 40,
                background: i < current ? '#22c55e' : '#2a2a2d',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function WooCommercePage() {
  const params = useParams()
  const workspace = params?.workspace as string
  const { getToken } = useAuth()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Partial<WooCommerceConfig>>({
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
    sync_products: true,
    sync_reviews: true,
    auto_sync_interval: 3600,
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const { data: config, isLoading } = useQuery({
    queryKey: ['woocommerce-config', workspace],
    queryFn: () => api.integrations.woocommerce.get(getToken()),
  })

  const saveMutation = useMutation({
    mutationFn: (data: WooCommerceConfig) =>
      api.integrations.woocommerce.save(data, getToken()),
    onSuccess: () => {
      toast.success('Integração WooCommerce salva')
      setStep(4)
    },
    onError: () => toast.error('Falha ao salvar configuração'),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.integrations.woocommerce.syncProducts(getToken()),
    onSuccess: () => toast.success('Sincronização iniciada'),
    onError: () => toast.error('Falha na sincronização'),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => api.integrations.woocommerce.disconnect(getToken()),
    onSuccess: () => {
      toast.success('Desconectado')
      window.location.reload()
    },
  })

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.integrations.woocommerce.test(getToken())
      setTestResult(result)
      if (result.success) {
        setTimeout(() => setStep(3), 800)
      }
    } catch {
      setTestResult({ success: false, message: 'Falha na conexão' })
    } finally {
      setTesting(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  const inputStyle: React.CSSProperties = {
    background: '#0d0d0f',
    border: '1px solid #1a1a1d',
    color: '#f0f0f2',
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#d4a850' }} />
      </div>
    )
  }

  // Connected state
  if (config?.connected) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          icon={<Plug className="w-5 h-5" />}
          title="WooCommerce"
          subtitle="Integração ativa"
          breadcrumbs={[
            { label: 'Integrações', href: `/${workspace}/integrations` },
            { label: 'WooCommerce' },
          ]}
        />

        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Status card */}
            <div
              className="rounded-xl p-5"
              style={{ background: '#111113', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.1)' }}
                >
                  <CheckCircle2 className="w-5 h-5" style={{ color: '#22c55e' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
                    Conectado
                  </h3>
                  <p className="text-xs" style={{ color: '#5a5a64' }}>
                    {config.store_url}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'Produtos',
                    value: config.product_count?.toLocaleString('pt-BR') ?? '—',
                  },
                  {
                    label: 'Avaliações',
                    value: config.review_count?.toLocaleString('pt-BR') ?? '—',
                  },
                  {
                    label: 'Última sincronização',
                    value: config.last_sync_at
                      ? format(new Date(config.last_sync_at), "d 'de' MMM, HH:mm", { locale: ptBR })
                      : 'Nunca',
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs" style={{ color: '#5a5a64' }}>
                      {label}
                    </p>
                    <p className="text-lg font-bold" style={{ color: '#f0f0f2' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div
              className="rounded-xl p-5"
              style={{ background: '#111113', border: '1px solid #1e1e21' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#f0f0f2' }}>
                Sincronização
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: 'rgba(212,168,80,0.1)',
                    border: '1px solid rgba(212,168,80,0.2)',
                    color: '#d4a850',
                  }}
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Sincronizar produtos agora
                </button>
                <a
                  href={config.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: '#0a0a0b',
                    border: '1px solid #1e1e21',
                    color: '#8b8b96',
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir loja
                </a>
              </div>
            </div>

            {/* Danger zone */}
            <div
              className="rounded-xl p-5"
              style={{
                background: 'rgba(239,68,68,0.04)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                <h3 className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                  Zona de perigo
                </h3>
              </div>
              <p className="text-xs mb-4" style={{ color: '#8b8b96' }}>
                Desconectar irá interromper todas as sincronizações. As avaliações
                já importadas serão mantidas.
              </p>
              <button
                onClick={() => {
                  if (
                    confirm(
                      'Desconectar a integração WooCommerce? Essa ação não pode ser desfeita.'
                    )
                  ) {
                    disconnectMutation.mutate()
                  }
                }}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#ef4444',
                }}
              >
                <Trash2 className="w-4 h-4" />
                Desconectar
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Plug className="w-5 h-5" />}
        title="Configuração do WooCommerce"
        subtitle="Conecte sua loja WooCommerce"
        breadcrumbs={[
          { label: 'Integrações', href: `/${workspace}/integrations` },
          { label: 'WooCommerce' },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-xl mx-auto">
          {/* Step indicator */}
          <div className="flex justify-center mb-8">
            <StepIndicator steps={STEPS} current={step} />
          </div>

          <AnimatePresence mode="wait">
            {/* Step 0: Store URL */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-xl p-6"
                style={{ background: '#111113', border: '1px solid #1e1e21' }}
              >
                <h3 className="text-base font-semibold mb-1" style={{ color: '#f0f0f2' }}>
                  Informe a URL da sua loja
                </h3>
                <p className="text-sm mb-5" style={{ color: '#5a5a64' }}>
                  Esta é a URL da sua loja WooCommerce.
                </p>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
                  URL da loja
                </label>
                <input
                  {...field('store_url')}
                  placeholder="https://sualoja.com"
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.border = '1px solid rgba(212,168,80,0.3)' }}
                  onBlur={(e) => { e.target.style.border = '1px solid #1a1a1d' }}
                />
                <button
                  onClick={() => setStep(1)}
                  disabled={!form.store_url?.trim()}
                  className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
                  style={{ background: 'linear-gradient(135deg, #d4a850, #c49040)', color: '#0a0a0b' }}
                >
                  Avançar →
                </button>
              </motion.div>
            )}

            {/* Step 1: API Keys */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-xl p-6"
                style={{ background: '#111113', border: '1px solid #1e1e21' }}
              >
                <h3 className="text-base font-semibold mb-1" style={{ color: '#f0f0f2' }}>
                  Chaves de API do WooCommerce
                </h3>
                <p className="text-sm mb-2" style={{ color: '#5a5a64' }}>
                  Vá em WooCommerce → Configurações → Avançado → API REST para gerar as chaves.
                </p>
                <a
                  href={`${form.store_url}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs mb-5"
                  style={{ color: '#d4a850' }}
                >
                  Abrir configurações da API do WooCommerce <ExternalLink className="w-3 h-3" />
                </a>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
                      Consumer Key
                    </label>
                    <input
                      {...field('consumer_key')}
                      placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className={inputClass}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.border = '1px solid rgba(212,168,80,0.3)' }}
                      onBlur={(e) => { e.target.style.border = '1px solid #1a1a1d' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
                      Consumer Secret
                    </label>
                    <input
                      type="password"
                      {...field('consumer_secret')}
                      placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className={inputClass}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.border = '1px solid rgba(212,168,80,0.3)' }}
                      onBlur={(e) => { e.target.style.border = '1px solid #1a1a1d' }}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setStep(0)}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{ background: '#0a0a0b', border: '1px solid #1e1e21', color: '#8b8b96' }}
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!form.consumer_key?.trim() || !form.consumer_secret?.trim()}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
                    style={{ background: 'linear-gradient(135deg, #d4a850, #c49040)', color: '#0a0a0b' }}
                  >
                    Avançar →
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Test */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-xl p-6"
                style={{ background: '#111113', border: '1px solid #1e1e21' }}
              >
                <h3 className="text-base font-semibold mb-1" style={{ color: '#f0f0f2' }}>
                  Testar conexão
                </h3>
                <p className="text-sm mb-5" style={{ color: '#5a5a64' }}>
                  Verifique se as credenciais da API funcionam corretamente.
                </p>

                {testResult && (
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-lg mb-4"
                    style={{
                      background: testResult.success
                        ? 'rgba(34,197,94,0.08)'
                        : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${testResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#22c55e' }} />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0" style={{ color: '#ef4444' }} />
                    )}
                    <p
                      className="text-sm"
                      style={{ color: testResult.success ? '#22c55e' : '#ef4444' }}
                    >
                      {testResult.message}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{ background: '#0a0a0b', border: '1px solid #1e1e21', color: '#8b8b96' }}
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-all"
                    style={{ background: 'linear-gradient(135deg, #d4a850, #c49040)', color: '#0a0a0b' }}
                  >
                    {testing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Testar conexão
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Configure */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-xl p-6"
                style={{ background: '#111113', border: '1px solid #1e1e21' }}
              >
                <h3 className="text-base font-semibold mb-1" style={{ color: '#f0f0f2' }}>
                  Configurar sincronização
                </h3>
                <p className="text-sm mb-5" style={{ color: '#5a5a64' }}>
                  Escolha o que sincronizar e com qual frequência.
                </p>

                <div className="space-y-4">
                  {[
                    { key: 'sync_products', label: 'Sincronizar produtos', desc: 'Importar catálogo de produtos do WooCommerce' },
                    { key: 'sync_reviews', label: 'Sincronizar avaliações', desc: 'Importar avaliações existentes do WooCommerce' },
                  ].map(({ key, label, desc }) => (
                    <label
                      key={key}
                      className="flex items-start gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form[key as keyof typeof form] as boolean}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                        className="mt-0.5"
                        style={{ accentColor: '#d4a850' }}
                      />
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#f0f0f2' }}>
                          {label}
                        </p>
                        <p className="text-xs" style={{ color: '#5a5a64' }}>
                          {desc}
                        </p>
                      </div>
                    </label>
                  ))}

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
                      Intervalo de sincronização automática
                    </label>
                    <select
                      value={form.auto_sync_interval}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          auto_sync_interval: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: '#0d0d0f', border: '1px solid #1a1a1d', color: '#f0f0f2' }}
                    >
                      <option value={900}>A cada 15 minutos</option>
                      <option value={1800}>A cada 30 minutos</option>
                      <option value={3600}>A cada hora</option>
                      <option value={21600}>A cada 6 horas</option>
                      <option value={86400}>Uma vez por dia</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{ background: '#0a0a0b', border: '1px solid #1e1e21', color: '#8b8b96' }}
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={() => saveMutation.mutate(form as WooCommerceConfig)}
                    disabled={saveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-all"
                    style={{ background: 'linear-gradient(135deg, #d4a850, #c49040)', color: '#0a0a0b' }}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Salvar e ativar
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Done */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl p-8 text-center"
                style={{ background: '#111113', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(34,197,94,0.1)' }}
                >
                  <CheckCircle2 className="w-8 h-8" style={{ color: '#22c55e' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#f0f0f2' }}>
                  WooCommerce conectado!
                </h3>
                <p className="text-sm" style={{ color: '#8b8b96' }}>
                  Sua loja está sincronizando. Produtos e avaliações aparecerão
                  em instantes.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

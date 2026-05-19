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
import { format, formatDistanceToNow } from 'date-fns'
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
                    ? 'var(--ur-success)'
                    : i === current
                    ? 'var(--ur-accent-soft-3)'
                    : 'var(--ur-surface-soft)',
                border: `2px solid ${i < current ? 'var(--ur-success)' : i === current ? 'var(--ur-accent)' : 'var(--ur-border-strong)'}`,
                color:
                  i < current ? '#fff' : i === current ? 'var(--ur-accent)' : 'var(--ur-text-muted)',
              }}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className="text-xs mt-1 whitespace-nowrap"
              style={{
                color:
                  i < current ? 'var(--ur-success)' : i === current ? 'var(--ur-accent)' : 'var(--ur-text-muted)',
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
                background: i < current ? 'var(--ur-success)' : 'var(--ur-border-strong)',
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
  const { getToken, isAuthenticated, isLoading: authLoading } = useAuth()

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
    enabled: isAuthenticated,
    retry: false,
  })

  const saveMutation = useMutation({
    mutationFn: (data: WooCommerceConfig) =>
      api.integrations.woocommerce.save(data, getToken()),
    onSuccess: (result) => {
      const probe = result?.probe
      if (probe && !probe.success) {
        toast.error(
          `Salvo, mas conexão falhou: ${probe.error || 'verifique credenciais'}`
        )
        return
      }
      toast.success('Integração ativada — sincronização iniciada')
      setStep(4)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar configuração'
      const issues = (err as { issues?: string[] })?.issues
      toast.error(issues?.length ? `${msg}: ${issues.join(', ')}` : msg)
    },
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
      const result = await api.integrations.woocommerce.test(
        {
          store_url: form.store_url,
          consumer_key: form.consumer_key,
          consumer_secret: form.consumer_secret,
        },
        getToken()
      )
      setTestResult(result)
      if (result.success) {
        setTimeout(() => setStep(3), 800)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha na conexão'
      setTestResult({ success: false, message: msg })
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
    background: 'var(--ur-bg-soft)',
    border: '1px solid var(--ur-surface-soft)',
    color: 'var(--ur-text)',
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all'

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--ur-accent)' }} />
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
              style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-success-bg)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--ur-success-bg)' }}
                >
                  <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--ur-success)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
                    Conectado
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                    {config.store_url}
                  </p>
                </div>
              </div>

              {config.webhooks && config.webhooks.registered_count > 0 && (
                <p
                  className="text-xs mb-4"
                  style={{ color: 'var(--ur-text-muted)' }}
                >
                  Webhooks: {config.webhooks.registered_count} registrado
                  {config.webhooks.registered_count === 1 ? '' : 's'} automaticamente
                  {config.webhooks.registered_at ? (
                    <>
                      {' '}
                      <span style={{ color: 'var(--ur-text-soft)' }}>
                        · Última verificação:{' '}
                        {formatDistanceToNow(new Date(config.webhooks.registered_at), {
                          locale: ptBR,
                          addSuffix: true,
                        })}
                      </span>
                    </>
                  ) : null}
                </p>
              )}

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
                    <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                      {label}
                    </p>
                    <p className="text-lg font-bold" style={{ color: 'var(--ur-text)' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ur-text)' }}>
                Sincronização
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: 'var(--ur-accent-soft)',
                    border: '1px solid var(--ur-accent-soft-3)',
                    color: 'var(--ur-accent)',
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
                    background: 'var(--ur-bg)',
                    border: '1px solid var(--ur-border)',
                    color: 'var(--ur-text-soft)',
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
                background: 'var(--ur-danger-bg)',
                border: '1px solid var(--ur-danger-bg)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--ur-danger)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-danger)' }}>
                  Zona de perigo
                </h3>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--ur-text-soft)' }}>
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
                  background: 'var(--ur-danger-bg)',
                  border: '1px solid var(--ur-danger-bg)',
                  color: 'var(--ur-danger)',
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
                style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
              >
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
                  Informe a URL da sua loja
                </h3>
                <p className="text-sm mb-5" style={{ color: 'var(--ur-text-muted)' }}>
                  Esta é a URL da sua loja WooCommerce.
                </p>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
                  URL da loja
                </label>
                <input
                  {...field('store_url')}
                  placeholder="https://sualoja.com"
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.border = '1px solid var(--ur-accent-soft-3)' }}
                  onBlur={(e) => { e.target.style.border = '1px solid var(--ur-surface-soft)' }}
                />
                <button
                  onClick={() => {
                    const raw = form.store_url?.trim() ?? ''
                    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
                    const stripped = normalized.replace(/\/+$/, '')
                    try {
                      new URL(stripped)
                    } catch {
                      toast.error('URL inválida. Use o formato https://sualoja.com')
                      return
                    }
                    setForm((f) => ({ ...f, store_url: stripped }))
                    setStep(1)
                  }}
                  disabled={!form.store_url?.trim()}
                  className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))', color: 'var(--ur-text-on-accent)' }}
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
                style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
              >
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
                  Chaves de API do WooCommerce
                </h3>
                <p className="text-sm mb-2" style={{ color: 'var(--ur-text-muted)' }}>
                  Vá em WooCommerce → Configurações → Avançado → API REST para gerar as chaves.
                </p>
                <a
                  href={`${form.store_url}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs mb-5"
                  style={{ color: 'var(--ur-accent)' }}
                >
                  Abrir configurações da API do WooCommerce <ExternalLink className="w-3 h-3" />
                </a>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
                      Consumer Key
                    </label>
                    <input
                      {...field('consumer_key')}
                      placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className={inputClass}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.border = '1px solid var(--ur-accent-soft-3)' }}
                      onBlur={(e) => { e.target.style.border = '1px solid var(--ur-surface-soft)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
                      Consumer Secret
                    </label>
                    <input
                      type="password"
                      {...field('consumer_secret')}
                      placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className={inputClass}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.border = '1px solid var(--ur-accent-soft-3)' }}
                      onBlur={(e) => { e.target.style.border = '1px solid var(--ur-surface-soft)' }}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setStep(0)}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text-soft)' }}
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!form.consumer_key?.trim() || !form.consumer_secret?.trim()}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
                    style={{ background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))', color: 'var(--ur-text-on-accent)' }}
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
                style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
              >
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
                  Testar conexão
                </h3>
                <p className="text-sm mb-5" style={{ color: 'var(--ur-text-muted)' }}>
                  Verifique se as credenciais da API funcionam corretamente.
                </p>

                {testResult && (
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-lg mb-4"
                    style={{
                      background: testResult.success
                        ? 'var(--ur-success-bg)'
                        : 'var(--ur-danger-bg)',
                      border: `1px solid ${testResult.success ? 'var(--ur-success-bg)' : 'var(--ur-danger-bg)'}`,
                    }}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--ur-success)' }} />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--ur-danger)' }} />
                    )}
                    <p
                      className="text-sm"
                      style={{ color: testResult.success ? 'var(--ur-success)' : 'var(--ur-danger)' }}
                    >
                      {testResult.success
                        ? (testResult.message || `Conectado${(testResult as { store_name?: string }).store_name ? ` a ${(testResult as { store_name?: string }).store_name}` : ''}`)
                        : (testResult.message || (testResult as { error?: string }).error || 'Falha na conexão. Verifique URL e credenciais.')}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text-soft)' }}
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-all"
                    style={{ background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))', color: 'var(--ur-text-on-accent)' }}
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
                style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-border)' }}
              >
                <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--ur-text)' }}>
                  Configurar sincronização
                </h3>
                <p className="text-sm mb-5" style={{ color: 'var(--ur-text-muted)' }}>
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
                        style={{ accentColor: 'var(--ur-accent)' }}
                      />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
                          {label}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--ur-text-muted)' }}>
                          {desc}
                        </p>
                      </div>
                    </label>
                  ))}

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ur-text-muted)' }}>
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
                      style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-surface-soft)', color: 'var(--ur-text)' }}
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
                    style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text-soft)' }}
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={() => saveMutation.mutate(form as WooCommerceConfig)}
                    disabled={saveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-all"
                    style={{ background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))', color: 'var(--ur-text-on-accent)' }}
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
                style={{ background: 'var(--ur-surface)', border: '1px solid var(--ur-success-bg)' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'var(--ur-success-bg)' }}
                >
                  <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--ur-success)' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--ur-text)' }}>
                  WooCommerce conectado!
                </h3>
                <p className="text-sm" style={{ color: 'var(--ur-text-soft)' }}>
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

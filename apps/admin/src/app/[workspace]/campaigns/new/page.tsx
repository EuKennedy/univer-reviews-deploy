'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import {
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Info,
  Send,
  Sparkles,
  CheckCircle2,
  Loader2,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/godmode/PageHeader'
import { ActionButton } from '@/components/godmode/Toolbar'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type {
  Campaign,
  CampaignInput,
  CampaignTriggerEvent,
} from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS: {
  value: CampaignTriggerEvent
  label: string
  description: string
}[] = [
  {
    value: 'order_completed',
    label: 'Pedido concluído',
    description: 'O status do pedido virou "concluído"',
  },
  {
    value: 'order_delivered',
    label: 'Pedido entregue',
    description: 'A transportadora confirmou a entrega',
  },
  {
    value: 'order_paid',
    label: 'Pedido pago',
    description: 'O pagamento foi confirmado',
  },
  {
    value: 'order_refunded',
    label: 'Pedido reembolsado',
    description: 'Útil para pedir feedback negativo',
  },
]

const VARIABLES = [
  { key: 'customer_name', label: 'Nome do cliente', sample: 'Maria' },
  { key: 'product_name', label: 'Nome do produto', sample: 'Kit Coiffeur' },
  { key: 'store_name', label: 'Nome da loja', sample: '' /* filled at runtime */ },
  { key: 'order_total', label: 'Total do pedido', sample: 'R$ 249,00' },
  { key: 'review_link', label: 'Link da avaliação', sample: 'https://univerreviews.com/r/abc123' },
]

const STEPS = ['Gatilhos', 'Template', 'Configuração', 'Pronto']

const DEFAULT_SUBJECT = '{{customer_name}}, conta pra gente: o que achou do {{product_name}}?'
const DEFAULT_HTML = `<p>Olá {{customer_name}},</p>
<p>Esperamos que você esteja amando seu <strong>{{product_name}}</strong>!</p>
<p>Sua opinião significa muito pra nós — leva menos de 30 segundos.</p>
<p><a href="{{review_link}}" style="background:#d4a850;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Deixar avaliação</a></p>
<p>Obrigado,<br/>Equipe {{store_name}}</p>`

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const params = useParams()
  const router = useRouter()
  const workspace = params?.workspace as string
  const { getToken, isAuthenticated } = useAuth()

  const { data: workspaceData } = useQuery({
    queryKey: ['workspace', workspace],
    queryFn: () => api.workspace.get(getToken()),
    enabled: isAuthenticated && Boolean(workspace),
  })

  const storeName = workspaceData?.name ?? 'Sua Loja'

  const [step, setStep] = useState(0)
  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(null)

  // ── form state ──
  const [triggerEvents, setTriggerEvents] = useState<CampaignTriggerEvent[]>([
    'order_completed',
  ])
  const [delayValue, setDelayValue] = useState(3)
  const [delayUnit, setDelayUnit] = useState<'minutes' | 'hours' | 'days'>(
    'days',
  )

  const [name, setName] = useState('Pedir avaliação pós-compra')
  const fromName = storeName
  const fromEmail = 'noreply@univerreviews.com'
  const [replyTo, setReplyTo] = useState('suporte@univerreviews.com')
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [html, setHtml] = useState(DEFAULT_HTML)

  const [testEmail, setTestEmail] = useState('')
  const [activateImmediately, setActivateImmediately] = useState(true)

  const delayMinutes = useMemo(() => {
    if (delayUnit === 'minutes') return delayValue
    if (delayUnit === 'hours') return delayValue * 60
    return delayValue * 60 * 24
  }, [delayValue, delayUnit])

  // ── mutations ──
  const createMut = useMutation({
    mutationFn: (data: CampaignInput) => api.campaigns.create(data, getToken()),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao criar campanha'),
  })

  const testSendMut = useMutation({
    mutationFn: async () => {
      // We need a saved campaign to test-send. If we don't have one yet,
      // save the current draft first so the backend can render with real data.
      let cid = createdCampaign?.id
      if (!cid) {
        const created = await api.campaigns.create(buildInput('draft'), getToken())
        setCreatedCampaign(created)
        cid = created.id
      }
      return api.campaigns.testSend(cid, { recipient_email: testEmail }, getToken())
    },
    onSuccess: () => {
      toast.success(`Teste enviado para ${testEmail}`)
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 404) {
        toast.error('Endpoint de teste ainda não disponível')
      } else {
        toast.error(e instanceof Error ? e.message : 'Falha no envio de teste')
      }
    },
  })

  function buildInput(forcedStatus?: 'draft' | 'active'): CampaignInput {
    return {
      name: name.trim() || 'Sem nome',
      status: forcedStatus ?? (activateImmediately ? 'active' : 'draft'),
      trigger_events: triggerEvents,
      trigger_after_minutes: delayMinutes,
      from_name: fromName,
      from_email: fromEmail,
      reply_to: replyTo || null,
      subject_template: subject,
      html_template: html,
    }
  }

  const canNext =
    (step === 0 && triggerEvents.length > 0) ||
    (step === 1 &&
      name.trim().length > 0 &&
      subject.trim().length > 0 &&
      html.trim().length > 0) ||
    step === 2

  async function handleFinalize() {
    try {
      let final = createdCampaign
      if (final) {
        // PATCH the existing draft to the final state
        final = await api.campaigns.update(
          final.id,
          buildInput(),
          getToken(),
        )
      } else {
        final = await api.campaigns.create(buildInput(), getToken())
      }
      setCreatedCampaign(final)
      setStep(3)
      toast.success('Campanha criada')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Falha ao criar campanha')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Megaphone className="w-5 h-5" />}
        title="Nova campanha"
        subtitle="Email automatizado pós-compra"
        breadcrumbs={[
          { label: 'Campanhas', href: `/${workspace}/campaigns` },
          { label: 'Nova' },
        ]}
      />

      <div className="px-6 pt-6 pb-2 shrink-0">
        <StepIndicator steps={STEPS} current={step} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-4xl mx-auto">
          {step === 0 && (
            <TriggersStep
              triggerEvents={triggerEvents}
              setTriggerEvents={setTriggerEvents}
              delayValue={delayValue}
              setDelayValue={setDelayValue}
              delayUnit={delayUnit}
              setDelayUnit={setDelayUnit}
            />
          )}
          {step === 1 && (
            <TemplateStep
              storeName={storeName}
              name={name}
              setName={setName}
              fromName={fromName}
              fromEmail={fromEmail}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              subject={subject}
              setSubject={setSubject}
              html={html}
              setHtml={setHtml}
            />
          )}
          {step === 2 && (
            <ConfigStep
              testEmail={testEmail}
              setTestEmail={setTestEmail}
              onTestSend={() => testSendMut.mutate()}
              isTestSending={testSendMut.isPending}
              activate={activateImmediately}
              setActivate={setActivateImmediately}
            />
          )}
          {step === 3 && createdCampaign && (
            <DoneStep
              campaign={createdCampaign}
              workspace={workspace}
              onCreateAnother={() => {
                setCreatedCampaign(null)
                setStep(0)
              }}
              onView={() =>
                router.push(`/${workspace}/campaigns/${createdCampaign.id}`)
              }
            />
          )}

          {step < 3 && (
            <div
              className="flex items-center justify-between mt-8 pt-6"
              style={{ borderTop: '1px solid var(--ur-border)' }}
            >
              <ActionButton
                onClick={() => {
                  if (step === 0) {
                    router.push(`/${workspace}/campaigns`)
                  } else {
                    setStep((s) => Math.max(0, s - 1))
                  }
                }}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {step === 0 ? 'Cancelar' : 'Voltar'}
              </ActionButton>
              {step < 2 ? (
                <ActionButton
                  variant="primary"
                  disabled={!canNext}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Próximo
                  <ChevronRight className="w-3.5 h-3.5" />
                </ActionButton>
              ) : (
                <ActionButton
                  variant="primary"
                  disabled={createMut.isPending}
                  onClick={handleFinalize}
                >
                  {createMut.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <Sparkles className="w-3.5 h-3.5" />
                  Criar campanha
                </ActionButton>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <div className="flex items-center gap-0 justify-center flex-wrap">
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
                border: `2px solid ${
                  i < current
                    ? 'var(--ur-success)'
                    : i === current
                    ? 'var(--ur-accent)'
                    : 'var(--ur-border-strong)'
                }`,
                color:
                  i < current
                    ? 'var(--ur-text-on-accent)'
                    : i === current
                    ? 'var(--ur-accent)'
                    : 'var(--ur-text-muted)',
              }}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className="text-xs mt-1 whitespace-nowrap"
              style={{
                color:
                  i < current
                    ? 'var(--ur-success)'
                    : i === current
                    ? 'var(--ur-accent)'
                    : 'var(--ur-text-muted)',
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
                background:
                  i < current
                    ? 'var(--ur-success)'
                    : 'var(--ur-border-strong)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Triggers ────────────────────────────────────────────────────────

function TriggersStep({
  triggerEvents,
  setTriggerEvents,
  delayValue,
  setDelayValue,
  delayUnit,
  setDelayUnit,
}: {
  triggerEvents: CampaignTriggerEvent[]
  setTriggerEvents: (v: CampaignTriggerEvent[]) => void
  delayValue: number
  setDelayValue: (v: number) => void
  delayUnit: 'minutes' | 'hours' | 'days'
  setDelayUnit: (v: 'minutes' | 'hours' | 'days') => void
}) {
  const toggle = (ev: CampaignTriggerEvent) => {
    setTriggerEvents(
      triggerEvents.includes(ev)
        ? triggerEvents.filter((x) => x !== ev)
        : [...triggerEvents, ev],
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quando disparar?"
        description="Selecione um ou mais eventos do pedido. O email é disparado depois do delay configurado abaixo."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TRIGGER_OPTIONS.map((opt) => {
          const checked = triggerEvents.includes(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className="text-left rounded-xl p-4 transition-all"
              style={{
                background: checked ? 'var(--ur-accent-soft)' : 'var(--ur-surface)',
                border: `1px solid ${
                  checked ? 'var(--ur-accent-soft-3)' : 'var(--ur-border)'
                }`,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: checked
                      ? 'var(--ur-accent)'
                      : 'var(--ur-bg)',
                    border: `1px solid ${
                      checked ? 'var(--ur-accent)' : 'var(--ur-border-strong)'
                    }`,
                  }}
                >
                  {checked && (
                    <CheckCircle2
                      className="w-3 h-3"
                      style={{ color: 'var(--ur-text-on-accent)' }}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: checked ? 'var(--ur-accent)' : 'var(--ur-text)',
                    }}
                  >
                    {opt.label}
                  </p>
                  <p
                    className="ur-caption mt-0.5"
                    style={{ color: 'var(--ur-text-muted)' }}
                  >
                    {opt.description}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <InfoBox>
        <strong>Anti-duplicação ativa.</strong> Se o mesmo pedido disparar
        múltiplos eventos selecionados, o cliente recebe <em>apenas 1 email</em>{' '}
        (deduplicação por pedido + email).
      </InfoBox>

      <div>
        <SectionHeader
          title="Quando enviar?"
          description="O delay começa a contar a partir do evento disparado."
        />
        <div className="flex items-center gap-2 mt-3 max-w-md">
          <input
            type="number"
            min={0}
            value={delayValue}
            onChange={(e) => setDelayValue(Math.max(0, Number(e.target.value) || 0))}
            className="text-sm rounded-lg p-2.5 outline-none w-24"
            style={{
              background: 'var(--ur-bg)',
              border: '1px solid var(--ur-border)',
              color: 'var(--ur-text)',
            }}
          />
          <select
            value={delayUnit}
            onChange={(e) =>
              setDelayUnit(e.target.value as 'minutes' | 'hours' | 'days')
            }
            className="text-sm rounded-lg p-2.5 outline-none cursor-pointer"
            style={{
              background: 'var(--ur-bg)',
              border: '1px solid var(--ur-border)',
              color: 'var(--ur-text)',
            }}
          >
            <option value="minutes">minutos</option>
            <option value="hours">horas</option>
            <option value="days">dias</option>
          </select>
          <span className="ur-body-soft">depois do evento</span>
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Template ────────────────────────────────────────────────────────

function TemplateStep({
  storeName,
  name,
  setName,
  fromName,
  fromEmail,
  replyTo,
  setReplyTo,
  subject,
  setSubject,
  html,
  setHtml,
}: {
  storeName: string
  name: string
  setName: (v: string) => void
  fromName: string
  fromEmail: string
  replyTo: string
  setReplyTo: (v: string) => void
  subject: string
  setSubject: (v: string) => void
  html: string
  setHtml: (v: string) => void
}) {
  const [subjectFocus, setSubjectFocus] = useState(false)

  const insertVariable = (target: 'subject' | 'html', key: string) => {
    const token = `{{${key}}}`
    if (target === 'subject') setSubject(`${subject}${token}`.slice(0, 300))
    else setHtml(`${html}${token}`)
  }

  // Render preview by replacing {{var}} with sample values
  const rendered = useMemo(() => {
    const replace = (s: string) => {
      let out = s
      for (const v of VARIABLES) {
        const sample = v.key === 'store_name' ? storeName : v.sample
        out = out.replaceAll(`{{${v.key}}}`, sample)
      }
      return out
    }
    return { subject: replace(subject), html: replace(html) }
  }, [subject, html, storeName])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Conteúdo do email"
        description="Use placeholders {{...}} para personalizar com dados reais do pedido."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Form ── */}
        <div className="space-y-4">
          <Field label="Nome interno da campanha" htmlFor="new-campaign-name">
            <input
              id="new-campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pedir avaliação pós-compra"
              className="w-full text-sm rounded-lg p-2.5 outline-none"
              style={{
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text)',
              }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From name" htmlFor="new-campaign-from-name">
              <input
                id="new-campaign-from-name"
                readOnly
                value={fromName}
                className="w-full text-sm rounded-lg p-2.5 outline-none cursor-not-allowed"
                style={{
                  background: 'var(--ur-surface-soft)',
                  border: '1px solid var(--ur-border)',
                  color: 'var(--ur-text-muted)',
                }}
              />
            </Field>
            <Field label="From email" htmlFor="new-campaign-from-email">
              <input
                id="new-campaign-from-email"
                readOnly
                value={fromEmail}
                className="w-full text-sm rounded-lg p-2.5 outline-none cursor-not-allowed font-mono"
                style={{
                  background: 'var(--ur-surface-soft)',
                  border: '1px solid var(--ur-border)',
                  color: 'var(--ur-text-muted)',
                }}
              />
            </Field>
          </div>

          <Field label="Reply-to" htmlFor="new-campaign-reply-to">
            <input
              id="new-campaign-reply-to"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="suporte@suaempresa.com"
              className="w-full text-sm rounded-lg p-2.5 outline-none font-mono"
              style={{
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text)',
              }}
            />
          </Field>

          <Field label="Assunto" htmlFor="new-campaign-subject">
            <input
              id="new-campaign-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setSubjectFocus(true)}
              onBlur={() => setTimeout(() => setSubjectFocus(false), 200)}
              placeholder="{{customer_name}}, conta pra gente…"
              className="w-full text-sm rounded-lg p-2.5 outline-none"
              style={{
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text)',
              }}
            />
            <VariableChips
              onInsert={(k) => insertVariable('subject', k)}
              compact
            />
          </Field>

          <Field label="Corpo (HTML)" htmlFor="new-campaign-html">
            <textarea
              id="new-campaign-html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={12}
              spellCheck={false}
              className="w-full text-xs rounded-lg p-3 outline-none resize-y font-mono"
              style={{
                background: 'var(--ur-bg)',
                border: '1px solid var(--ur-border)',
                color: 'var(--ur-text)',
                minHeight: 240,
              }}
            />
            <VariableChips onInsert={(k) => insertVariable('html', k)} />
          </Field>
        </div>

        {/* ── Preview ── */}
        <div className="space-y-3">
          <p className="ur-overline">Pré-visualização</p>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: 'var(--ur-surface)',
              border: '1px solid var(--ur-border)',
              boxShadow: 'var(--ur-shadow-sm)',
            }}
          >
            <div
              className="px-4 py-3"
              style={{
                background: 'var(--ur-bg-soft)',
                borderBottom: '1px solid var(--ur-border)',
              }}
            >
              <p
                className="text-xs"
                style={{ color: 'var(--ur-text-muted)' }}
              >
                De{' '}
                <span style={{ color: 'var(--ur-text)' }}>
                  {fromName} &lt;{fromEmail}&gt;
                </span>
              </p>
              <p
                className="text-sm font-semibold mt-1"
                style={{ color: 'var(--ur-text)' }}
              >
                {rendered.subject}
              </p>
            </div>
            <div
              className="p-4 text-sm"
              style={{ color: 'var(--ur-text)', minHeight: 200 }}
              // Preview is sandboxed by being plain string from our state and
              // never user-uploaded HTML; same trust level as the form input.
              dangerouslySetInnerHTML={{ __html: rendered.html }}
            />
          </div>

          <div
            className="rounded-lg p-3"
            style={{
              background: 'var(--ur-surface-soft)',
              border: '1px solid var(--ur-border)',
            }}
          >
            <p
              className="text-xs font-semibold mb-2 uppercase tracking-wider"
              style={{ color: 'var(--ur-text-soft)' }}
            >
              Variáveis disponíveis
            </p>
            <ul className="space-y-1.5">
              {VARIABLES.map((v) => (
                <li
                  key={v.key}
                  className="flex items-baseline justify-between gap-3"
                >
                  <code
                    className="text-[11px] font-mono"
                    style={{ color: 'var(--ur-accent)' }}
                  >
                    {`{{${v.key}}}`}
                  </code>
                  <span
                    className="ur-caption text-right truncate"
                    style={{ color: 'var(--ur-text-muted)' }}
                  >
                    {v.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {subjectFocus && null}
    </div>
  )
}

function VariableChips({
  onInsert,
  compact,
}: {
  onInsert: (key: string) => void
  compact?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {VARIABLES.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onInsert(v.key)}
          className="text-[11px] font-mono px-2 py-0.5 rounded-full transition-colors"
          style={{
            background: 'var(--ur-accent-soft)',
            border: '1px solid var(--ur-accent-soft-2)',
            color: 'var(--ur-accent)',
          }}
          title={v.label}
        >
          {compact ? `{{${v.key}}}` : `+ {{${v.key}}}`}
        </button>
      ))}
    </div>
  )
}

// ─── Step 3: Config ──────────────────────────────────────────────────────────

function ConfigStep({
  testEmail,
  setTestEmail,
  onTestSend,
  isTestSending,
  activate,
  setActivate,
}: {
  testEmail: string
  setTestEmail: (v: string) => void
  onTestSend: () => void
  isTestSending: boolean
  activate: boolean
  setActivate: (v: boolean) => void
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader
        title="Envio de teste"
        description="Envia uma cópia exata para este email com dados de exemplo."
      />

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label htmlFor="new-campaign-test-email" className="sr-only">
            Email para o envio de teste
          </label>
          <input
            id="new-campaign-test-email"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full text-sm rounded-lg p-2.5 outline-none"
            style={{
              background: 'var(--ur-bg)',
              border: '1px solid var(--ur-border)',
              color: 'var(--ur-text)',
            }}
          />
        </div>
        <ActionButton
          variant="primary"
          disabled={!testEmail.includes('@') || isTestSending}
          onClick={onTestSend}
          aria-label="Enviar teste para email"
        >
          {isTestSending && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              <span className="sr-only" role="status">Enviando…</span>
            </>
          )}
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          Enviar teste
        </ActionButton>
      </div>

      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background: 'var(--ur-surface)',
          border: '1px solid var(--ur-border)',
        }}
      >
        <label className="flex items-start gap-3 cursor-pointer flex-1">
          <input
            type="checkbox"
            checked={activate}
            onChange={(e) => setActivate(e.target.checked)}
            className="mt-1 accent-[var(--ur-accent)]"
          />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
              Ativar imediatamente após criar
            </p>
            <p className="ur-caption mt-0.5">
              A campanha começa a disparar para pedidos que se encaixam nas
              regras assim que você confirmar. Desmarque para salvar como
              rascunho.
            </p>
          </div>
        </label>
      </div>
    </div>
  )
}

// ─── Step 4: Done ────────────────────────────────────────────────────────────

function DoneStep({
  campaign,
  workspace: _workspace,
  onView,
  onCreateAnother,
}: {
  campaign: Campaign
  workspace: string
  onView: () => void
  onCreateAnother: () => void
}) {
  return (
    <div className="py-12 flex flex-col items-center text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background:
            'linear-gradient(135deg, var(--ur-success), rgba(22, 163, 74, 0.7))',
          boxShadow: '0 0 40px rgba(22, 163, 74, 0.3)',
        }}
      >
        <CheckCircle2
          className="w-8 h-8"
          style={{ color: 'var(--ur-text-on-accent)' }}
        />
      </div>
      <h2 className="ur-h2 mb-2">Tudo pronto</h2>
      <p
        className="ur-body-soft max-w-md mb-6"
        style={{ color: 'var(--ur-text-muted)' }}
      >
        <strong style={{ color: 'var(--ur-text)' }}>{campaign.name}</strong>{' '}
        {campaign.status === 'active'
          ? 'já está ativa e vai começar a disparar para os próximos pedidos.'
          : 'foi salva como rascunho. Ative quando quiser começar a disparar.'}
      </p>
      <div className="flex items-center gap-2">
        <ActionButton onClick={onCreateAnother}>
          <Plus className="w-3.5 h-3.5" />
          Criar outra
        </ActionButton>
        <ActionButton variant="primary" onClick={onView}>
          Ver campanha
          <ChevronRight className="w-3.5 h-3.5" />
        </ActionButton>
      </div>
    </div>
  )
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <h2 className="ur-h3" style={{ color: 'var(--ur-text)' }}>
        {title}
      </h2>
      {description && <p className="ur-body-soft mt-1">{description}</p>}
    </div>
  )
}

/**
 * Form field wrapper — uses `<label>` so the child input is associated by
 * proximity. When the child is a complex input (e.g. textarea, button group)
 * the htmlFor needs to be explicit; callers pass `htmlFor` so the label
 * properly targets the descendant. This guarantees a programmatic
 * label/input association for SR users on every form control in the flow.
 */
function Field({
  label,
  children,
  htmlFor,
}: {
  label: string
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="ur-overline block mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{
        background: 'var(--ur-accent-soft)',
        border: '1px solid var(--ur-accent-soft-2)',
      }}
    >
      <Info
        className="w-4 h-4 mt-0.5 shrink-0"
        style={{ color: 'var(--ur-accent)' }}
      />
      <p className="text-sm" style={{ color: 'var(--ur-text)' }}>
        {children}
      </p>
    </div>
  )
}

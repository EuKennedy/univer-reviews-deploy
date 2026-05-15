'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { FlaskConical, Sparkles, Loader2, Copy, CheckCircle2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/godmode/PageHeader'
import { AiScoreGauge } from '@/components/ai/AiScoreGauge'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { AiModerateResult, ReviewVariant } from '@/types'

type Tab = 'moderate' | 'generate' | 'reply' | 'dedup'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'moderate', label: 'Moderar', icon: '🛡️' },
  { id: 'generate', label: 'Gerar', icon: '✨' },
  { id: 'reply', label: 'Responder', icon: '💬' },
  { id: 'dedup', label: 'Duplicatas', icon: '🔍' },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all"
      style={{
        background: copied ? 'rgba(34,197,94,0.1)' : '#1a1a1d',
        color: copied ? '#22c55e' : '#5a5a64',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : '#2a2a2d'}`,
      }}
    >
      {copied ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function ModerateTab() {
  const { getToken } = useAuth()
  const [text, setText] = useState('')
  const [reviewId, setReviewId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AiModerateResult | null>(null)

  const handleModerate = async () => {
    if (!reviewId.trim()) {
      toast.error('Informe um ID de avaliação')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await api.ai.moderate(reviewId, getToken())
      setResult(res)
    } catch {
      toast.error('Falha na moderação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: '#5a5a64' }}>
          ID da avaliação
        </label>
        <input
          value={reviewId}
          onChange={(e) => setReviewId(e.target.value)}
          placeholder="Informe o UUID da avaliação…"
          className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all mb-3"
          style={{
            background: '#0d0d0f',
            border: '1px solid #1a1a1d',
            color: '#f0f0f2',
          }}
          onFocus={(e) => { e.target.style.border = '1px solid rgba(212,168,80,0.3)' }}
          onBlur={(e) => { e.target.style.border = '1px solid #1a1a1d' }}
        />
        <label className="block text-xs font-medium mb-2" style={{ color: '#5a5a64' }}>
          Texto da avaliação (prévia)
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cole o texto da avaliação para prévia…"
          rows={6}
          className="w-full px-4 py-3 rounded-lg text-sm resize-none outline-none transition-all mb-3"
          style={{
            background: '#0d0d0f',
            border: '1px solid #1a1a1d',
            color: '#f0f0f2',
          }}
          onFocus={(e) => { e.target.style.border = '1px solid rgba(212,168,80,0.3)' }}
          onBlur={(e) => { e.target.style.border = '1px solid #1a1a1d' }}
        />
        <button
          onClick={handleModerate}
          disabled={loading || !reviewId.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, #d4a850, #c49040)',
            color: '#0a0a0b',
          }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Executar moderação
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl p-5"
            style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
                Resultado
              </h3>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium capitalize"
                style={{
                  background:
                    result.recommendation === 'approve'
                      ? 'rgba(34,197,94,0.1)'
                      : result.recommendation === 'reject'
                      ? 'rgba(239,68,68,0.1)'
                      : 'rgba(245,158,11,0.1)',
                  color:
                    result.recommendation === 'approve'
                      ? '#22c55e'
                      : result.recommendation === 'reject'
                      ? '#ef4444'
                      : '#f59e0b',
                  border: `1px solid ${result.recommendation === 'approve' ? 'rgba(34,197,94,0.2)' : result.recommendation === 'reject' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}
              >
                {result.recommendation}
              </span>
            </div>

            <div className="flex justify-center mb-5">
              <AiScoreGauge score={result.quality_score} size={96} />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span style={{ color: '#5a5a64' }}>Sentimento</span>
                <span className="capitalize font-medium" style={{ color: '#f0f0f2' }}>
                  {result.sentiment}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#5a5a64' }}>Sintético</span>
                <span
                  className="font-medium"
                  style={{ color: result.is_synthetic ? '#ef4444' : '#22c55e' }}
                >
                  {result.is_synthetic
                    ? `Sim (${Math.round(result.synthetic_confidence * 100)}%)`
                    : 'Não'}
                </span>
              </div>
            </div>

            {result.topics.length > 0 && (
              <div className="mt-4">
                <p className="text-xs mb-2" style={{ color: '#5a5a64' }}>Tópicos</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.topics.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(212,168,80,0.08)',
                        color: '#d4a850',
                        border: '1px solid rgba(212,168,80,0.15)',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.moderation_flags.length > 0 && (
              <div className="mt-3">
                <p className="text-xs mb-2" style={{ color: '#5a5a64' }}>Sinalizações</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.moderation_flags.map((f) => (
                    <span
                      key={f}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(239,68,68,0.08)',
                        color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.15)',
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GenerateTab() {
  const { getToken } = useAuth()
  const [productName, setProductName] = useState('')
  const [rating, setRating] = useState(5)
  const [count, setCount] = useState(3)
  const [tone, setTone] = useState('authentic')
  const [loading, setLoading] = useState(false)
  const [variants, setVariants] = useState<ReviewVariant[]>([])

  const handleGenerate = async () => {
    if (!productName.trim()) {
      toast.error('Informe o nome do produto')
      return
    }
    setLoading(true)
    setVariants([])
    try {
      const res = await api.ai.generateVariants(
        { product_name: productName, rating, tone, count },
        getToken()
      )
      setVariants(res.variants)
    } catch {
      toast.error('Falha na geração')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
            Nome do produto
          </label>
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="iPhone 15 Pro…"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all mb-3"
            style={{ background: '#0d0d0f', border: '1px solid #1a1a1d', color: '#f0f0f2' }}
            onFocus={(e) => { e.target.style.border = '1px solid rgba(212,168,80,0.3)' }}
            onBlur={(e) => { e.target.style.border = '1px solid #1a1a1d' }}
          />

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
                Nota
              </label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0d0d0f', border: '1px solid #1a1a1d', color: '#f0f0f2' }}
              >
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{r} ⭐</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
                Quantidade
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0d0d0f', border: '1px solid #1a1a1d', color: '#f0f0f2' }}
              />
            </div>
          </div>

          <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
            Tom
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none mb-4"
            style={{ background: '#0d0d0f', border: '1px solid #1a1a1d', color: '#f0f0f2' }}
          >
            {[
              { value: 'authentic', label: 'Autêntico' },
              { value: 'enthusiastic', label: 'Entusiasmado' },
              { value: 'critical', label: 'Crítico' },
              { value: 'casual', label: 'Casual' },
              { value: 'formal', label: 'Formal' },
            ].map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #d4a850, #c49040)', color: '#0a0a0b' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar {count} variantes
          </button>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {loading
            ? Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton h-20 w-full rounded-xl" />
              ))
            : variants.map((v, i) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl p-4"
                  style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: '#8b8b96' }}>
                        {v.author_name}
                      </span>
                      <span className="text-xs" style={{ color: '#5a5a64' }}>
                        {'⭐'.repeat(v.rating)}
                      </span>
                    </div>
                    <CopyButton text={v.body} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#8b8b96' }}>
                    {v.body}
                  </p>
                </motion.div>
              ))}
        </div>
      </div>
    </div>
  )
}

function ReplyTab() {
  const { getToken } = useAuth()
  const [reviewId, setReviewId] = useState('')
  const [tone, setTone] = useState('professional')
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState('')

  const handleGenerate = async () => {
    if (!reviewId.trim()) {
      toast.error('Informe um ID de avaliação')
      return
    }
    setLoading(true)
    setReply('')
    try {
      const res = await api.ai.autoReply(reviewId, tone, getToken())
      setReply(res.reply)
    } catch {
      toast.error('Falha ao gerar resposta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
            ID da avaliação
          </label>
          <input
            value={reviewId}
            onChange={(e) => setReviewId(e.target.value)}
            placeholder="Informe o UUID da avaliação…"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{ background: '#0d0d0f', border: '1px solid #1a1a1d', color: '#f0f0f2' }}
            onFocus={(e) => { e.target.style.border = '1px solid rgba(212,168,80,0.3)' }}
            onBlur={(e) => { e.target.style.border = '1px solid #1a1a1d' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a64' }}>
            Tom
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'professional', label: 'Profissional' },
              { value: 'friendly', label: 'Amigável' },
              { value: 'empathetic', label: 'Empático' },
              { value: 'formal', label: 'Formal' },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className="py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: tone === t.value ? 'rgba(212,168,80,0.1)' : '#0d0d0f',
                  border: `1px solid ${tone === t.value ? 'rgba(212,168,80,0.3)' : '#1a1a1d'}`,
                  color: tone === t.value ? '#d4a850' : '#8b8b96',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #d4a850, #c49040)', color: '#0a0a0b' }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Gerar resposta
        </button>
      </div>

      <AnimatePresence>
        {reply && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl p-4"
            style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium" style={{ color: '#5a5a64' }}>Resposta gerada</p>
              <CopyButton text={reply} />
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#c0c0c8' }}>{reply}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DedupTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(212,168,80,0.08)', border: '1px solid rgba(212,168,80,0.15)' }}
      >
        <span className="text-2xl">🔍</span>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: '#f0f0f2' }}>Análise de duplicatas</p>
        <p className="text-xs mt-1" style={{ color: '#5a5a64' }}>
          Use a{' '}
          <a
            href="../duplicates"
            style={{ color: '#d4a850' }}
            className="underline underline-offset-2"
          >
            página de Duplicatas
          </a>{' '}
          para gerenciar clusters completos
        </p>
      </div>
    </div>
  )
}

const tabComponents: Record<Tab, React.ComponentType> = {
  moderate: ModerateTab,
  generate: GenerateTab,
  reply: ReplyTab,
  dedup: DedupTab,
}

export default function AiLabPage() {
  const [activeTab, setActiveTab] = useState<Tab>('moderate')
  const [tokenCount] = useState(0)

  const TabContent = tabComponents[activeTab]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<FlaskConical className="w-5 h-5" />}
        title="Lab de IA"
        subtitle="Playground para recursos de avaliações com IA"
        actions={
          <div
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: '#0d0d0f', border: '1px solid #1a1a1d' }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#d4a850' }} />
            <span style={{ color: '#5a5a64' }}>Sessão:</span>
            <span style={{ color: '#f0f0f2' }}>{tokenCount} tokens</span>
          </div>
        }
      />

      <div
        className="flex items-center gap-1 px-5 py-3"
        style={{ borderBottom: '1px solid #1e1e21' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{
              background: activeTab === tab.id ? 'rgba(212,168,80,0.1)' : 'transparent',
              border: `1px solid ${activeTab === tab.id ? 'rgba(212,168,80,0.2)' : 'transparent'}`,
              color: activeTab === tab.id ? '#d4a850' : '#8b8b96',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <TabContent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * TopicSkeleton — pulsing placeholder card with a rotating loading caption
 * to communicate that Claude is actively extracting topics. Replaces the
 * generic "carregando…" spinner so the merchant feels work happening.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const CAPTIONS = [
  'Lendo avaliações…',
  'Encontrando padrões…',
  'Agrupando opiniões similares…',
  'Identificando tópicos recorrentes…',
  'Escrevendo títulos em português…',
  'Selecionando avaliações destaque…',
  'Finalizando o sumário…',
]

export function TopicSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <StatusCaption />
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} delay={i * 0.08} />
        ))}
      </div>
    </div>
  )
}

function StatusCaption() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % CAPTIONS.length), 2200)
    return () => clearInterval(t)
  }, [])
  return (
    <div
      className="relative flex items-center gap-3 px-5 py-4 rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(168, 85, 247, 0.04) 60%, var(--ur-accent-soft-2))',
        border: '1px solid rgba(168, 85, 247, 0.35)',
        boxShadow: '0 8px 24px rgba(168, 85, 247, 0.18), 0 0 0 1px rgba(168, 85, 247, 0.1)',
      }}
    >
      {/* Soft moving glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(circle at 30% 50%, rgba(168, 85, 247, 0.45), transparent 60%)',
        }}
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        className="relative shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
          boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)',
        }}
      >
        <Sparkles className="w-4 h-4" style={{ color: '#fff' }} />
      </motion.div>
      <div className="relative flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#c084fc' }}>
          Extraindo com IA
        </p>
        <motion.p
          key={CAPTIONS[idx]}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4 }}
          className="text-sm font-medium"
          style={{ color: 'var(--ur-text)' }}
        >
          {CAPTIONS[idx]}
        </motion.p>
      </div>
      <span
        className="relative text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full"
        style={{
          background: 'rgba(168, 85, 247, 0.18)',
          color: '#c084fc',
          border: '1px solid rgba(168, 85, 247, 0.3)',
        }}
      >
        ~30s
      </span>
    </div>
  )
}

function SkeletonCard({ delay }: { delay: number }) {
  // Width hint creates rhythm — each skeleton looks like a real topic with
  // slightly different title length.
  const titleWidths = ['68%', '52%', '76%', '60%']
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl p-4 overflow-hidden relative"
      style={{
        // Brighter than --ur-bg-soft so the card stands out from the page bg
        // in both light AND dark mode. mix-blend keeps it consistent.
        background: 'color-mix(in srgb, var(--ur-text) 5%, var(--ur-bg-soft))',
        border: '1px solid color-mix(in srgb, var(--ur-text) 15%, var(--ur-border))',
      }}
    >
      <Shimmer />
      <div className="flex items-center gap-3 relative">
        <div
          className="h-5 w-14 rounded-md shrink-0"
          style={{ background: 'color-mix(in srgb, var(--ur-text) 18%, transparent)' }}
        />
        <div
          className="h-4 rounded-md"
          style={{
            width: titleWidths[Math.floor(delay * 12) % titleWidths.length],
            background: 'color-mix(in srgb, var(--ur-text) 22%, transparent)',
          }}
        />
        <div
          className="ml-auto h-3 w-16 rounded-md"
          style={{ background: 'color-mix(in srgb, var(--ur-text) 12%, transparent)' }}
        />
      </div>
      <div className="mt-3 space-y-2 relative">
        <div
          className="h-2.5 rounded"
          style={{ width: '88%', background: 'color-mix(in srgb, var(--ur-text) 12%, transparent)' }}
        />
        <div
          className="h-2.5 rounded"
          style={{ width: '64%', background: 'color-mix(in srgb, var(--ur-text) 12%, transparent)' }}
        />
      </div>
    </motion.div>
  )
}

function Shimmer() {
  return (
    <motion.div
      className="absolute inset-y-0 -inset-x-1 pointer-events-none"
      style={{
        background:
          'linear-gradient(110deg, transparent 30%, color-mix(in srgb, var(--ur-text) 22%, transparent) 50%, transparent 70%)',
      }}
      animate={{ x: ['-100%', '100%'] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

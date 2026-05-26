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
      className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
      style={{
        background: 'linear-gradient(135deg, var(--ur-accent-glow), transparent)',
        border: '1px solid var(--ur-accent-soft-2)',
      }}
    >
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        className="shrink-0"
      >
        <Sparkles className="w-4 h-4" style={{ color: 'var(--ur-accent)' }} />
      </motion.div>
      <motion.p
        key={CAPTIONS[idx]}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.4 }}
        className="text-sm font-medium tabular-nums"
        style={{ color: 'var(--ur-text)' }}
      >
        {CAPTIONS[idx]}
      </motion.p>
      <span className="ml-auto text-xs" style={{ color: 'var(--ur-text-muted)' }}>
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
        background: 'var(--ur-bg-soft)',
        border: '1px solid var(--ur-border)',
      }}
    >
      <Shimmer />
      <div className="flex items-center gap-3 relative">
        <div className="h-5 w-12 rounded-md shrink-0" style={{ background: 'var(--ur-skeleton-2)' }} />
        <div className="h-4 rounded-md" style={{ width: titleWidths[Math.floor(delay * 12) % titleWidths.length], background: 'var(--ur-skeleton-2)' }} />
        <div className="ml-auto h-3 w-16 rounded-md" style={{ background: 'var(--ur-skeleton-1)' }} />
      </div>
      <div className="mt-3 space-y-1.5 relative">
        <div className="h-2.5 rounded" style={{ width: '88%', background: 'var(--ur-skeleton-1)' }} />
        <div className="h-2.5 rounded" style={{ width: '64%', background: 'var(--ur-skeleton-1)' }} />
      </div>
    </motion.div>
  )
}

function Shimmer() {
  return (
    <motion.div
      className="absolute inset-y-0 -inset-x-1 pointer-events-none"
      style={{
        background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)',
        mixBlendMode: 'overlay',
      }}
      animate={{ x: ['-100%', '100%'] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

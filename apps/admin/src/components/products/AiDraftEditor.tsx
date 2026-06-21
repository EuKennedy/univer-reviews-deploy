'use client'

/**
 * AiDraftEditor — premium review/Q&A draft editor.
 *
 * After "Gerar com IA" persists a batch as `draft` (hidden from the
 * storefront AND the pending queue), this surfaces the batch as an
 * expandable, fully-editable list. The operator can fix the stars, body,
 * title, author name, gender (fixes the "nome masculino + sexo feminino"
 * mismatch) and avatar photo on each one, then hit "Publicar" to push them
 * live in one shot. Closing without publishing offers to discard the drafts
 * so nothing gets orphaned in `draft` limbo.
 *
 * Shared by both modules via `kind`. Dark-first, editorial, framer-motion —
 * matches the AI-summary topic-card language.
 */

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Star,
  ChevronDown,
  Trash2,
  Loader2,
  Check,
  Upload,
  X,
  Sparkles,
  MessageCircleQuestion,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export type DraftKind = 'review' | 'question'

export interface DraftItem {
  id: string
  // review
  rating?: number
  title?: string | null
  // question
  answer?: string
  // shared
  body: string
  author_name: string | null
  author_gender: string | null
  author_avatar_url: string | null
}

type Gender = 'female' | 'male'

interface RowState extends DraftItem {
  _busy?: 'saving' | 'deleting' | null
  _removed?: boolean
}

const AVATAR_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#14b8a6']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function initials(name: string | null): string {
  const n = (name || 'Cliente').trim()
  const parts = n.split(/\s+/)
  return (parts[0]?.[0] ?? 'C').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '')
}

export function AiDraftEditor({
  kind,
  productName,
  drafts,
  onClose,
  onDone,
}: {
  kind: DraftKind
  productName: string
  drafts: DraftItem[]
  onClose: () => void
  onDone: () => void
}) {
  const { getToken } = useAuth()
  const [rows, setRows] = useState<RowState[]>(() => drafts.map((d) => ({ ...d, _busy: null })))
  const [expandedId, setExpandedId] = useState<string | null>(drafts[0]?.id ?? null)
  const [publishing, setPublishing] = useState(false)

  const live = useMemo(() => rows.filter((r) => !r._removed), [rows])
  const noun = kind === 'review' ? 'avaliação' : 'pergunta'
  const nounPlural = kind === 'review' ? 'avaliações' : 'perguntas'

  function patchRow(id: string, patch: Partial<RowState>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function publishAll() {
    const token = getToken()
    setPublishing(true)
    const targets = rows.filter((r) => !r._removed)
    let ok = 0
    try {
      for (const r of targets) {
        patchRow(r.id, { _busy: 'saving' })
        try {
          if (kind === 'review') {
            await api.reviews.update(
              r.id,
              {
                rating: r.rating,
                title: r.title ?? '',
                body: r.body,
                author_name: r.author_name ?? '',
                author_gender: r.author_gender ?? undefined,
                author_avatar_url: r.author_avatar_url,
                status: 'approved',
              },
              token,
            )
          } else {
            await api.questions.update(
              r.id,
              {
                body: r.body,
                answer: r.answer ?? '',
                author_name: r.author_name ?? '',
                author_gender: r.author_gender ?? undefined,
                author_avatar_url: r.author_avatar_url,
                status: 'published',
              },
              token,
            )
          }
          ok += 1
          patchRow(r.id, { _busy: null })
        } catch (e) {
          patchRow(r.id, { _busy: null })
          toast.error(`${r.author_name ?? 'Item'}: ${e instanceof ApiError ? e.message : 'falhou'}`)
        }
      }
      if (ok > 0) {
        toast.success(`${ok} ${ok === 1 ? noun + ' publicada' : nounPlural + ' publicadas'}`)
        onDone()
      }
    } finally {
      setPublishing(false)
    }
  }

  async function deleteRow(id: string) {
    const token = getToken()
    patchRow(id, { _busy: 'deleting' })
    try {
      if (kind === 'review') await api.reviews.delete(id, token)
      else await api.questions.delete(id, token)
      patchRow(id, { _removed: true, _busy: null })
    } catch (e) {
      patchRow(id, { _busy: null })
      toast.error(e instanceof ApiError ? e.message : 'Falha ao remover')
    }
  }

  async function discardAll() {
    if (live.length > 0 && !window.confirm(`Descartar ${live.length} ${live.length === 1 ? noun : nounPlural} sem publicar?`)) return
    const token = getToken()
    setPublishing(true)
    try {
      await Promise.allSettled(
        live.map((r) => (kind === 'review' ? api.reviews.delete(r.id, token) : api.questions.delete(r.id, token))),
      )
    } finally {
      setPublishing(false)
      onClose()
    }
  }

  return (
    <div className="flex flex-col" style={{ maxHeight: '78vh' }}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))' }}
        >
          {kind === 'review' ? (
            <Sparkles className="w-5 h-5" style={{ color: 'var(--ur-text-on-accent)' }} />
          ) : (
            <MessageCircleQuestion className="w-5 h-5" style={{ color: 'var(--ur-text-on-accent)' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold tracking-tight" style={{ color: 'var(--ur-text)' }}>
            Revisar {nounPlural} geradas
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ur-text-muted)' }}>
            {live.length} {live.length === 1 ? 'rascunho' : 'rascunhos'} · {productName} — edite o que quiser e publique
          </p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2.5">
        {live.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>
              Nada para publicar. Feche e gere novamente.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {live.map((r, i) => (
              <DraftCard
                key={r.id}
                kind={kind}
                row={r}
                index={i}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                onChange={(patch) => patchRow(r.id, patch)}
                onDelete={() => deleteRow(r.id)}
                getToken={getToken}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--ur-border)' }}>
        <button
          type="button"
          onClick={discardAll}
          disabled={publishing}
          className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
          style={{ background: 'transparent', color: 'var(--ur-danger)', border: '1px solid var(--ur-border)' }}
        >
          Descartar tudo
        </button>
        <button
          type="button"
          onClick={publishAll}
          disabled={publishing || live.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
          style={{ background: 'var(--ur-accent)', color: 'var(--ur-text-on-accent)' }}
        >
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Publicar {live.length > 0 ? `(${live.length})` : ''}
        </button>
      </div>
    </div>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────

function DraftCard({
  kind,
  row,
  index,
  expanded,
  onToggle,
  onChange,
  onDelete,
  getToken,
}: {
  kind: DraftKind
  row: RowState
  index: number
  expanded: boolean
  onToggle: () => void
  onChange: (patch: Partial<RowState>) => void
  onDelete: () => void
  getToken: () => string
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.4), ease: [0.2, 0, 0.2, 1] }}
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--ur-bg-soft)', border: '1px solid var(--ur-border)' }}
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-3 p-3">
        <Avatar name={row.author_name} url={row.author_avatar_url} />
        <button type="button" onClick={onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--ur-text)' }}>
              {row.author_name || 'Cliente'}
            </span>
            {kind === 'review' && <MiniStars value={row.rating ?? 5} />}
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ur-text-muted)' }}>
            {kind === 'review' ? row.body : row.body}
          </p>
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={row._busy === 'deleting'}
          aria-label="Descartar"
          className="shrink-0 p-1.5 rounded-md cursor-pointer transition-colors"
          style={{ color: 'var(--ur-danger)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ur-danger-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {row._busy === 'deleting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Recolher' : 'Expandir'}
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
          style={{ color: 'var(--ur-text-muted)' }}
        >
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* Expanded editor */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-3 pb-3.5 pt-1 space-y-3" style={{ borderTop: '1px solid var(--ur-border)' }}>
              {/* Identity row: avatar editor + name + gender */}
              <div className="flex items-start gap-3 pt-3">
                <AvatarEditor
                  name={row.author_name}
                  url={row.author_avatar_url}
                  onChange={(url) => onChange({ author_avatar_url: url })}
                  getToken={getToken}
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <Labeled label="Nome">
                    <TextInput value={row.author_name ?? ''} onChange={(v) => onChange({ author_name: v })} placeholder="Nome do cliente" />
                  </Labeled>
                  <Labeled label="Sexo">
                    <GenderToggle value={(row.author_gender as Gender) ?? null} onChange={(g) => onChange({ author_gender: g })} />
                  </Labeled>
                </div>
              </div>

              {kind === 'review' && (
                <>
                  <Labeled label="Estrelas">
                    <StarPicker value={row.rating ?? 5} onChange={(n) => onChange({ rating: n })} />
                  </Labeled>
                  <Labeled label="Título (opcional)">
                    <TextInput value={row.title ?? ''} onChange={(v) => onChange({ title: v })} placeholder="Resumo curto" />
                  </Labeled>
                  <Labeled label="Texto da avaliação">
                    <TextArea value={row.body} onChange={(v) => onChange({ body: v })} rows={4} />
                  </Labeled>
                </>
              )}

              {kind === 'question' && (
                <>
                  <Labeled label="Pergunta">
                    <TextArea value={row.body} onChange={(v) => onChange({ body: v })} rows={2} />
                  </Labeled>
                  <Labeled label="Resposta">
                    <TextArea value={row.answer ?? ''} onChange={(v) => onChange({ answer: v })} rows={3} />
                  </Labeled>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Field primitives ────────────────────────────────────────────────────────

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ur-text-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm rounded-lg px-3 py-2 outline-none transition-shadow"
      style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
      onFocus={(e) => {
        e.target.style.border = '1px solid var(--ur-accent-ring)'
        e.target.style.boxShadow = '0 0 0 3px var(--ur-accent-glow)'
      }}
      onBlur={(e) => {
        e.target.style.border = '1px solid var(--ur-border)'
        e.target.style.boxShadow = 'none'
      }}
    />
  )
}

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y leading-relaxed"
      style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)', color: 'var(--ur-text)' }}
      onFocus={(e) => {
        e.target.style.border = '1px solid var(--ur-accent-ring)'
        e.target.style.boxShadow = '0 0 0 3px var(--ur-accent-glow)'
      }}
      onBlur={(e) => {
        e.target.style.border = '1px solid var(--ur-border)'
        e.target.style.boxShadow = 'none'
      }}
    />
  )
}

function GenderToggle({ value, onChange }: { value: Gender | null; onChange: (g: Gender) => void }) {
  const opts: { v: Gender; label: string }[] = [
    { v: 'female', label: 'Feminino' },
    { v: 'male', label: 'Masculino' },
  ]
  return (
    <div className="inline-flex p-0.5 rounded-lg" style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}>
      {opts.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors"
            style={{
              background: active ? 'var(--ur-accent-soft)' : 'transparent',
              color: active ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
            }}
            aria-pressed={active}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= (hover || value)
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            className="p-0.5 cursor-pointer transition-transform hover:scale-110"
          >
            <Star className="w-6 h-6" style={{ color: on ? 'var(--ur-warn)' : 'var(--ur-text-faint)', fill: on ? 'var(--ur-warn)' : 'none' }} />
          </button>
        )
      })}
    </div>
  )
}

function MiniStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className="w-3 h-3" style={{ color: n <= value ? 'var(--ur-warn)' : 'var(--ur-text-faint)', fill: n <= value ? 'var(--ur-warn)' : 'none' }} />
      ))}
    </span>
  )
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" style={{ border: '1px solid var(--ur-border-strong)' }} />
  }
  return (
    <span
      className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
      style={{ background: avatarColor(name || 'Cliente'), color: '#fff' }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

function AvatarEditor({
  name,
  url,
  onChange,
  getToken,
}: {
  name: string | null
  url: string | null
  onChange: (url: string | null) => void
  getToken: () => string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function pick(file: File | null) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error('Use JPG, PNG ou WEBP.')
      return
    }
    setUploading(true)
    try {
      const res = await api.ai.uploadAuthorPhoto(file, getToken())
      onChange(res.url)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Falha no upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative">
        <Avatar name={name} url={url} />
        {url && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remover foto"
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: 'var(--ur-danger)', color: '#fff' }}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider cursor-pointer transition-colors"
        style={{ color: 'var(--ur-accent)' }}
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        Foto
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null)
          if (e.target) e.target.value = ''
        }}
      />
    </div>
  )
}

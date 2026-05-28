'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { HelpCircle, Mail, MessageCircle, ExternalLink, Activity, FileText } from 'lucide-react'
import { BRAND } from '@/lib/legal'

/**
 * Floating help button — bottom-right of the dashboard. Opens a small
 * panel with support email, status page link, integration docs, and
 * legal pages. Keep it lightweight: no chat widget runtime, no third-
 * party SDK. When we wire Crisp/Intercom later, plug into the same
 * mount point.
 */
export function HelpWidget() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  // Click-outside to close.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div
      ref={ref}
      className="fixed bottom-5 right-5 z-40 print:hidden"
      style={{ pointerEvents: 'auto' }}
    >
      {open && (
        <div
          className="mb-3 w-72 rounded-xl shadow-xl overflow-hidden"
          style={{
            background: 'var(--ur-surface)',
            border: '1px solid var(--ur-border)',
            boxShadow: '0 20px 60px var(--ur-overlay)',
          }}
        >
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom: '1px solid var(--ur-border)' }}
          >
            <HelpCircle className="w-4 h-4" style={{ color: 'var(--ur-accent)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ur-text)' }}>
              Precisa de ajuda?
            </h3>
          </div>
          <nav className="py-1">
            <HelpItem
              icon={<Mail className="w-4 h-4" />}
              label="Falar com suporte"
              href={`mailto:${BRAND.supportEmail}`}
              hint={BRAND.supportEmail}
            />
            <HelpItem
              icon={<MessageCircle className="w-4 h-4" />}
              label="Whats da equipe"
              href="https://wa.me/553132302525"
              hint="Resposta em até 2h dias úteis"
              external
            />
            <HelpItem
              icon={<Activity className="w-4 h-4" />}
              label="Status do serviço"
              href="/status"
            />
            <HelpItem
              icon={<FileText className="w-4 h-4" />}
              label="Documentação"
              href="https://github.com/EuKennedy/univer-reviews-deploy/blob/main/docs/INTEGRATION.md"
              external
            />
          </nav>
          <div
            className="px-4 py-2 text-[10px]"
            style={{
              background: 'var(--ur-bg-soft)',
              color: 'var(--ur-text-muted)',
              borderTop: '1px solid var(--ur-border)',
            }}
          >
            Privacidade & dados: {BRAND.privacyEmail}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform"
        style={{
          background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
          color: 'var(--ur-text-on-accent)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
        aria-label={open ? 'Fechar ajuda' : 'Abrir ajuda'}
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  )
}

function HelpItem({
  icon, label, href, hint, external = false,
}: {
  icon: React.ReactNode
  label: string
  href: string
  hint?: string
  external?: boolean
}) {
  const Inner = (
    <span className="flex items-center gap-3 px-4 py-2.5 hover:opacity-90 transition-opacity">
      <span
        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
        style={{ background: 'var(--ur-accent-glow)', color: 'var(--ur-accent)' }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium" style={{ color: 'var(--ur-text)' }}>
          {label}
        </span>
        {hint && (
          <span className="block text-[11px] truncate" style={{ color: 'var(--ur-text-muted)' }}>
            {hint}
          </span>
        )}
      </span>
      {external && <ExternalLink className="w-3 h-3 shrink-0" style={{ color: 'var(--ur-text-muted)' }} />}
    </span>
  )
  if (external || href.startsWith('mailto:') || href.startsWith('https:')) {
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
        {Inner}
      </a>
    )
  }
  return <Link href={href}>{Inner}</Link>
}

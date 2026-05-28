'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'

/**
 * Cookie consent banner — LGPD Art. 8º (consentimento livre, informado e
 * inequívoco) + Art. 18 VIII (direito de negar consentimento).
 *
 * Decisão fica em localStorage com versão (so bumps de política forçam
 * novo banner). Esta versão NÃO gateia trackers reais — é UX visual +
 * registro de escolha. Quando integrarmos GA/Mixpanel/etc., a função
 * `getConsent()` deve ser consultada antes de carregar os scripts.
 */
const STORAGE_KEY = 'univerreviews_cookie_consent'
const CONSENT_VERSION = '2026-05-27'

type Choice = 'all' | 'essential'

interface ConsentState {
  version: string
  choice: Choice
  at: string
}

export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentState
    if (parsed.version !== CONSENT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function CookieConsent() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(getConsent() === null)
  }, [])

  const persist = (choice: Choice) => {
    const state: ConsentState = {
      version: CONSENT_VERSION,
      choice,
      at: new Date().toISOString(),
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore quota errors — banner just disappears for the session.
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[420px] z-50 rounded-2xl shadow-xl"
      style={{
        background: 'var(--ur-surface)',
        border: '1px solid var(--ur-border)',
        boxShadow: '0 20px 60px var(--ur-overlay)',
      }}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--ur-accent-glow)', color: 'var(--ur-accent)' }}
          >
            <Cookie className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="cookie-consent-title"
              className="text-sm font-semibold mb-1"
              style={{ color: 'var(--ur-text)' }}
            >
              Sua privacidade importa
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ur-text-soft)' }}>
              Usamos cookies essenciais para o login e a navegação. Cookies
              analíticos opcionais ajudam a entender o uso do produto. Você
              pode revisar a qualquer momento na{' '}
              <Link
                href="/privacidade"
                className="underline"
                style={{ color: 'var(--ur-accent)' }}
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={() => persist('essential')}
            aria-label="Fechar e aceitar apenas essenciais"
            className="shrink-0 p-1 rounded-md transition-colors"
            style={{ color: 'var(--ur-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            type="button"
            onClick={() => persist('essential')}
            className="flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors"
            style={{
              background: 'transparent',
              border: '1px solid var(--ur-border)',
              color: 'var(--ur-text-soft)',
            }}
          >
            Apenas essenciais
          </button>
          <button
            type="button"
            onClick={() => persist('all')}
            className="flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
              color: 'var(--ur-text-on-accent)',
            }}
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { LEGAL_VERSIONS, needsReAcceptance } from '@/lib/legal'
import { authClient } from '@/lib/auth-client'

/**
 * Banner bloqueante exibido no dashboard quando a versão de Termos ou
 * Privacidade aceita pelo usuário não bate com LEGAL_VERSIONS atual.
 *
 * LGPD Art. 8º: consentimento informado + Art. 9º: direito de revisar a
 * cada mudança. Versionamento força re-aceite ativo (não passa
 * implicitamente).
 */
interface Props {
  acceptedTermsVersion: string | null
  acceptedPrivacyVersion: string | null
}

export function LegalReAcceptBanner({
  acceptedTermsVersion,
  acceptedPrivacyVersion,
}: Props) {
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(
    !needsReAcceptance(acceptedTermsVersion, acceptedPrivacyVersion),
  )

  const accept = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/accept-legal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terms_version: LEGAL_VERSIONS.terms,
          privacy_version: LEGAL_VERSIONS.privacy,
        }),
      })
      if (!res.ok) throw new Error('Falha ao registrar aceite')
      return res.json()
    },
    onSuccess: () => {
      setAccepted(true)
      queryClient.invalidateQueries({ queryKey: ['session'] })
      void authClient.getSession()
      toast.success('Aceite registrado. Obrigado.')
    },
    onError: () => toast.error('Não foi possível registrar o aceite. Tente novamente.'),
  })

  if (accepted) return null

  const termsChanged = acceptedTermsVersion !== LEGAL_VERSIONS.terms
  const privacyChanged = acceptedPrivacyVersion !== LEGAL_VERSIONS.privacy

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="legal-banner-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,10,14,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: 'var(--ur-surface)',
          border: '1px solid var(--ur-border)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--ur-accent-glow)', color: 'var(--ur-accent)' }}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2
              id="legal-banner-title"
              className="text-base font-semibold mb-1"
              style={{ color: 'var(--ur-text)' }}
            >
              Atualizamos nossos documentos
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ur-text-soft)' }}>
              Para continuar usando o UniverReviews, revise e aceite a versão mais recente
              {termsChanged && (
                <>
                  {' '}
                  dos{' '}
                  <Link
                    href="/termos"
                    target="_blank"
                    className="underline"
                    style={{ color: 'var(--ur-accent)' }}
                  >
                    Termos de Uso
                  </Link>
                </>
              )}
              {termsChanged && privacyChanged && ' e'}
              {privacyChanged && (
                <>
                  {' '}
                  da{' '}
                  <Link
                    href="/privacidade"
                    target="_blank"
                    className="underline"
                    style={{ color: 'var(--ur-accent)' }}
                  >
                    Política de Privacidade
                  </Link>
                </>
              )}
              .
            </p>
          </div>
        </div>

        <ul
          className="text-xs space-y-1 mb-5 p-3 rounded-md"
          style={{ background: 'var(--ur-bg-soft)', color: 'var(--ur-text-muted)' }}
        >
          {termsChanged && <li>• Termos versão {LEGAL_VERSIONS.terms}</li>}
          {privacyChanged && <li>• Privacidade versão {LEGAL_VERSIONS.privacy}</li>}
        </ul>

        <button
          type="button"
          onClick={() => accept.mutate()}
          disabled={accept.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
            color: 'var(--ur-text-on-accent)',
          }}
        >
          {accept.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Li e aceito
        </button>
        <p
          className="text-[11px] mt-3 text-center"
          style={{ color: 'var(--ur-text-muted)' }}
        >
          Você pode revisar ou exportar seus dados a qualquer momento em{' '}
          <Link href="/conta/privacy" className="underline">/conta/privacy</Link>.
        </p>
      </div>
    </div>
  )
}

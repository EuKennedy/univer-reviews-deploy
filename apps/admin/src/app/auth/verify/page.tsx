'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { setCookie } from 'cookies-next'
import { api } from '@/lib/api'

type State = 'verifying' | 'success' | 'error'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<State>('verifying')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setState('error')
      setError('No token found in URL')
      return
    }

    api.auth
      .verify(token)
      .then((result) => {
        setCookie('univer_token', result.token, {
          maxAge: 60 * 60 * 24 * 30,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          httpOnly: false,
        })
        setState('success')
        setTimeout(() => router.push('/'), 1200)
      })
      .catch((err) => {
        setState('error')
        setError(err.message ?? 'Verification failed')
      })
  }, [router, searchParams])

  return (
    <>
      {state === 'verifying' && (
        <>
          <Loader2
            className="w-8 h-8 animate-spin mx-auto mb-4"
            style={{ color: '#d4a850' }}
          />
          <p className="text-sm" style={{ color: '#8b8b96' }}>
            Verifying your magic link…
          </p>
        </>
      )}

      {state === 'success' && (
        <>
          <CheckCircle2
            className="w-8 h-8 mx-auto mb-4"
            style={{ color: '#22c55e' }}
          />
          <p className="text-sm font-medium" style={{ color: '#f0f0f2' }}>
            Signed in! Redirecting…
          </p>
        </>
      )}

      {state === 'error' && (
        <>
          <XCircle
            className="w-8 h-8 mx-auto mb-4"
            style={{ color: '#ef4444' }}
          />
          <p className="text-sm font-medium mb-2" style={{ color: '#f0f0f2' }}>
            Verification failed
          </p>
          <p className="text-xs mb-5" style={{ color: '#5a5a64' }}>
            {error}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="text-sm px-4 py-2 rounded-lg"
            style={{
              background: 'rgba(212,168,80,0.1)',
              border: '1px solid rgba(212,168,80,0.2)',
              color: '#d4a850',
            }}
          >
            Back to login
          </button>
        </>
      )}
    </>
  )
}

export default function VerifyPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0a0a0b' }}
    >
      <div className="text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, #d4a850, #a07830)' }}
        >
          <Sparkles className="w-7 h-7 text-white" />
        </div>

        <Suspense
          fallback={
            <Loader2
              className="w-8 h-8 animate-spin mx-auto"
              style={{ color: '#d4a850' }}
            />
          }
        >
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  )
}

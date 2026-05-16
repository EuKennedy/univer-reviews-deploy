'use client'

/**
 * Legacy verification page. Better Auth handles magic-link verification at
 * /api/auth/magic-link/verify directly. This page only exists to redirect old
 * email links pointed at /auth/verify to the new flow.
 */
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function Redirector() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      window.location.replace(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`)
    } else {
      router.replace('/login')
    }
  }, [router, searchParams])

  return null
}

export default function VerifyPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0a0a0b' }}
    >
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#d4a850' }} />
      <Suspense fallback={null}>
        <Redirector />
      </Suspense>
    </div>
  )
}

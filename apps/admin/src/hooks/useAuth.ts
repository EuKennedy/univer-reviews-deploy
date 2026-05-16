'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authClient, useSession } from '@/lib/auth-client'

/**
 * Better Auth wrapper hook. Replaces previous JWT-cookie based hook.
 * Session is fetched from /api/auth/get-session (cached client-side by Better Auth).
 *
 * NOTE: getToken() is kept for backwards compatibility with the api.ts client.
 * It returns the cookie value (Better Auth signed session_token) so the Rails
 * backend can look up the session row directly. Most authenticated requests
 * just need cookies sent automatically — getToken() is for explicit Bearer.
 */
export function useAuth() {
  const router = useRouter()
  const { data: session, isPending, error } = useSession()

  const logout = useCallback(async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push('/login'),
      },
    })
  }, [router])

  const getToken = useCallback((): string => {
    if (typeof document === 'undefined') throw new Error('Not in browser')
    const cookies = document.cookie.split(';').map((c) => c.trim())
    const sessionCookie =
      cookies.find((c) => c.startsWith('better-auth.session_token='))?.split('=')[1] ||
      cookies.find((c) => c.startsWith('__Secure-better-auth.session_token='))?.split('=')[1]
    if (!sessionCookie) throw new Error('Não autenticado')
    return decodeURIComponent(sessionCookie)
  }, [])

  return {
    user: session?.user || null,
    session: session?.session || null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    error,
    logout,
    getToken,
  }
}

'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authClient, useSession } from '@/lib/auth-client'

/**
 * Better Auth wrapper hook. Session is fetched from /api/auth/get-session.
 *
 * Authentication on API calls relies on the httpOnly session cookie being sent
 * cross-subdomain (dash → api) via `credentials: 'include'`. The cookie is set
 * with `httpOnly: true` for XSS protection — JavaScript cannot read it. Rails
 * looks the session row up directly server-side.
 *
 * getToken() returns '' so the api client skips the redundant Bearer header.
 * Kept for signature compatibility with existing call sites.
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

  const getToken = useCallback((): string => '', [])

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

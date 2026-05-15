'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCookie, deleteCookie } from 'cookies-next'
import { api } from '@/lib/api'
import type { WorkspaceUser } from '@/types'

interface AuthState {
  token: string | null
  user: WorkspaceUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

const TOKEN_COOKIE = 'univer_token'

export function useAuth() {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })

  useEffect(() => {
    const token = getCookie(TOKEN_COOKIE) as string | undefined
    if (!token) {
      setState({ token: null, user: null, isLoading: false, isAuthenticated: false })
      return
    }
    setState((prev) => ({ ...prev, token, isLoading: false, isAuthenticated: true }))
  }, [])

  const logout = useCallback(async () => {
    const token = getCookie(TOKEN_COOKIE) as string | undefined
    if (token) {
      try {
        await api.auth.logout(token)
      } catch {
        // Ignore errors on logout
      }
    }
    deleteCookie(TOKEN_COOKIE)
    router.push('/login')
  }, [router])

  const getToken = useCallback((): string => {
    const token = getCookie(TOKEN_COOKIE) as string | undefined
    if (!token) throw new Error('Not authenticated')
    return token
  }, [])

  return {
    ...state,
    logout,
    getToken,
  }
}

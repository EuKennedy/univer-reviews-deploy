'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { api } from '@/lib/api'
import type { Workspace } from '@/types'

export function useWorkspace() {
  const params = useParams()
  const slug = params?.workspace as string | undefined
  const { getToken, isAuthenticated } = useAuth()

  const { data: workspace, isLoading, error } = useQuery<Workspace>({
    queryKey: ['workspace', slug],
    queryFn: async () => {
      const token = getToken()
      return api.workspace.get(token)
    },
    enabled: isAuthenticated && !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    workspace,
    slug: slug ?? '',
    isLoading,
    error,
  }
}

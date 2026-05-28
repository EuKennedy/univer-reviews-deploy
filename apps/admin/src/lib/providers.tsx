'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ThemeProvider } from './theme'
import { PaywallProvider } from '@/components/paywall/PaywallProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
            retry: (failureCount, error: unknown) => {
              const err = error as { status?: number }
              if (err?.status === 401 || err?.status === 403) return false
              // 402 paywall errors are surfaced by the global modal — no
              // point retrying, the plan won't change between attempts.
              if (err?.status === 402) return false
              return failureCount < 2
            },
          },
        },
      })
  )

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {/* PaywallProvider mounts at the root so /super, /onboarding and
            every /[workspace]/* page share the same modal. It listens
            on `window` for the `paywall` event dispatched by api.ts —
            see PaywallProvider.tsx for the rationale of using a window
            event instead of a context callback. */}
        <PaywallProvider>{children}</PaywallProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

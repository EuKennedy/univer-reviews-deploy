'use client'

import { Toaster } from 'sonner'
import { useTheme } from '@/lib/theme'

export function ThemedToaster() {
  const { theme } = useTheme()

  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--ur-surface)',
          border: '1px solid var(--ur-border)',
          color: 'var(--ur-text)',
        },
      }}
    />
  )
}

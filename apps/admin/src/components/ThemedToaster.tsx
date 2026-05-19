'use client'

import { Toaster } from 'sonner'
import { useTheme } from '@/lib/theme'

/**
 * Sonner is wrapped in a labelled live region so screen readers announce
 * toasts politely (Sonner v1 sets aria-live on the inner ol, but we add an
 * outer landmark so users can find the live region via the rotor and so
 * the live behavior is explicit and AT-friendly regardless of Sonner
 * internals).
 */
export function ThemedToaster() {
  const { theme } = useTheme()

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Notificações"
    >
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
    </div>
  )
}

'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme'

interface ThemeToggleProps {
  className?: string
  size?: number
}

export function ThemeToggle({ className, size = 14 }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  const Icon = isLight ? Sun : Moon
  // Announces what the click will *do*, not what it currently is — clearer for SR users.
  const nextTheme = isLight ? 'escuro' : 'claro'
  const label = `Mudar para tema ${nextTheme} (atual: ${isLight ? 'claro' : 'escuro'})`

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      aria-pressed={!isLight}
      className={className}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        background: 'transparent',
        border: '1px solid var(--ur-border)',
        color: 'var(--ur-text-soft)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--ur-surface-soft)'
        e.currentTarget.style.color = 'var(--ur-accent)'
        e.currentTarget.style.borderColor = 'var(--ur-accent-soft-3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--ur-text-soft)'
        e.currentTarget.style.borderColor = 'var(--ur-border)'
      }}
    >
      <Icon style={{ width: size, height: size }} aria-hidden="true" />
    </button>
  )
}

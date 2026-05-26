/**
 * FilterChips — pill-style filter group with smooth selected state.
 * Replaces the generic <select> for status/sort filtering. The active
 * chip animates a soft accent ring via layoutId so the highlight slides
 * between chips instead of popping.
 */

import { motion } from 'framer-motion'
import { useId } from 'react'

interface ChipOption<T extends string> {
  value: T
  label: string
  count?: number
  icon?: React.ReactNode
}

interface FilterChipsProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: ChipOption<T>[]
  ariaLabel?: string
}

export function FilterChips<T extends string>({ value, onChange, options, ariaLabel }: FilterChipsProps<T>) {
  const groupId = useId()
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 p-1 rounded-full"
      style={{ background: 'var(--ur-bg)', border: '1px solid var(--ur-border)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className="relative px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
            style={{ color: active ? 'var(--ur-text)' : 'var(--ur-text-soft)', zIndex: 1 }}
          >
            {active && (
              <motion.span
                layoutId={`chip-${groupId}`}
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'var(--ur-accent-glow)',
                  border: '1px solid var(--ur-accent-soft-3)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                  zIndex: -1,
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              />
            )}
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className="text-[10px] font-semibold tabular-nums px-1.5 rounded-full"
                style={{
                  background: active ? 'var(--ur-accent)' : 'var(--ur-surface-soft)',
                  color: active ? 'var(--ur-text-on-accent)' : 'var(--ur-text-muted)',
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

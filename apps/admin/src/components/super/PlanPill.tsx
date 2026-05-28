'use client'

/**
 * PlanPill — text-only plan badge (no dot, no pulse).
 *
 * Tier hierarchy is encoded by visual weight:
 *   free   → muted gray, plain
 *   entry  → neutral, subtle border
 *   medium → accent (gold)
 *   ultra  → accent gradient (richer)
 *
 * Plan slugs match the NEW product-facing names (entry/medium/ultra)
 * that the marketing surface and billing screens use. The DB slug
 * (starter/pro/enterprise) is translated by the API.
 */

import type { SuperAdminPlan } from '@/types'

interface PlanPillProps {
  plan: SuperAdminPlan
  size?: 'sm' | 'md'
}

export function PlanPill({ plan, size = 'sm' }: PlanPillProps) {
  const padding = size === 'sm' ? '3px 9px' : '5px 12px'
  const fontSize = size === 'sm' ? 10.5 : 11.5

  const baseStyle: React.CSSProperties = {
    padding,
    fontSize,
    letterSpacing: '0.08em',
  }

  switch (plan) {
    case 'free':
      return (
        <span
          className="inline-flex items-center rounded-md font-semibold uppercase whitespace-nowrap"
          style={{
            ...baseStyle,
            background: 'var(--ur-surface-soft)',
            color: 'var(--ur-text-muted)',
            border: '1px solid var(--ur-border)',
          }}
        >
          free
        </span>
      )
    case 'entry':
      return (
        <span
          className="inline-flex items-center rounded-md font-semibold uppercase whitespace-nowrap"
          style={{
            ...baseStyle,
            background: 'var(--ur-bg-soft)',
            color: 'var(--ur-text-soft)',
            border: '1px solid var(--ur-border-strong)',
          }}
        >
          entry
        </span>
      )
    case 'medium':
      return (
        <span
          className="inline-flex items-center rounded-md font-semibold uppercase whitespace-nowrap"
          style={{
            ...baseStyle,
            background: 'var(--ur-accent-soft)',
            color: 'var(--ur-accent)',
            border: '1px solid var(--ur-accent-soft-2)',
          }}
        >
          medium
        </span>
      )
    case 'ultra':
      return (
        <span
          className="inline-flex items-center rounded-md font-semibold uppercase whitespace-nowrap"
          style={{
            ...baseStyle,
            background:
              'linear-gradient(135deg, var(--ur-accent), var(--ur-accent-strong))',
            color: 'var(--ur-text-on-accent)',
            border: '1px solid transparent',
            boxShadow: '0 4px 12px -4px var(--ur-accent-glow)',
          }}
        >
          ultra
        </span>
      )
  }
}

/**
 * StarsAvg — small inline cluster of stars + numeric average. Used in
 * both the topic-card header (admin) and the storefront widget. Designed
 * so it reads at any zoom level without weight loss.
 */

import { Star } from 'lucide-react'

interface StarsAvgProps {
  value: number | string | null
  showNumber?: boolean
  size?: 'xs' | 'sm' | 'md'
}

export function StarsAvg({ value, showNumber = true, size = 'sm' }: StarsAvgProps) {
  const num = value == null ? null : Number(value)
  if (num == null || Number.isNaN(num)) return null

  const filled = Math.round(num)
  const px = size === 'xs' ? 10 : size === 'sm' ? 12 : 14
  const fontSize = size === 'xs' ? 10 : size === 'sm' ? 11 : 13

  return (
    <span className="inline-flex items-center gap-1" style={{ fontSize }}>
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            width={px}
            height={px}
            style={{
              color: i <= filled ? 'var(--ur-warn)' : 'var(--ur-text-faint)',
              fill: i <= filled ? 'var(--ur-warn)' : 'none',
            }}
          />
        ))}
      </span>
      {showNumber && (
        <span className="font-semibold tabular-nums" style={{ color: 'var(--ur-text)' }}>
          {num.toFixed(1)}
        </span>
      )}
    </span>
  )
}

'use client'

import { useMemo } from 'react'

interface AiScoreGaugeProps {
  score: number
  label?: string
  size?: number
}

export function AiScoreGauge({
  score,
  label = 'Quality Score',
  size = 80,
}: AiScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))

  const color = useMemo(() => {
    if (clamped < 40) return '#ef4444'
    if (clamped < 70) return '#f59e0b'
    return '#22c55e'
  }, [clamped])

  // SVG arc calculation
  const r = (size - 10) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  // Use 270 degrees arc (start from -135deg, end at +135deg)
  const arcLength = circumference * 0.75
  const dashOffset = arcLength - (arcLength * clamped) / 100

  // Start angle: 135° (bottom-left), rendered as SVG path
  const startAngle = 135
  const endAngle = startAngle + 270

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    }
  }

  function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
    const s = polarToCartesian(cx, cy, r, start)
    const e = polarToCartesian(cx, cy, r, end)
    const large = end - start <= 180 ? '0' : '1'
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const trackPath = describeArc(cx, cy, r, startAngle, endAngle)
  const fillPath = describeArc(cx, cy, r, startAngle, startAngle + 270 * (clamped / 100))

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <path
            d={trackPath}
            fill="none"
            stroke="#2a2a2e"
            strokeWidth={5}
            strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 4px ${color}60)`,
              transition: 'all 0.6s ease',
            }}
          />
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-base font-bold tabular-nums"
            style={{ color }}
          >
            {Math.round(clamped)}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs" style={{ color: '#5a5a64' }}>
          {label}
        </span>
      )}
    </div>
  )
}

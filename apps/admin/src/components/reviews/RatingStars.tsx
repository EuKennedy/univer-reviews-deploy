import { cn } from '@/lib/utils'

interface RatingStarsProps {
  rating: number
  max?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: string
  showValue?: boolean
}

const sizeMap = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
}

export function RatingStars({
  rating,
  max = 5,
  size = 'sm',
  color = '#d4a850',
  showValue = false,
}: RatingStarsProps) {
  const px = sizeMap[size]

  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }).map((_, i) => {
          const filled = i < Math.floor(rating)
          const partial = !filled && i < rating

          return (
            <svg
              key={i}
              width={px}
              height={px}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {partial ? (
                <>
                  <defs>
                    <linearGradient id={`star-partial-${i}`} x1="0" x2="1" y1="0" y2="0">
                      <stop offset={`${(rating % 1) * 100}%`} stopColor={color} />
                      <stop offset={`${(rating % 1) * 100}%`} stopColor="#2a2a2e" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    fill={`url(#star-partial-${i})`}
                    stroke={color}
                    strokeWidth={0.5}
                    opacity={0.8}
                  />
                </>
              ) : (
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={filled ? color : '#2a2a2e'}
                  stroke={filled ? color : '#3a3a3e'}
                  strokeWidth={0.5}
                />
              )}
            </svg>
          )
        })}
      </div>
      {showValue && (
        <span
          className={cn(
            'font-medium tabular-nums',
            size === 'xs' && 'text-xs',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base'
          )}
          style={{ color: '#d4a850' }}
        >
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

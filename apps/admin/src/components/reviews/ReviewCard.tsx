import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import type { Review } from '@/types'
import { StatusBadge } from './StatusBadge'
import { RatingStars } from './RatingStars'
import { truncate, getInitials } from '@/lib/utils'

interface ReviewCardProps {
  review: Review
  onClick?: () => void
}

const sourceLabel: Record<string, string> = {
  widget: 'Widget',
  woocommerce: 'WooCommerce',
  api: 'API',
  import: 'Importação',
  ai_generated: 'IA',
}

export function ReviewCard({ review, onClick }: ReviewCardProps) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 transition-all duration-150 cursor-pointer group relative"
      style={{
        background: '#111113',
        border: '1px solid #1e1e21',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = '1px solid rgba(212,168,80,0.2)'
        e.currentTarget.style.background = '#131316'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = '1px solid #1e1e21'
        e.currentTarget.style.background = '#111113'
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'rgba(212,168,80,0.15)', color: '#d4a850' }}
          >
            {review.author_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={review.author_avatar_url}
                alt={review.author_name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(review.author_name)
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium" style={{ color: '#f0f0f2' }}>
                {review.author_name}
              </span>
              {review.verified_purchase && (
                <CheckCircle2
                  className="w-3.5 h-3.5"
                  style={{ color: '#22c55e' }}
                />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <RatingStars rating={review.rating} size="xs" />
              <span className="text-xs" style={{ color: '#5a5a64' }}>
                {format(new Date(review.created_at), "d 'de' MMM, yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={review.status} size="sm" />
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: '#1a1a1d',
              color: '#5a5a64',
              border: '1px solid #2a2a2d',
            }}
          >
            {sourceLabel[review.source] ?? review.source}
          </span>
        </div>
      </div>

      {review.product_name && (
        <p className="text-xs mb-2" style={{ color: '#5a5a64' }}>
          {review.product_name}
        </p>
      )}

      {review.title && (
        <p className="text-sm font-medium mb-1" style={{ color: '#e0e0e2' }}>
          {review.title}
        </p>
      )}

      <p className="text-sm leading-relaxed" style={{ color: '#8b8b96' }}>
        {truncate(review.body, 180)}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #1a1a1d' }}>
        <div className="flex items-center gap-3">
          {review.media.length > 0 && (
            <span className="text-xs" style={{ color: '#5a5a64' }}>
              {review.media.length} {review.media.length === 1 ? 'mídia' : 'mídias'}
            </span>
          )}
          {review.replies.length > 0 && (
            <span className="text-xs" style={{ color: '#5a5a64' }}>
              {review.replies.length} {review.replies.length === 1 ? 'resposta' : 'respostas'}
            </span>
          )}
          {review.helpful_count > 0 && (
            <span className="text-xs" style={{ color: '#5a5a64' }}>
              {review.helpful_count} {review.helpful_count === 1 ? 'útil' : 'úteis'}
            </span>
          )}
        </div>
        <ExternalLink
          className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: '#5a5a64' }}
        />
      </div>
    </div>
  )
}

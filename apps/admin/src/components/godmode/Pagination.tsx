'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
  perPage: number
  onPageChange: (page: number) => void
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  perPage,
  onPageChange,
}: PaginationProps) {
  const start = (currentPage - 1) * perPage + 1
  const end = Math.min(currentPage * perPage, totalCount)

  const pages = getPageNumbers(currentPage, totalPages)

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderTop: '1px solid var(--ur-border)' }}
    >
      <span className="ur-meta">
        Exibindo {start}–{end} de {totalCount} resultados
      </span>

      <nav
        aria-label="Paginação"
        className="flex items-center gap-1"
      >
        <PageButton
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          ariaLabel="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </PageButton>

        {pages.map((p, i) =>
          p === '…' ? (
            <span
              key={`ellipsis-${i}`}
              className="w-8 h-8 flex items-center justify-center ur-meta"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <PageButton
              key={p}
              onClick={() => onPageChange(p as number)}
              active={p === currentPage}
              ariaLabel={
                p === currentPage
                  ? `Página ${p}, página atual`
                  : `Ir para a página ${p}`
              }
              ariaCurrent={p === currentPage ? 'page' : undefined}
            >
              {p}
            </PageButton>
          )
        )}

        <PageButton
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          ariaLabel="Próxima página"
        >
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </PageButton>
      </nav>
    </div>
  )
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
  ariaLabel,
  ariaCurrent,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  ariaLabel?: string
  ariaCurrent?: 'page' | undefined
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      className="w-7 h-7 rounded-md text-xs font-medium transition-all duration-100 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: active ? 'var(--ur-accent-soft-2)' : 'transparent',
        border: active
          ? '1px solid var(--ur-accent-soft-3)'
          : '1px solid transparent',
        color: active ? 'var(--ur-accent)' : 'var(--ur-text-soft)',
      }}
    >
      {children}
    </button>
  )
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3)
    return [1, '…', total - 4, total - 3, total - 2, total - 1, total]

  return [1, '…', current - 1, current, current + 1, '…', total]
}

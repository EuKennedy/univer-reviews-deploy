'use client'

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  isLoading?: boolean
  emptyState?: React.ReactNode
  onRowClick?: (row: TData) => void
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (selection: RowSelectionState) => void
  getRowId?: (row: TData) => string
  className?: string
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="skeleton h-4 rounded"
                style={{ width: j === 0 ? 24 : `${60 + Math.random() * 40}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function EmptyState() {
  return (
    <tr>
      <td colSpan={999} className="py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ opacity: 0.6 }}
          >
            <rect
              x="8"
              y="16"
              width="48"
              height="36"
              rx="4"
              stroke="var(--ur-text-muted)"
              strokeWidth="1.5"
            />
            <path d="M8 24h48" stroke="var(--ur-text-muted)" strokeWidth="1.5" />
            <path
              d="M16 32h12M16 38h20"
              stroke="var(--ur-text-faint)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle
              cx="48"
              cy="44"
              r="12"
              fill="var(--ur-surface)"
              stroke="var(--ur-border-strong)"
              strokeWidth="1.5"
            />
            <path
              d="M44 44h8M48 40v8"
              stroke="var(--ur-text-faint)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <p className="ur-h3" style={{ color: 'var(--ur-text-secondary)' }}>
              Nenhum resultado encontrado
            </p>
            <p className="mt-1 ur-caption">
              Tente ajustar os filtros ou a busca
            </p>
          </div>
        </div>
      </td>
    </tr>
  )
}

export function DataTable<TData>({
  data,
  columns,
  isLoading,
  emptyState,
  onRowClick,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection: rowSelection ?? {},
    },
    onSortingChange: setSorting,
    onRowSelectionChange: onRowSelectionChange
      ? (updater) => {
          const next =
            typeof updater === 'function'
              ? updater(rowSelection ?? {})
              : updater
          onRowSelectionChange(next)
        }
      : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: !!onRowSelectionChange,
    getRowId: getRowId
      ? (row) => getRowId(row)
      : undefined,
  })

  return (
    // overflow-x-auto + min-w on the inner table makes the data table
    // horizontally scrollable on < 768px viewports without breaking the
    // desktop layout. The first column (identifier/name) is sticky-left on
    // small viewports so users keep context while panning sideways. On md+
    // viewports nothing changes (md:min-w-0, md:static).
    <div className={cn('w-full overflow-x-auto overflow-y-auto', className)}>
      <table className="w-full border-collapse min-w-[720px] md:min-w-0">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              style={{ borderBottom: '1px solid var(--ur-border)' }}
            >
              {headerGroup.headers.map((header, idx) => {
                const stickyClass =
                  idx === 0
                    ? 'sticky left-0 z-10 md:static md:left-auto'
                    : ''
                if (header.isPlaceholder) {
                  return (
                    <th
                      key={header.id}
                      className={cn('px-4 py-2.5 text-left', stickyClass)}
                      style={{ background: 'var(--ur-bg-soft)' }}
                    />
                  )
                }
                const canSort = header.column.getCanSort()
                const sortDir = header.column.getIsSorted()
                const sortHandler = header.column.getToggleSortingHandler()
                const headerLabel =
                  typeof header.column.columnDef.header === 'string'
                    ? header.column.columnDef.header
                    : header.column.id
                const sortLabel = canSort
                  ? sortDir === 'asc'
                    ? `Ordenar ${headerLabel} decrescente`
                    : sortDir === 'desc'
                    ? `Limpar ordenação de ${headerLabel}`
                    : `Ordenar ${headerLabel} crescente`
                  : undefined
                return (
                  <th
                    key={header.id}
                    className={cn('px-4 py-2.5 text-left', stickyClass)}
                    style={{ background: 'var(--ur-bg-soft)' }}
                    aria-sort={
                      sortDir === 'asc'
                        ? 'ascending'
                        : sortDir === 'desc'
                        ? 'descending'
                        : canSort
                        ? 'none'
                        : undefined
                    }
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={sortHandler}
                        aria-label={sortLabel}
                        className="ur-overline flex items-center gap-1.5 cursor-pointer select-none transition-colors bg-transparent border-0 p-0 text-left"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--ur-text)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = ''
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <span
                          style={{ color: 'var(--ur-text-muted)' }}
                          aria-hidden="true"
                        >
                          {sortDir === 'asc' ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : sortDir === 'desc' ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3" />
                          )}
                        </span>
                      </button>
                    ) : (
                      <span className="ur-overline">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            <TableSkeleton cols={columns.length} />
          ) : table.getRowModel().rows.length === 0 ? (
            emptyState ? (
              <tr>
                <td colSpan={columns.length}>{emptyState}</td>
              </tr>
            ) : (
              <EmptyState />
            )
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className="group transition-all duration-100"
                style={{
                  borderBottom: '1px solid var(--ur-border-soft)',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.background = 'var(--ur-surface-soft)'
                  el.style.borderLeft = '2px solid var(--ur-accent-ring)'
                  el.style.paddingLeft = '0'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.background = 'transparent'
                  el.style.borderLeft = 'none'
                }}
              >
                {row.getVisibleCells().map((cell, idx) => (
                  <td
                    key={cell.id}
                    className={cn(
                      'px-4 py-3 text-sm',
                      idx === 0 && 'sticky left-0 z-[1] md:static md:left-auto',
                    )}
                    style={{
                      color: 'var(--ur-text)',
                      // Match the row background so the sticky cell doesn't
                      // bleed through underlying rows while scrolling.
                      background: idx === 0 ? 'var(--ur-surface)' : undefined,
                    }}
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

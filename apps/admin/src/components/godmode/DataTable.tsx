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
            style={{ opacity: 0.4 }}
          >
            <rect x="8" y="16" width="48" height="36" rx="4" stroke="#5a5a64" strokeWidth="1.5" />
            <path d="M8 24h48" stroke="#5a5a64" strokeWidth="1.5" />
            <path d="M16 32h12M16 38h20" stroke="#3a3a3e" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="48" cy="44" r="12" fill="#111113" stroke="#2a2a2e" strokeWidth="1.5" />
            <path d="M44 44h8M48 40v8" stroke="#3a3a3e" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-sm font-medium" style={{ color: '#8b8b96' }}>
              No results found
            </p>
            <p className="text-xs mt-1" style={{ color: '#5a5a64' }}>
              Try adjusting your filters or search query
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
    <div className={cn('w-full overflow-auto', className)}>
      <table className="w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              style={{ borderBottom: '1px solid #1e1e21' }}
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-2.5 text-left"
                  style={{ background: '#0d0d0f' }}
                >
                  {header.isPlaceholder ? null : (
                    <div
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider',
                        header.column.getCanSort() &&
                          'cursor-pointer select-none hover:text-[#f0f0f2] transition-colors'
                      )}
                      style={{ color: '#5a5a64' }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getCanSort() && (
                        <span style={{ color: '#3a3a3e' }}>
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </th>
              ))}
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
                  borderBottom: '1px solid #17171a',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.background = 'rgba(255,255,255,0.02)'
                  el.style.borderLeft = '2px solid rgba(212,168,80,0.4)'
                  el.style.paddingLeft = '0'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.background = 'transparent'
                  el.style.borderLeft = 'none'
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-sm"
                    style={{ color: '#f0f0f2' }}
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

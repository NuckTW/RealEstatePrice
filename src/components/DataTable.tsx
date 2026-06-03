'use client'

import { useState, ReactNode } from 'react'

export interface ColDef {
  key: string
  label: string
  barColor?: string
  format?: (v: unknown) => string
  align?: 'left' | 'right' | 'center'
  minWidth?: number
  valueColors?: Record<string, string>  // value → tailwind bg+text classes
}

interface DataTableProps {
  title: string
  columns: ColDef[]
  data: Record<string, unknown>[]
  pageSize?: number
  extra?: ReactNode
  onRowClick?: (row: Record<string, unknown>) => void
}

/* ── Bar cell ─────────────────────────────────────────────── */
function BarCell({ col, value, maxVal }: { col: ColDef; value: unknown; maxVal: number }) {
  const num = Number(value)
  const display = col.format
    ? col.format(value)
    : isNaN(num) ? String(value ?? '—') : num.toLocaleString()
  const pct = maxVal > 0 && !isNaN(num) ? Math.min((num / maxVal) * 100, 100) : 0

  return (
    <td className="px-3 py-2.5 text-right">
      <div
        className="relative inline-flex items-center justify-end rounded-md overflow-hidden h-[24px]"
        style={{ minWidth: col.minWidth ?? 64 }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-md transition-all"
          style={{ width: `${pct}%`, backgroundColor: col.barColor, opacity: 0.18 }}
        />
        {pct > 5 && (
          <div
            className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full"
            style={{ backgroundColor: col.barColor, opacity: 0.7 }}
          />
        )}
        <span className="relative z-10 text-xs font-medium text-gray-200 px-2 whitespace-nowrap tabular-nums">
          {display}
        </span>
      </div>
    </td>
  )
}

/* ── Plain cell ────────────────────────────────────────────── */
function PlainCell({ col, value }: { col: ColDef; value: unknown }) {
  const display = col.format ? col.format(value) : String(value ?? '—')
  const align =
    col.align === 'left' ? 'text-left' :
    col.align === 'center' ? 'text-center' : 'text-right'
  const badgeClass = col.valueColors?.[display]
  return (
    <td className={`px-3 py-2.5 text-xs text-gray-300 whitespace-nowrap ${align}`}>
      {badgeClass ? (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeClass}`}>
          {display}
        </span>
      ) : display}
    </td>
  )
}

/* ── DataTable ─────────────────────────────────────────────── */
export default function DataTable({
  title, columns, data, pageSize = 7, extra, onRowClick,
}: DataTableProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const pageData = data.slice((page - 1) * pageSize, page * pageSize)

  const maxValues = columns
    .filter(c => c.barColor)
    .reduce<Record<string, number>>((acc, col) => {
      acc[col.key] = Math.max(...data.map(r => Number(r[col.key]) || 0), 1)
      return acc
    }, {})

  return (
    <div className="rounded-2xl overflow-hidden border border-white/6 bg-[#0d1420]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-400 to-indigo-500 opacity-70" />
          <span className="text-sm font-semibold text-white">{title}</span>
          {data.length > 0 && (
            <span className="text-[10px] text-gray-600 bg-white/5 rounded-full px-2 py-0.5">
              {data.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {extra}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors flex items-center justify-center text-gray-400"
              >‹</button>
              <span className="tabular-nums">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors flex items-center justify-center text-gray-400"
              >›</button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`
                    px-3 py-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap
                    ${col.align === 'left' ? 'text-left' : 'text-right'}
                  `}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-gray-600 text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl opacity-30">◌</span>
                    <span>無符合條件的資料</span>
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-white/[0.03] transition-colors ${onRowClick ? 'cursor-pointer hover:bg-violet-500/[0.06]' : 'hover:bg-white/[0.03]'}`}
                >
                  {columns.map(col =>
                    col.barColor ? (
                      <BarCell key={col.key} col={col} value={row[col.key]} maxVal={maxValues[col.key] ?? 1} />
                    ) : (
                      <PlainCell key={col.key} col={col} value={row[col.key]} />
                    )
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

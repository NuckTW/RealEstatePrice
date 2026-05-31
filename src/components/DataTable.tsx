'use client'

import { useState, ReactNode } from 'react'

export interface ColDef {
  key: string
  label: string
  barColor?: string          // hex — shows inline progress bar
  format?: (v: unknown) => string
  align?: 'left' | 'right' | 'center'
  minWidth?: number
}

interface DataTableProps {
  title: string
  columns: ColDef[]
  data: Record<string, unknown>[]
  pageSize?: number
  extra?: ReactNode          // optional right-side header content
}

/* ── Mini-bar cell ─────────────────────────────────────────── */
function BarCell({ col, value, maxVal }: { col: ColDef; value: unknown; maxVal: number }) {
  const num = Number(value)
  const display = col.format
    ? col.format(value)
    : isNaN(num) ? String(value ?? '—') : num.toLocaleString()

  const pct = maxVal > 0 && !isNaN(num) ? Math.min((num / maxVal) * 100, 100) : 0

  return (
    <td className="px-2 py-2 text-right">
      <div
        className="relative inline-flex items-center justify-end rounded overflow-hidden h-[26px]"
        style={{ minWidth: col.minWidth ?? 64 }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded"
          style={{ width: `${pct}%`, backgroundColor: col.barColor, opacity: 0.65 }}
        />
        <span className="relative z-10 text-sm font-medium text-white px-2 whitespace-nowrap">
          {display}
        </span>
      </div>
    </td>
  )
}

/* ── Plain cell ────────────────────────────────────────────── */
function PlainCell({ col, value }: { col: ColDef; value: unknown }) {
  const display = col.format
    ? col.format(value)
    : String(value ?? '—')
  const align =
    col.align === 'left' ? 'text-left' :
    col.align === 'center' ? 'text-center' : 'text-right'
  return (
    <td className={`px-3 py-2 text-sm text-gray-200 whitespace-nowrap ${align}`}>
      {display}
    </td>
  )
}

/* ── DataTable ─────────────────────────────────────────────── */
export default function DataTable({
  title, columns, data, pageSize = 7, extra,
}: DataTableProps) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const pageData   = data.slice((page - 1) * pageSize, page * pageSize)

  // Compute max per barred column (across ALL data, not just current page)
  const maxValues = columns
    .filter(c => c.barColor)
    .reduce<Record<string, number>>((acc, col) => {
      acc[col.key] = Math.max(...data.map(r => Number(r[col.key]) || 0), 1)
      return acc
    }, {})

  return (
    <div className="bg-gray-800/40 rounded-xl overflow-hidden border border-gray-700/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60">
        <span className="font-semibold text-white text-sm">{title}</span>
        <div className="flex items-center gap-3">
          {extra}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors"
              >上一頁</button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors"
              >下一頁</button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700/60">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-[11px] text-gray-400 font-medium whitespace-nowrap
                    ${col.align === 'left' ? 'text-left' : 'text-right'}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-gray-500 text-sm">
                  無資料
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors"
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

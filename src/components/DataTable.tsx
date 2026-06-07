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
        <span className="relative z-10 px-2 whitespace-nowrap tabular-nums" style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--text-default)', fontFamily: 'var(--font-mono)' }}>
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
    <td style={{ padding: '10px 12px', fontSize: 'var(--text-xs)', color: 'var(--text-default)', whiteSpace: 'nowrap', textAlign: col.align === 'left' ? 'left' : col.align === 'center' ? 'center' : 'right', fontFamily: 'var(--font-sans)' }}>
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
    <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border-card)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '1px solid var(--border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 4, height: 16, borderRadius: 'var(--radius-full)', background: 'var(--gradient-accent)', flexShrink: 0, display: 'block' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)', fontFamily: 'var(--font-sans)' }}>{title}</span>
          {data.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-faint)', background: 'var(--surface-control)', borderRadius: 'var(--radius-full)', padding: '1px 7px', fontFamily: 'var(--font-mono)' }}>
              {data.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {extra}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ width: 24, height: 24, borderRadius: 'var(--radius-md)', background: 'var(--surface-control)', border: '1px solid var(--border-control)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.3 : 1, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--transition-base)' }}
              >‹</button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ width: 24, height: 24, borderRadius: 'var(--radius-md)', background: 'var(--surface-control)', border: '1px solid var(--border-control)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.3 : 1, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--transition-base)' }}
              >›</button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-card)' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    padding: '8px 12px',
                    fontSize: 'var(--text-3xs)',
                    color: 'var(--text-faint)',
                    fontWeight: 'var(--weight-semibold)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-caps)',
                    whiteSpace: 'nowrap',
                    textAlign: col.align === 'left' ? 'left' : 'right',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 24, opacity: 0.3 }}>◌</span>
                    <span>無符合條件的資料</span>
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  style={{ borderBottom: '1px solid var(--border-card)', cursor: onRowClick ? 'pointer' : 'default', transition: 'var(--transition-base)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = onRowClick ? 'var(--accent-wash)' : 'var(--surface-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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

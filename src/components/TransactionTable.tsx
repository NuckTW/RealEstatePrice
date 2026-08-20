'use client'

import { useEffect, useMemo, useState } from 'react'
import { FilterValues } from './FilterBar'

export interface TransactionRow {
  transaction_date: string
  district: string | null
  project_name: string | null
  address: string | null
  building_type: string | null
  floor: string | null
  total_floors: number | null
  is_presale: boolean
  area: number | null
  unit_price: number | null
  total_price: number | null
  is_special: boolean
  has_addition: boolean
  with_parking: boolean
}

interface Props {
  filters: FilterValues
  /** 沿用 MapView 既有的 onCaseClick 簽名（name, caseType, district），方便 Dashboard 端共用同一支開面板邏輯 */
  onCaseClick: (name: string, caseType: 'presale' | 'existing', district: string) => void
}

const PAGE_SIZE = 50

/** 成屋地址去掉樓層後的門牌（與後端 fetchCaseDetail / fetchCaseRanking 的 REGEXP_REPLACE 邏輯等價） */
const FLOOR_SUFFIX_RE = /[0-9零一二三四五六七八九十百千]+樓.*$/

function addressWithoutFloor(address: string): string {
  return address.replace(FLOOR_SUFFIX_RE, '')
}

function buildQuery(f: FilterValues): string {
  const p = new URLSearchParams({
    dateFromYear: f.dateFromYear, dateFromMonth: f.dateFromMonth,
    dateToYear:   f.dateToYear,   dateToMonth:   f.dateToMonth,
    presale: f.presale, buildingAge: f.buildingAge,
  })
  if (f.types.length > 0)     p.set('types', f.types.join(','))
  if (f.rooms.length > 0)     p.set('rooms', f.rooms.join(','))
  if (f.districts.length > 0) p.set('districts', f.districts.join(','))
  return p.toString()
}

function floorLabel(row: TransactionRow): string {
  if (!row.floor) return '—'
  return row.total_floors != null ? `${row.floor}/${row.total_floors}` : row.floor
}

/* ── 小 badge ──────────────────────────────────────────────── */
function Badge({ text, tone }: { text: string; tone: 'negative' | 'warning' | 'neutral' }) {
  const styles = {
    negative: { background: 'rgba(224,87,63,0.15)', color: 'var(--negative)', border: '1px solid rgba(224,87,63,0.3)' },
    warning:  { background: 'rgba(232,162,59,0.15)', color: 'var(--warning)', border: '1px solid rgba(232,162,59,0.3)' },
    neutral:  { background: 'var(--surface-control)', color: 'var(--text-muted)', border: '1px solid var(--border-control)' },
  }[tone]
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-3xs)', fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
      ...styles,
    }}>{text}</span>
  )
}

/* ── TransactionTable ─────────────────────────────────────── */
export default function TransactionTable({ filters, onCaseClick }: Props) {
  const query = useMemo(() => buildQuery(filters), [filters])

  // 頁 1 資料：以 query 字串當識別鍵，loading 由「手上資料是否對應目前篩選條件」推導，
  // 不在 effect 裡同步呼叫 setState（react-hooks/set-state-in-effect）
  const [data, setData] = useState<{ key: string; rows: TransactionRow[]; hasMore: boolean } | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const errored = errorKey === query
  const loading = !errored && data?.key !== query

  useEffect(() => {
    let cancelled = false
    fetch(`/api/transactions?${query}&limit=${PAGE_SIZE}&offset=0`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (j.error) { setErrorKey(query); return }
        setData({ key: query, rows: j.rows ?? [], hasMore: !!j.hasMore })
      })
      .catch(() => { if (!cancelled) setErrorKey(query) })
    return () => { cancelled = true }
  }, [query])

  // 「載入更多」是使用者操作觸發的 event handler，不是 effect，setState 沒有限制
  const loadMore = () => {
    if (!data || loadingMore) return
    setLoadingMore(true)
    fetch(`/api/transactions?${query}&limit=${PAGE_SIZE}&offset=${data.rows.length}`)
      .then(r => r.json())
      .then(j => {
        if (j.error) return
        setData(d => d ? { ...d, rows: [...d.rows, ...(j.rows ?? [])], hasMore: !!j.hasMore } : d)
      })
      .finally(() => setLoadingMore(false))
  }

  const handleRowClick = (row: TransactionRow) => {
    if (row.is_presale) {
      if (row.project_name) onCaseClick(row.project_name, 'presale', row.district ?? '')
    } else if (row.address) {
      onCaseClick(addressWithoutFloor(row.address), 'existing', row.district ?? '')
    }
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', fontSize: 'var(--text-3xs)', color: 'var(--text-faint)',
    fontWeight: 'var(--weight-semibold)', textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-caps)', whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)', textAlign: 'left',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 'var(--text-xs)', color: 'var(--text-default)',
    whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
  }

  return (
    <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border-card)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '1px solid var(--border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 4, height: 16, borderRadius: 'var(--radius-full)', background: 'var(--gradient-accent)', flexShrink: 0, display: 'block' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)', fontFamily: 'var(--font-sans)' }}>實價登錄明細</span>
          {data && data.rows.length > 0 && (
            <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', background: 'var(--surface-control)', borderRadius: 'var(--radius-full)', padding: '1px 7px', fontFamily: 'var(--font-mono)' }}>
              {data.rows.length}{data.hasMore ? '+' : ''}
            </span>
          )}
        </div>
        {loading && (
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, border: '1.5px solid var(--border-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'tra-spin .6s linear infinite', display: 'inline-block' }} />
            載入中…
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-card)' }}>
              <th style={thStyle}>交易日</th>
              <th style={thStyle}>行政區</th>
              <th style={thStyle}>建案／地址</th>
              <th style={thStyle}>類型</th>
              <th style={thStyle}>建物型態</th>
              <th style={thStyle}>樓層</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>坪數</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>單價(萬/坪)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>總價(萬)</th>
              <th style={thStyle}>註記</th>
            </tr>
          </thead>
          <tbody>
            {errored && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--negative)', fontSize: 'var(--text-sm)' }}>
                  查詢失敗，請稍後再試
                </td>
              </tr>
            )}
            {!errored && !loading && data && data.rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 'var(--text-2xl)', opacity: 0.3 }}>◌</span>
                    <span>無符合條件的資料</span>
                  </div>
                </td>
              </tr>
            )}
            {!errored && data && data.rows.map((row, i) => {
              const clickable = row.is_presale ? !!row.project_name : !!row.address
              return (
                <tr
                  key={i}
                  onClick={clickable ? () => handleRowClick(row) : undefined}
                  style={{ borderBottom: '1px solid var(--border-card)', cursor: clickable ? 'pointer' : 'default', transition: 'var(--transition-base)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = clickable ? 'var(--accent-wash)' : 'transparent' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{row.transaction_date}</td>
                  <td style={tdStyle}>{row.district ?? '—'}</td>
                  <td style={tdStyle}>
                    {row.is_presale ? (row.project_name || '—') : (row.address || '—')}
                  </td>
                  <td style={tdStyle}>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full font-semibold ${row.is_presale ? 'bg-sky-500/20 text-sky-300' : 'bg-teal-500/20 text-teal-300'}`}
                      style={{ fontSize: 'var(--text-3xs)' }}
                    >
                      {row.is_presale ? '預售' : '成屋'}
                    </span>
                  </td>
                  <td style={tdStyle}>{row.building_type ?? '—'}</td>
                  <td style={tdStyle}>{floorLabel(row)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.area ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.unit_price ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.total_price != null ? row.total_price.toLocaleString() : '—'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {row.is_special && <Badge text="特殊關係" tone="negative" />}
                      {row.has_addition && <Badge text="增建" tone="warning" />}
                      {row.with_parking && <Badge text="含車位" tone="neutral" />}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 載入更多 */}
      {data && data.hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-card)' }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              height: 'var(--control-h-sm)', padding: '0 20px',
              borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-sans)', fontWeight: 'var(--weight-semibold)',
              background: 'var(--surface-control)', border: '1px solid var(--border-control)',
              color: 'var(--text-muted)', cursor: loadingMore ? 'not-allowed' : 'pointer',
              opacity: loadingMore ? 0.6 : 1, transition: 'var(--transition-base)',
            }}
          >
            {loadingMore ? '載入中…' : '載入更多'}
          </button>
        </div>
      )}

      <style>{`@keyframes tra-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

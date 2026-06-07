'use client'

import { useEffect, useState } from 'react'
import { FilterValues } from './FilterBar'

interface DetailRow {
  transaction_date: string
  floor: string | null
  total_floors: string | null
  rooms: number
  area: number | null
  unit_price: number | null
  total_price: number | null
  parking_price: string | null
  unit_number: string | null
  building_type: string | null
  main_material: string | null
  main_area: number | null
  aux_area: number | null
  balcony_area: number | null
  land_area: number | null
  urban_land_use: string | null
  parking_type: string | null
  parking_area: number | null
  bathrooms: number | null
  living_rooms: number | null
}

interface Props {
  open: boolean
  caseName: string
  caseType: 'presale' | 'existing'
  district: string
  filters: FilterValues
  onClose: () => void
}

function rocDate(iso: string) {
  const d = new Date(iso)
  const roc = d.getFullYear() - 1911
  return `${roc}年${d.getMonth() + 1}月${d.getDate()}日`
}

function sqm(v: number | null) {
  return v != null && v > 0 ? `${v}坪` : null
}

/* ── 展開明細區塊 ─────────────────────────────────────────────── */
function ExpandedDetail({ row, caseType }: { row: DetailRow; caseType: 'presale' | 'existing' }) {
  const hasAreaBreakdown = caseType === 'existing' &&
    (row.main_area != null || row.aux_area != null || row.balcony_area != null)
  const hasParking = row.parking_type && row.parking_type !== ''
  const hasLand = row.land_area != null && row.land_area > 0

  const label = (text: string) => (
    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 11 }}>{text}</span>
  )
  const val = (text: string) => (
    <span style={{ color: 'var(--text-default)', fontFamily: 'var(--font-sans)', fontSize: 11 }}>{text}</span>
  )
  const sectionHead = (text: string) => (
    <div style={{
      fontSize: 10, color: 'var(--text-faint)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 6, fontFamily: 'var(--font-sans)',
    }}>{text}</div>
  )

  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--bg-sunken)',
      borderTop: '1px solid var(--border-card)',
      display: 'grid', gridTemplateColumns: '1fr', gap: 12,
    }}>
      {/* 棟號 + 建材 + 型態 + 格局 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
        {row.unit_number && (
          <span style={{ display: 'flex', gap: 6 }}>
            {label('棟號')}
            <span style={{ color: 'var(--accent-tint)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>
              {row.unit_number}
            </span>
          </span>
        )}
        {row.building_type && <span style={{ display: 'flex', gap: 6 }}>{label('型態')}{val(row.building_type)}</span>}
        {row.main_material && <span style={{ display: 'flex', gap: 6 }}>{label('建材')}{val(row.main_material)}</span>}
        {row.bathrooms != null && row.bathrooms > 0 && (
          <span style={{ display: 'flex', gap: 6 }}>
            {label('格局')}
            {val(`${row.rooms}房${row.living_rooms ?? 0}廳${row.bathrooms}衛`)}
          </span>
        )}
      </div>

      {/* 建物面積細項（成屋） */}
      {hasAreaBreakdown && (
        <div>
          {sectionHead('建物面積細項')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
            {sqm(row.main_area) && (
              <span style={{ display: 'flex', gap: 6 }}>
                {label('主建物')}
                <span style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>
                  {sqm(row.main_area)}
                </span>
              </span>
            )}
            {sqm(row.aux_area) && <span style={{ display: 'flex', gap: 6 }}>{label('附屬')}{val(sqm(row.aux_area)!)}</span>}
            {sqm(row.balcony_area) && <span style={{ display: 'flex', gap: 6 }}>{label('陽台')}{val(sqm(row.balcony_area)!)}</span>}
            {row.area != null && row.main_area != null && (() => {
              const common = Math.round((row.area - (row.main_area ?? 0) - (row.aux_area ?? 0) - (row.balcony_area ?? 0)) * 10) / 10
              return common > 0 ? (
                <span style={{ display: 'flex', gap: 6 }}>
                  {label('公設')}
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {common}坪 <span style={{ color: 'var(--text-faint)' }}>({Math.round(common / row.area * 100)}%)</span>
                  </span>
                </span>
              ) : null
            })()}
          </div>
        </div>
      )}

      {/* 車位 */}
      {hasParking && (
        <div>
          {sectionHead('車位')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
            <span style={{ display: 'flex', gap: 6 }}>{label('類別')}{val(row.parking_type!)}</span>
            {row.parking_area != null && row.parking_area > 0 && (
              <span style={{ display: 'flex', gap: 6 }}>{label('面積')}{val(`${row.parking_area}坪`)}</span>
            )}
            {row.parking_price !== 'x' && row.parking_price !== '含' && row.parking_price && (
              <span style={{ display: 'flex', gap: 6 }}>
                {label('價格')}
                <span style={{ color: 'var(--secondary-tint)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>
                  {row.parking_price}萬
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* 土地 */}
      {hasLand && (
        <div>
          {sectionHead('土地')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
            <span style={{ display: 'flex', gap: 6 }}>{label('移轉面積')}{val(`${row.land_area}坪`)}</span>
            {row.urban_land_use && <span style={{ display: 'flex', gap: 6 }}>{label('用途')}{val(row.urban_land_use)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 主元件 ──────────────────────────────────────────────────── */
export default function CaseDetailPanel({ open, caseName, caseType, district, filters, onClose }: Props) {
  const [rows, setRows]         = useState<DetailRow[]>([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !caseName) return
    setRows([]); setExpanded(null); setLoading(true)
    const p = new URLSearchParams({
      name: caseName, district,
      case_type:     caseType === 'presale' ? 'presale' : 'existing',
      dateFromYear:  filters.dateFromYear,
      dateFromMonth: filters.dateFromMonth,
      dateToYear:    filters.dateToYear,
      dateToMonth:   filters.dateToMonth,
    })
    fetch(`/api/case-detail?${p}`)
      .then(r => r.json())
      .then(j => setRows(j.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [open, caseName, caseType, district, filters])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const thStyle = (align: 'left' | 'right' | 'center' = 'right') => ({
    padding: '8px 8px',
    fontSize: 10, color: 'var(--text-faint)',
    fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', whiteSpace: 'nowrap' as const,
    fontFamily: 'var(--font-sans)',
    textAlign: align,
    borderBottom: '1px solid var(--border-card)',
    background: 'var(--surface-card)',
  })

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
          transition: 'opacity 300ms',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, zIndex: 3100,
        height: '100%', width: '100%', maxWidth: 720,
        background: 'var(--surface-card)',
        borderLeft: '1px solid var(--border-card)',
        boxShadow: 'var(--shadow-overlay)',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-card)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-sans)',
                background: caseType === 'presale' ? 'rgba(76,168,224,0.15)' : 'rgba(43,179,163,0.15)',
                color: caseType === 'presale' ? 'var(--info)' : 'var(--positive)',
                border: `1px solid ${caseType === 'presale' ? 'rgba(76,168,224,0.3)' : 'rgba(43,179,163,0.3)'}`,
              }}>
                {caseType === 'presale' ? '預售' : '成屋'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{district}</span>
            </div>
            <h2 style={{
              margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-strong)', fontFamily: 'var(--font-sans)',
            }}>{caseName}</h2>
            {!loading && rows.length > 0 && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                共 {rows.length} 筆交易紀錄
                {caseType === 'presale' && <span style={{ color: 'var(--text-faint)', marginLeft: 4 }}>（完整銷售期）</span>}
                <span style={{ color: 'var(--text-faint)', marginLeft: 4 }}>· 點擊列可展開詳情</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              marginTop: 2, width: 28, height: 28,
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-control)',
              border: '1px solid var(--border-control)',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
              color: 'var(--text-muted)', fontSize: 14,
              transition: 'var(--transition-base)',
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.color = 'var(--text-strong)'; el.style.background = 'var(--surface-hover)' }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'var(--text-muted)'; el.style.background = 'var(--surface-control)' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 128, gap: 8, color: 'var(--text-muted)', fontSize: 14 }}>
              <span style={{ width: 16, height: 16, border: '1.5px solid var(--border-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'tra-spin .6s linear infinite', display: 'inline-block' }} />
              載入中…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 128, gap: 8, color: 'var(--text-faint)', fontSize: 14 }}>
              <span style={{ fontSize: 24, opacity: 0.3 }}>◌</span>
              <span style={{ fontFamily: 'var(--font-sans)' }}>無交易紀錄</span>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ ...thStyle('center'), width: 28 }}>#</th>
                  <th style={thStyle('left')}>交易日期</th>
                  <th style={thStyle('left')}>棟號</th>
                  <th style={thStyle('left')}>樓層</th>
                  <th style={thStyle('right')}>房型</th>
                  <th style={thStyle('right')}>坪數</th>
                  <th style={thStyle('right')}>單價(萬/坪)</th>
                  <th style={thStyle('right')}>總價(萬)</th>
                  <th style={thStyle('right')}>車位(萬)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <>
                    <tr
                      key={i}
                      onClick={() => setExpanded(expanded === i ? null : i)}
                      style={{
                        borderBottom: '1px solid var(--border-card)',
                        cursor: 'pointer',
                        background: expanded === i ? 'var(--accent-wash)' : 'transparent',
                        transition: 'var(--transition-base)',
                      }}
                      onMouseEnter={e => {
                        if (expanded !== i) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'
                      }}
                      onMouseLeave={e => {
                        if (expanded !== i) (e.currentTarget as HTMLElement).style.background = 'transparent'
                      }}
                    >
                      {/* # */}
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                        {i + 1}
                      </td>

                      {/* 交易日期 */}
                      <td style={{ padding: '10px 8px', color: 'var(--text-default)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {rocDate(row.transaction_date)}
                      </td>

                      {/* 棟號 */}
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        {row.unit_number
                          ? <span style={{ color: 'var(--accent-tint)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600 }}>{row.unit_number}</span>
                          : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>

                      {/* 樓層 */}
                      <td style={{ padding: '10px 8px', color: 'var(--text-default)', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', fontSize: 11 }}>
                        {row.floor != null
                          ? (row.total_floors != null ? `${row.floor}／共${row.total_floors}層` : row.floor)
                          : '—'}
                      </td>

                      {/* 房型 */}
                      <td style={{ padding: '10px 8px', color: 'var(--text-default)', whiteSpace: 'nowrap', textAlign: 'right', fontFamily: 'var(--font-sans)', fontSize: 11 }}>
                        {row.rooms === 0 ? '0房' : `${row.rooms}房`}
                      </td>

                      {/* 坪數 */}
                      <td style={{ padding: '10px 8px', color: 'var(--text-default)', whiteSpace: 'nowrap', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        {row.area ?? '—'}
                      </td>

                      {/* 單價 */}
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: 'var(--series-3)', fontWeight: 600 }}>{row.unit_price ?? '—'}</span>
                      </td>

                      {/* 總價 */}
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: 'var(--accent-tint)', fontWeight: 600 }}>
                          {row.total_price != null ? row.total_price.toLocaleString() : '—'}
                        </span>
                      </td>

                      {/* 車位 */}
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        {row.parking_price === 'x'
                          ? <span style={{ color: 'var(--text-faint)' }}>x</span>
                          : row.parking_price === '含'
                            ? <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>含</span>
                            : <span style={{ color: 'var(--secondary-tint)' }}>{row.parking_price}</span>}
                      </td>
                    </tr>

                    {/* 展開明細 */}
                    {expanded === i && (
                      <tr key={`exp-${i}`} style={{ borderBottom: '1px solid var(--border-card)' }}>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <ExpandedDetail row={row} caseType={caseType} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`@keyframes tra-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

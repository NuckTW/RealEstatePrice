'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import CaseDetailPanel from '@/components/CaseDetailPanel'
import type { FilterValues } from '@/components/FilterBar'
import type { TrendRow } from '@/components/KpiTrend'
import { priceToColor } from '@/lib/colorScale'
import { filterOnlyQuery } from '@/lib/globalFilters'
import { MAX_SELECT } from '@/lib/areaSelection'
import { POINT_RADII, rocMonth, summarize, type MapMarker, type Selection } from './types'

const KpiTrend = dynamic(() => import('@/components/KpiTrend'), { ssr: false })
const AreaAnalysisPanel = dynamic(() => import('@/components/AreaAnalysisPanel'), { ssr: false })

const LIST_PAGE = 40

interface Props {
  selection: Selection
  /** 目前狀態要列出的建案（視野內／群集／框選範圍） */
  list: MapMarker[]
  markerByKey: Map<string, MapMarker>
  range: [number, number]
  filters: FilterValues
  trend: TrendRow[] | null
  lastDate: string | null
  pointRadius: number
  onPointRadius: (r: number) => void
  onSelect: (s: Selection) => void
  onHover: (key: string | null) => void
  onFocus: (key: string) => void
}

/* ── 小元件 ─────────────────────────────────────────────── */

function Kpi({ label, value, unit, foot }: { label: string; value: ReactNode; unit?: string; foot?: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {unit && <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>{unit}</span>}
      </div>
      {foot && <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', lineHeight: 1.4 }}>{foot}</div>}
    </div>
  )
}

function KpiGrid({ list }: { list: MapMarker[] }) {
  const s = summarize(list)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      <Kpi label="中位單價（依成交加權）" value={s.medianPrice != null ? s.medianPrice.toFixed(1) : '—'} unit="萬/坪" />
      <Kpi label="成交筆數" value={s.txCount.toLocaleString()} unit="筆" foot={`${s.places.toLocaleString()} 個建案／地點`} />
      <Kpi label="預售建案" value={s.presaleCount.toLocaleString()} unit="案" />
      <Kpi label="平均銷售成數" value={s.avgSalesRatio != null ? s.avgSalesRatio : '—'} unit={s.avgSalesRatio != null ? '%' : undefined} foot="預售案，依核准總戶數" />
    </div>
  )
}

function ProjectRow({ m, range, onClick, onHover }: {
  m: MapMarker; range: [number, number]; onClick: () => void; onHover: (k: string | null) => void
}) {
  const color = m.unit_price > 0 ? priceToColor(m.unit_price, range[0], range[1]) : 'rgb(170,160,145)'
  const presale = m.case_type === '預售'
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => onHover(m.location_key)} onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(m.location_key)} onBlur={() => onHover(null)}
      className="ip-row">
      <span aria-hidden style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: presale ? color : 'transparent', border: `2px solid ${color}`,
      }} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
        <span style={{ color: 'var(--text-strong)', fontWeight: 'var(--weight-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.display_name}</span>
        <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>
          {m.district}・{m.case_type}
          {presale && m.sales_ratio != null ? `・銷售 ${m.sales_ratio}%` : ''}
          {m.last_tx_month ? `・最新 ${rocMonth(m.last_tx_month)}` : ''}
        </span>
      </span>
      <span style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-mono)', color: 'var(--text-strong)', fontWeight: 600 }}>{m.unit_price ? m.unit_price.toFixed(1) : '—'}</span>
        <span style={{ display: 'block', fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>{m.count} 筆</span>
      </span>
    </button>
  )
}

function ProjectList({ list, range, onPick, onHover }: {
  list: MapMarker[]; range: [number, number]; onPick: (m: MapMarker) => void; onHover: (k: string | null) => void
}) {
  const [limit, setLimit] = useState(LIST_PAGE)
  const sorted = [...list].sort((a, b) => b.count - a.count)
  if (!sorted.length) {
    return <div style={{ padding: '24px 4px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-xs)' }}>這個範圍內沒有符合篩選條件的建案</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', padding: '0 8px 4px' }}>
        <span>建案（依成交筆數）</span><span>單價 萬/坪</span>
      </div>
      {sorted.slice(0, limit).map(m => (
        <ProjectRow key={m.location_key} m={m} range={range} onClick={() => onPick(m)} onHover={onHover} />
      ))}
      {sorted.length > limit && (
        <button type="button" onClick={() => setLimit(l => l + LIST_PAGE)} className="ip-more">
          顯示更多（還有 {sorted.length - limit} 個）
        </button>
      )}
    </div>
  )
}

function Header({ eyebrow, title, onBack, children }: { eyebrow: string; title: ReactNode; onBack?: () => void; children?: ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-card)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {onBack && (
        <button type="button" onClick={onBack} aria-label="返回" className="ip-back">←</button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>{eyebrow}</div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

/* ── 主元件 ─────────────────────────────────────────────── */

export default function IntelPanel(p: Props) {
  const { selection: sel, list, range, onSelect, onHover, onFocus } = p
  // 框選範圍的多案比較：null = 收起；打開時預設帶入成交前幾名的預售案，可再增刪
  const [compareKeys, setCompareKeys] = useState<string[] | null>(null)
  const comparing = compareKeys !== null

  const pick = (m: MapMarker) => {
    onSelect({ kind: 'project', key: m.location_key, from: sel })
    onFocus(m.location_key)
  }

  /* 建案詳情：直接嵌入既有的明細面板 */
  if (sel.kind === 'project') {
    const m = p.markerByKey.get(sel.key)
    if (!m) return <Header eyebrow="建案" title="找不到這個建案" onBack={() => onSelect(sel.from ?? { kind: 'viewport' })} />
    const presale = m.case_type === '預售'
    const qs = filterOnlyQuery(new URLSearchParams(window.location.search))
    return (
      <CaseDetailPanel
        embedded open
        caseName={m.location_key}
        caseType={presale ? 'presale' : 'existing'}
        district={m.district}
        filters={p.filters}
        onClose={() => onSelect(sel.from ?? { kind: 'viewport' })}
        actions={<>
          <span className="ip-tag">均價 {m.unit_price || '—'} 萬/坪</span>
          {m.avg_total ? <span className="ip-tag">均總價 {m.avg_total.toLocaleString()} 萬</span> : null}
          {presale && m.total_units ? <span className="ip-tag">銷售 {m.sold_total ?? '—'}/{m.total_units} 戶</span> : null}
          <button type="button" className="ip-link" onClick={() => onFocus(m.location_key)}>在地圖上定位</button>
          {presale && <Link className="ip-link" href={`/projects${qs ? `${qs}&` : '?'}projects=${encodeURIComponent(m.location_key)}`}>加入建案比較 →</Link>}
        </>}
      />
    )
  }

  const back = () => { setCompareKeys(null); onSelect({ kind: 'viewport' }) }

  let header: ReactNode
  if (sel.kind === 'viewport') {
    header = <Header eyebrow="目前地圖範圍・依路段代表點統計" title="視野內行情" />
  } else if (sel.kind === 'group') {
    header = <Header eyebrow="依路段代表點統計" title={sel.title} onBack={back} />
  } else {
    header = (
      <Header eyebrow="依路段代表點統計（座標為路名級）" title={sel.shape === 'box' ? '框選範圍' : `落點周邊 ${p.pointRadius.toLocaleString()} 公尺`} onBack={back}>
        {sel.shape === 'point' && (
          <div role="radiogroup" aria-label="半徑" style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {POINT_RADII.map(r => (
              <button key={r} type="button" role="radio" aria-checked={p.pointRadius === r} onClick={() => p.onPointRadius(r)}
                className="ip-chip" data-on={p.pointRadius === r || undefined}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</button>
            ))}
          </div>
        )}
      </Header>
    )
  }

  const presaleKeys = [...list].filter(m => m.case_type === '預售').sort((a, b) => b.count - a.count).slice(0, MAX_SELECT).map(m => m.location_key)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {header}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <KpiGrid list={list} />

        {sel.kind === 'viewport' && p.trend && p.trend.length > 1 && (
          <div>
            <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', marginBottom: 4 }}>依目前篩選條件（不限地圖範圍）</div>
            <KpiTrend rows={p.trend} lastDataDate={p.lastDate} />
          </div>
        )}

        {sel.kind === 'area' && presaleKeys.length > 1 && (
          <button type="button" className="ip-cta" onClick={() => setCompareKeys(comparing ? null : presaleKeys)}>
            {comparing ? '收起比較' : `比較成交前 ${presaleKeys.length} 個預售案的單價與走勢`}
          </button>
        )}
        {sel.kind === 'area' && compareKeys && (
          <AreaAnalysisPanel
            selected={compareKeys}
            onRemove={k => setCompareKeys(ks => (ks ?? []).filter(x => x !== k))}
            onAdd={k => setCompareKeys(ks => (ks ?? []).includes(k) ? ks : [...(ks ?? []), k].slice(0, MAX_SELECT))}
          />
        )}

        <ProjectList key={sel.kind === 'group' ? sel.title : sel.kind} list={list} range={range} onPick={pick} onHover={onHover} />

        <p style={{ margin: 0, fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', lineHeight: 1.5 }}>
          資料來源：內政部不動產交易實價查詢服務網。單價為各案平均，KPI 中位數依成交筆數加權。僅供參考，不構成投資建議。
        </p>
      </div>

      <style>{`
        .ip-row { display:flex; align-items:center; gap:10px; width:100%; padding:8px; border:none; background:transparent;
          border-radius:var(--radius-md); cursor:pointer; font-size:var(--text-xs); font-family:var(--font-sans); color:var(--text-default);
          border-bottom:1px solid var(--border-card); }
        .ip-row:hover, .ip-row:focus-visible { background:var(--accent-wash); outline:none; }
        .ip-more { margin-top:8px; height:32px; border-radius:var(--radius-md); border:1px dashed var(--border-strong);
          background:transparent; color:var(--text-muted); cursor:pointer; font-size:var(--text-xs); font-family:var(--font-sans); }
        .ip-back { width:30px; height:30px; flex-shrink:0; border-radius:var(--radius-md); border:1px solid var(--border-control);
          background:var(--surface-control); color:var(--text-default); cursor:pointer; font-size:var(--text-base); }
        .ip-chip { height:24px; padding:0 10px; border-radius:999px; border:1px solid var(--border-control); background:var(--surface-card);
          color:var(--text-muted); font-size:var(--text-2xs); font-family:var(--font-mono); cursor:pointer; }
        .ip-chip[data-on] { background:var(--accent); border-color:var(--accent); color:var(--on-accent); font-weight:700; }
        .ip-cta { height:34px; border-radius:var(--radius-md); border:1px solid var(--accent-wash-border); background:var(--accent-wash);
          color:var(--accent-tint); font-weight:var(--weight-semibold); cursor:pointer; font-size:var(--text-xs); font-family:var(--font-sans); }
        .ip-tag { font-size:var(--text-3xs); padding:2px 8px; border-radius:999px; background:var(--surface-control); color:var(--text-muted); }
        .ip-link { font-size:var(--text-2xs); color:var(--accent-tint); background:none; border:none; padding:0; cursor:pointer;
          text-decoration:none; font-family:var(--font-sans); font-weight:var(--weight-semibold); }
      `}</style>
    </div>
  )
}

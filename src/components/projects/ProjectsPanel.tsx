'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import CaseDetailPanel from '@/components/CaseDetailPanel'
import type { ProjectPoint } from '@/components/ProjectComparePanel'
import { useGlobalFilters } from '@/hooks/useGlobalFilters'
import { buildApiQuery, filterOnlyQuery } from '@/lib/globalFilters'
import { priceToColor, percentileRange } from '@/lib/colorScale'

const ProjectCompareChart = dynamic(() => import('@/components/ProjectCompareChart'), {
  ssr: false,
  loading: () => <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>圖表載入中…</div>,
})

interface Project extends ProjectPoint { txPresale?: number }

const MAX_COMPARE = 8
const PAGE = 30
const ISO_LINES = [600, 800, 1000, 1200, 1500, 2000]

type SortKey = 'txCount' | 'priceMedian' | 'areaMedian' | 'totalMedian' | 'lastTx' | 'name'
const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right' }[] = [
  { key: 'name',        label: '建案',          align: 'left' },
  { key: 'txCount',     label: '成交筆數' },
  { key: 'priceMedian', label: '中位單價（萬/坪）' },
  { key: 'areaMedian',  label: '中位坪數' },
  { key: 'totalMedian', label: '中位總價（萬）' },
  { key: 'lastTx',      label: '最新成交' },
]

function rocYm(iso: string): string {
  if (!iso || iso.length < 7) return '—'
  return `${parseInt(iso.slice(0, 4)) - 1911}/${iso.slice(5, 7)}`
}

/** 寫回網址的比較籃（?projects=a,b,c），保留其他參數 */
function writeCompare(keys: string[]) {
  const p = new URLSearchParams(window.location.search)
  if (keys.length) p.set('projects', keys.join(',')); else p.delete('projects')
  const qs = p.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
}

/** 單價區間 bar：p25–p75 為淺色帶，中位數為深色刻度 */
function RangeBar({ p, scale, color }: { p: Project; scale: [number, number]; color: string }) {
  const [lo, hi] = scale
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100))}%`
  return (
    <span aria-hidden style={{ position: 'relative', display: 'block', height: 6, borderRadius: 3, background: 'var(--surface-control)', marginTop: 4 }}>
      {p.priceP25 != null && p.priceP75 != null && (
        <span style={{ position: 'absolute', top: 0, bottom: 0, left: pos(p.priceP25), width: `calc(${pos(p.priceP75)} - ${pos(p.priceP25)})`, borderRadius: 3, background: color, opacity: 0.45 }} />
      )}
      <span style={{ position: 'absolute', top: -3, width: 2, height: 12, left: pos(p.priceMedian), background: 'var(--text-strong)' }} />
    </span>
  )
}

export default function ProjectsPanel() {
  const { filters } = useGlobalFilters()
  const sp = useSearchParams()
  const key = buildApiQuery(filters)

  const [res, setRes] = useState<{ key: string; projects: Project[]; minReliableTx: number } | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/project-compare?${key}`)
      .then(r => r.json())
      .then(j => { if (alive) setRes({ key, projects: j.projects ?? [], minReliableTx: j.minReliableTx ?? 10 }) })
      .catch(() => { if (alive) setRes({ key, projects: [], minReliableTx: 10 }) })
    return () => { alive = false }
  }, [key])
  const projects = useMemo(() => res?.projects ?? [], [res])
  const loading = res?.key !== key

  const [q, setQ] = useState(() => sp.get('q') ?? '')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'txCount', dir: -1 })
  const [limit, setLimit] = useState(PAGE)
  const [compare, setCompare] = useState<string[]>(() => (sp.get('projects') ?? '').split(',').filter(Boolean).slice(0, MAX_COMPARE))
  const [detail, setDetail] = useState<Project | null>(null)

  const byKey = useMemo(() => new Map(projects.map(p => [p.key, p])), [projects])
  const scale = useMemo(() => percentileRange(projects.map(p => p.priceMedian), 0.02, 0.98), [projects])

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const list = kw ? projects.filter(p => p.name.toLowerCase().includes(kw) || p.district.includes(kw)) : projects
    const k = sort.key
    return [...list].sort((a, b) => {
      const va = a[k], vb = b[k]
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'zh-Hant') * sort.dir
      return ((Number(va) || 0) - (Number(vb) || 0)) * sort.dir
    })
  }, [projects, q, sort])

  const toggleCompare = (k: string) => {
    setCompare(prev => {
      const next = prev.includes(k) ? prev.filter(x => x !== k) : prev.length >= MAX_COMPARE ? prev : [...prev, k]
      writeCompare(next)
      return next
    })
  }
  const clearCompare = () => { setCompare([]); writeCompare([]) }

  const compared = compare.map(k => byKey.get(k)).filter((p): p is Project => !!p)
  const setSortKey = (k: SortKey) => setSort(s => s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: k === 'name' ? 1 : -1 })
  const filterQs = filterOnlyQuery(sp)

  const headerCell = (c: (typeof COLUMNS)[number]) => {
    const on = sort.key === c.key
    return (
      <th key={c.key} scope="col" aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} style={{ textAlign: c.align ?? 'right' }}>
        <button type="button" onClick={() => setSortKey(c.key)} className="pj-sort" data-on={on || undefined}>
          {c.label}{on ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
        </button>
      </th>
    )
  }

  const nameCell = (p: Project): ReactNode => (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <button type="button" className="pj-name" onClick={() => setDetail(p)}>{p.name}</button>
      <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>
        {p.district}・{p.buildingType || '—'}
        {!p.reliable && <span className="pj-warn">樣本少</span>}
      </span>
    </span>
  )

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))', paddingRight: 'max(20px, env(safe-area-inset-right, 0px))', paddingBottom: compare.length ? 120 : 40 }}>
      <div style={{ padding: '20px 0 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>建案</h1>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            各案完整銷售期的中位數（不受篩選列期間影響，其他篩選條件有效）。勾選最多 {MAX_COMPARE} 案放進比較籃。
          </p>
        </div>
        <input id="pj-search" type="search" value={q} onChange={e => { setQ(e.target.value); setLimit(PAGE) }}
          placeholder="搜尋建案名稱或行政區" aria-label="搜尋建案" className="pj-search" />
      </div>

      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', marginBottom: 6 }}>
        {loading ? '載入中…' : `共 ${rows.length.toLocaleString()} 案${q ? `（搜尋「${q}」）` : ''}・成交少於 ${res?.minReliableTx ?? 10} 筆者中位數僅供參考`}
      </div>

      {/* 桌機：表格 */}
      <div className="hidden md:block pj-tablewrap">
        <table className="pj-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: 36 }}><span className="sr-only">加入比較</span></th>
              {COLUMNS.map(headerCell)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map(p => {
              const color = priceToColor(p.priceMedian, scale[0], scale[1])
              const on = compare.includes(p.key)
              return (
                <tr key={p.key} data-on={on || undefined} style={{ opacity: p.reliable ? 1 : 0.75 }}>
                  <td>
                    <input type="checkbox" aria-label={`把 ${p.name} 加入比較`} checked={on}
                      disabled={!on && compare.length >= MAX_COMPARE} onChange={() => toggleCompare(p.key)}
                      style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                  </td>
                  <td style={{ textAlign: 'left', maxWidth: 320 }}>{nameCell(p)}</td>
                  <td>{p.txCount.toLocaleString()}</td>
                  <td style={{ minWidth: 150 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <i aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      <b className="mono">{p.priceMedian.toFixed(1)}</b>
                    </span>
                    <RangeBar p={p} scale={scale} color={color} />
                  </td>
                  <td className="mono">{p.areaMedian.toFixed(1)}</td>
                  <td className="mono">{p.totalMedian.toLocaleString()}</td>
                  <td className="mono">{rocYm(p.lastTx)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 手機：卡片列 */}
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {COLUMNS.filter(c => c.key !== 'name').map(c => (
            <button key={c.key} type="button" onClick={() => setSortKey(c.key)} className="pj-sortchip" data-on={sort.key === c.key || undefined}>
              {c.label.replace(/（.*）/, '')}{sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
            </button>
          ))}
        </div>
        {rows.slice(0, limit).map(p => {
          const color = priceToColor(p.priceMedian, scale[0], scale[1])
          const on = compare.includes(p.key)
          return (
            <div key={p.key} className="pj-card" data-on={on || undefined}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" aria-label={`把 ${p.name} 加入比較`} checked={on}
                  disabled={!on && compare.length >= MAX_COMPARE} onChange={() => toggleCompare(p.key)}
                  style={{ accentColor: 'var(--accent)', width: 18, height: 18, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>{nameCell(p)}</div>
                <div style={{ textAlign: 'right' }}>
                  <b className="mono" style={{ color: 'var(--text-strong)' }}>{p.priceMedian.toFixed(1)}</b>
                  <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>萬/坪</div>
                </div>
              </div>
              <RangeBar p={p} scale={scale} color={color} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-3xs)', color: 'var(--text-muted)', marginTop: 6 }}>
                <span>{p.txCount} 筆</span><span>{p.areaMedian.toFixed(1)} 坪</span><span>{p.totalMedian.toLocaleString()} 萬</span><span>最新 {rocYm(p.lastTx)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {rows.length > limit && (
        <button type="button" onClick={() => setLimit(l => l + PAGE)} className="pj-more">顯示更多（還有 {(rows.length - limit).toLocaleString()} 案）</button>
      )}

      {/* 比較區：選 2 案以上才出現 */}
      {compared.length >= 2 && (
        <section id="compare" aria-labelledby="compare-h" style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12, scrollMarginTop: 'calc(var(--nav-h) + var(--chips-h) + 12px)' }}>
          <h2 id="compare-h" style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}>比較 {compared.length} 案</h2>
          <div className="pj-box">
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginBottom: 6 }}>中位坪數 × 中位單價定位產品；虛線為總價等值線（萬）</div>
            <ProjectCompareChart points={compared} isoLines={ISO_LINES} height={420} />
          </div>
          <div className="pj-box" style={{ overflowX: 'auto' }}>
            <table className="pj-table pj-spec">
              <thead>
                <tr><th scope="col" style={{ textAlign: 'left' }}>項目</th>{compared.map(p => <th key={p.key} scope="col">{p.name}</th>)}</tr>
              </thead>
              <tbody>
                {([
                  ['行政區', (p: Project) => p.district],
                  ['類型', (p: Project) => p.buildingType || '—'],
                  ['中位單價', (p: Project) => `${p.priceMedian.toFixed(1)} 萬/坪`],
                  ['單價 P25–P75', (p: Project) => p.priceP25 != null && p.priceP75 != null ? `${p.priceP25.toFixed(1)}–${p.priceP75.toFixed(1)}` : '—'],
                  ['中位坪數', (p: Project) => `${p.areaMedian.toFixed(1)} 坪`],
                  ['中位總價', (p: Project) => `${p.totalMedian.toLocaleString()} 萬`],
                  ['成交筆數', (p: Project) => `${p.txCount}${p.reliable ? '' : '（樣本少）'}`],
                  ['銷售期間', (p: Project) => `${rocYm(p.firstTx)} – ${rocYm(p.lastTx)}`],
                ] as [string, (p: Project) => string][]).map(([label, fn]) => (
                  <tr key={label}><th scope="row" style={{ textAlign: 'left' }}>{label}</th>{compared.map(p => <td key={p.key}>{fn(p)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 比較籃（固定在底部） */}
      {compare.length > 0 && (
        <div className="pj-basket" role="region" aria-label="比較籃">
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', flexShrink: 0 }}>比較籃 {compare.length}/{MAX_COMPARE}</span>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1, minWidth: 0 }}>
            {compare.map(k => (
              <button key={k} type="button" onClick={() => toggleCompare(k)} className="pj-basketchip" title="移出比較籃">
                {byKey.get(k)?.name ?? k} ✕
              </button>
            ))}
          </div>
          <button type="button" onClick={clearCompare} className="pj-sortchip">清空</button>
          <a href="#compare" className="pj-go" aria-disabled={compare.length < 2}>{compare.length < 2 ? '再選 1 案' : '看比較 ↓'}</a>
        </div>
      )}

      <CaseDetailPanel
        open={!!detail}
        caseName={detail?.name ?? ''}
        caseType={detail && (detail.txPresale ?? 0) > 0 ? 'presale' : 'existing'}
        district={detail?.district ?? ''}
        filters={filters}
        onClose={() => setDetail(null)}
        actions={detail && (
          <>
            <Link className="pj-link" href={`/${filterQs ? `${filterQs}&` : '?'}project=${encodeURIComponent(detail.name)}`}>在地圖上看 →</Link>
            <button type="button" className="pj-link" onClick={() => toggleCompare(detail.key)}>
              {compare.includes(detail.key) ? '移出比較籃' : '加入比較籃'}
            </button>
          </>
        )}
      />

      <style>{`
        .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
        .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
        .pj-search { height:36px; width:min(320px, 100%); padding:0 14px; border-radius:var(--radius-lg); border:1px solid var(--border-control);
          background:var(--surface-card); color:var(--text-default); font-size:var(--text-sm); font-family:var(--font-sans); outline:none; }
        .pj-search:focus { border-color: var(--accent); }
        .pj-tablewrap { border:1px solid var(--border-card); border-radius:var(--radius-xl); background:var(--surface-card); overflow-x:auto; }
        .pj-table { width:100%; border-collapse:collapse; font-size:var(--text-xs); color:var(--text-default); }
        .pj-table th, .pj-table td { padding:9px 12px; text-align:right; border-bottom:1px solid var(--border-card); white-space:nowrap; }
        .pj-table thead th { position:sticky; top:0; background:var(--surface-card); font-weight:500; color:var(--text-muted); font-size:var(--text-2xs); }
        .pj-table tbody tr:hover { background: var(--surface-hover); }
        .pj-table tbody tr[data-on] { background: var(--accent-wash); }
        .pj-spec td, .pj-spec th { white-space: normal; min-width: 110px; }
        .pj-sort { background:none; border:none; padding:0; cursor:pointer; color:inherit; font:inherit; }
        .pj-sort[data-on] { color: var(--accent-tint); font-weight: 700; }
        .pj-name { background:none; border:none; padding:0; cursor:pointer; text-align:left; color:var(--text-strong); font-weight:600;
          font-size:var(--text-xs); font-family:var(--font-sans); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
        .pj-name:hover { color: var(--accent-tint); text-decoration: underline; }
        .pj-warn { margin-left:6px; padding:0 6px; border-radius:999px; border:1px solid var(--border-control); color:var(--text-faint); }
        .pj-card { padding:12px; border:1px solid var(--border-card); border-radius:var(--radius-lg); background:var(--surface-card); }
        .pj-card[data-on] { border-color: var(--accent-wash-border); background: var(--accent-wash); }
        .pj-sortchip { flex-shrink:0; height:28px; padding:0 12px; border-radius:999px; border:1px solid var(--border-control);
          background:var(--surface-card); color:var(--text-muted); font-size:var(--text-2xs); font-family:var(--font-sans); cursor:pointer; }
        .pj-sortchip[data-on] { background:var(--accent-wash); color:var(--accent-tint); border-color:var(--accent-wash-border); font-weight:600; }
        .pj-more { margin-top:12px; width:100%; height:38px; border-radius:var(--radius-lg); border:1px dashed var(--border-strong);
          background:transparent; color:var(--text-muted); cursor:pointer; font-size:var(--text-xs); font-family:var(--font-sans); }
        .pj-box { padding:16px; border:1px solid var(--border-card); border-radius:var(--radius-xl); background:var(--surface-card); }
        .pj-basket { position:fixed; left:50%; transform:translateX(-50%); bottom:calc(var(--tabbar-h) + 12px); z-index:2050;
          width:min(960px, calc(100vw - 24px)); display:flex; align-items:center; gap:10px; padding:10px 12px;
          background:var(--surface-overlay); border:1px solid var(--border-strong); border-radius:var(--radius-xl); box-shadow:var(--shadow-overlay); }
        .pj-basketchip { flex-shrink:0; height:28px; padding:0 10px; border-radius:999px; border:1px solid var(--accent-wash-border);
          background:var(--accent-wash); color:var(--accent-tint); font-size:var(--text-2xs); font-family:var(--font-sans); cursor:pointer; white-space:nowrap; }
        .pj-go { flex-shrink:0; height:32px; display:inline-flex; align-items:center; padding:0 14px; border-radius:var(--radius-md);
          background:var(--accent); color:var(--on-accent); font-size:var(--text-xs); font-weight:700; text-decoration:none; }
        .pj-go[aria-disabled="true"] { background:var(--surface-control); color:var(--text-faint); pointer-events:none; }
        .pj-link { font-size:var(--text-2xs); color:var(--accent-tint); background:none; border:none; padding:0; cursor:pointer;
          text-decoration:none; font-family:var(--font-sans); font-weight:600; }
      `}</style>
    </div>
  )
}

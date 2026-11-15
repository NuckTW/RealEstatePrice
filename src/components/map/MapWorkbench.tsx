'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGlobalFilters } from '@/hooks/useGlobalFilters'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSite } from '@/components/shell/SiteContext'
import BottomSheet, { type SheetSnap } from '@/components/shell/BottomSheet'
import type { TrendRow } from '@/components/KpiTrend'
import { buildApiQuery } from '@/lib/globalFilters'
import { percentileRange } from '@/lib/colorScale'
import WorkbenchMap, { type AreaShape } from './WorkbenchMap'
import IntelPanel from './IntelPanel'
import {
  distanceMeters, inBounds, type Bounds, type MapMarker, type MapTool, type Selection,
} from './types'

const EMPTY: MapMarker[] = []

/**
 * 首頁「行情地圖」工作台：App 式版面，整頁不捲動。
 *  - 桌機：左地圖 60%、右情報欄 40%，兩欄各自捲動
 *  - 手機：地圖全螢幕＋三段式 bottom sheet
 * 標記資料在這裡抓一次，地圖與情報欄共用（情報欄的 KPI 直接從標記算，不必再打 API）。
 */
export default function MapWorkbench() {
  const { filters } = useGlobalFilters()
  const { lastDate } = useSite()
  const sp = useSearchParams()
  const isMobile = useIsMobile()
  const apiQuery = buildApiQuery(filters)

  /* ── 資料：標記、月度走勢（資料連同查詢鍵一起存，loading 由兩者是否一致推導） ── */
  const [mres, setMres] = useState<{ key: string; markers: MapMarker[] } | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/map?${apiQuery}`)
      .then(r => r.json())
      .then(j => { if (alive) setMres({ key: apiQuery, markers: j.markers ?? [] }) })
      .catch(() => { if (alive) setMres(prev => ({ key: apiQuery, markers: prev?.markers ?? [] })) })
    return () => { alive = false }
  }, [apiQuery])
  const markers = mres?.markers ?? EMPTY
  const loading = mres?.key !== apiQuery

  const [tres, setTres] = useState<{ key: string; trend: TrendRow[] } | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/trend?${apiQuery}`)
      .then(r => r.json())
      .then(j => { if (alive) setTres({ key: apiQuery, trend: j.trend ?? [] }) })
      .catch(() => { if (alive) setTres({ key: apiQuery, trend: [] }) })
    return () => { alive = false }
  }, [apiQuery])

  const markerByKey = useMemo(() => new Map(markers.map(m => [m.location_key, m])), [markers])
  // 色階範圍：有預售就看預售單價（熱力圖也只畫預售），取 p5–p95
  const range = useMemo<[number, number]>(() => {
    const pre = markers.filter(m => m.case_type === '預售').map(m => m.unit_price)
    return percentileRange(pre.length ? pre : markers.map(m => m.unit_price))
  }, [markers])

  /* ── 介面狀態 ── */
  const [viewMode, setViewMode] = useState<'marker' | 'heat'>('marker')
  const [tool, setTool] = useState<MapTool>('none')
  const [pointRadius, setPointRadius] = useState(1000)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [sel, setSel] = useState<Selection>({ kind: 'viewport' })
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ key: string; n: number } | null>(null)
  const [snap, setSnap] = useState<SheetSnap>('peek')
  const [q, setQ] = useState('')

  // 篩選條件變了：群集／框選的清單已失效，回到視野摘要（React「依 props 調整 state」寫法，不用 effect）
  const [prevQuery, setPrevQuery] = useState(apiQuery)
  if (prevQuery !== apiQuery) {
    setPrevQuery(apiQuery)
    if (sel.kind === 'group' || sel.kind === 'area') setSel({ kind: 'viewport' })
  }

  // 從建案頁「在地圖上看」進來（?project=）：標記載入後選取並定位一次
  const [initDone, setInitDone] = useState(false)
  if (!initDone && !loading) {
    setInitDone(true)
    const pk = sp.get('project')
    if (pk && markerByKey.has(pk)) {
      setSel({ kind: 'project', key: pk })
      setFocus({ key: pk, n: 1 })
      setSnap('half')
    }
  }

  const focusOn = (key: string) => setFocus(f => ({ key, n: (f?.n ?? 0) + 1 }))
  const select = (s: Selection) => {
    setSel(s)
    if (isMobile && s.kind !== 'viewport') setSnap('half')
  }

  /* ── 情報欄要列的建案 ── */
  const list = useMemo<MapMarker[]>(() => {
    if (sel.kind === 'viewport') return bounds ? markers.filter(m => inBounds(m, bounds)) : markers
    if (sel.kind === 'group') return sel.keys.map(k => markerByKey.get(k)).filter((m): m is MapMarker => !!m)
    if (sel.kind === 'area') {
      if (sel.shape === 'box') {
        const [[s, w], [n, e]] = sel.bounds
        return markers.filter(m => inBounds(m, { south: s, west: w, north: n, east: e }))
      }
      return markers.filter(m => distanceMeters([m.lat, m.lon], sel.center) <= pointRadius)
    }
    return []
  }, [sel, bounds, markers, markerByKey, pointRadius])

  const highlightKeys = useMemo(() => {
    if (sel.kind === 'project') return [sel.key]
    if (sel.kind === 'group' || sel.kind === 'area') return list.map(m => m.location_key)
    return []
  }, [sel, list])

  const area = useMemo<AreaShape | null>(() => {
    if (sel.kind !== 'area') return null
    return sel.shape === 'box' ? { shape: 'box', bounds: sel.bounds } : { shape: 'point', center: sel.center, radius: pointRadius }
  }, [sel, pointRadius])

  const suggestions = useMemo(() => {
    const kw = q.trim()
    if (!kw) return []
    return markers.filter(m => m.display_name.includes(kw)).sort((a, b) => b.count - a.count).slice(0, 8)
  }, [q, markers])

  const pickSuggestion = (m: MapMarker) => {
    setQ('')
    select({ kind: 'project', key: m.location_key })
    focusOn(m.location_key)
  }

  const selKey = sel.kind === 'project' ? `p:${sel.key}` : sel.kind === 'group' ? `g:${sel.title}:${sel.keys.length}` : sel.kind === 'area' ? `a:${sel.shape}` : 'v'
  const panel = (
    <IntelPanel
      key={selKey}
      selection={sel} list={list} markerByKey={markerByKey} range={range}
      filters={filters} trend={tres?.trend ?? null} lastDate={lastDate}
      pointRadius={pointRadius} onPointRadius={setPointRadius}
      onSelect={select} onHover={setHoverKey} onFocus={focusOn}
    />
  )

  return (
    <div style={{
      height: 'calc(100dvh - var(--nav-h) - var(--chips-h) - var(--tabbar-h))',
      display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 3fr) minmax(360px, 2fr)',
    }}>
      <div style={{ position: 'relative', minHeight: 0, minWidth: 0 }}>
        <WorkbenchMap
          markers={markers} loading={loading} range={range} viewMode={viewMode} tool={tool}
          highlightKeys={highlightKeys} hoverKey={hoverKey}
          focusKey={focus?.key ?? null} focusNonce={focus?.n ?? 0} area={area}
          onViewportChange={b => setBounds(b)}
          onSelectKeys={(keys, source) => {
            if (keys.length === 1) select({ kind: 'project', key: keys[0], from: sel.kind === 'project' ? undefined : sel })
            else select({ kind: 'group', keys, title: source === 'cluster' ? `這個群集的 ${keys.length} 個建案／地點` : `同一路段代表點的 ${keys.length} 個建案` })
          }}
          onBoxSelect={b => { select({ kind: 'area', shape: 'box', bounds: b }); setTool('none') }}
          onPointSelect={c => { select({ kind: 'area', shape: 'point', center: c }); setTool('none') }}
        />

        {/* 工具列（浮在地圖上） */}
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12, zIndex: 1050,
          display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', pointerEvents: 'none',
        }}>
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320, pointerEvents: 'auto' }}>
            <input
              id="wb-search" type="search" value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && suggestions[0]) pickSuggestion(suggestions[0]) }}
              placeholder="搜尋建案或地址" aria-label="搜尋建案或地址" className="wb-search"
            />
            {suggestions.length > 0 && (
              <ul role="listbox" className="wb-suggest">
                {suggestions.map(m => (
                  <li key={m.location_key}>
                    <button type="button" onClick={() => pickSuggestion(m)}>
                      <span>{m.display_name}</span>
                      <span style={{ color: 'var(--text-faint)' }}>{m.district}・{m.case_type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div className="wb-seg" role="radiogroup" aria-label="地圖顯示">
              {([['marker', '群集'], ['heat', '價格熱力']] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={viewMode === v} data-on={viewMode === v || undefined} onClick={() => setViewMode(v)}>{l}</button>
              ))}
            </div>
            <div className="wb-seg" aria-label="選取工具">
              {!isMobile && (
                <button type="button" aria-pressed={tool === 'box'} data-on={tool === 'box' || undefined} onClick={() => setTool(t => t === 'box' ? 'none' : 'box')}>▭ 框選</button>
              )}
              <button type="button" aria-pressed={tool === 'point'} data-on={tool === 'point' || undefined} onClick={() => setTool(t => t === 'point' ? 'none' : 'point')}>◎ 落點</button>
            </div>
          </div>
        </div>

        {tool !== 'none' && (
          <div role="status" style={{
            position: 'absolute', left: '50%', top: isMobile ? 104 : 60, transform: 'translateX(-50%)', zIndex: 1050,
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 6px 14px', borderRadius: 999,
            background: 'var(--text-strong)', color: 'var(--bg-app)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap',
          }}>
            {tool === 'box' ? '在地圖上按住拖曳，畫出要統計的範圍' : `點地圖選擇中心點（半徑 ${pointRadius.toLocaleString()} 公尺）`}
            <button type="button" onClick={() => setTool('none')} style={{
              border: 'none', borderRadius: 999, padding: '2px 10px', cursor: 'pointer',
              background: 'var(--bg-app)', color: 'var(--text-strong)', fontSize: 'var(--text-2xs)',
            }}>取消</button>
          </div>
        )}

        {isMobile && <BottomSheet snap={snap} onSnapChange={setSnap}>{panel}</BottomSheet>}
      </div>

      {!isMobile && (
        <aside aria-label="區域情報" style={{ minHeight: 0, overflowY: 'auto', borderLeft: '1px solid var(--border-card)', background: 'var(--bg-app)' }}>
          {panel}
        </aside>
      )}

      <style>{`
        .wb-search { width:100%; height:38px; padding:0 14px; border-radius:var(--radius-lg); border:1px solid var(--border-control);
          background:var(--surface-overlay); color:var(--text-default); font-size:var(--text-sm); font-family:var(--font-sans);
          box-shadow:var(--shadow-pop); outline:none; }
        .wb-search:focus { border-color:var(--accent); }
        .wb-suggest { position:absolute; top:calc(100% + 4px); left:0; right:0; margin:0; padding:4px; list-style:none; z-index:1;
          background:var(--surface-overlay); border:1px solid var(--border-strong); border-radius:var(--radius-lg); box-shadow:var(--shadow-pop); }
        .wb-suggest button { width:100%; display:flex; justify-content:space-between; gap:8px; padding:7px 10px; border:none; background:transparent;
          border-radius:var(--radius-md); cursor:pointer; font-size:var(--text-xs); color:var(--text-default); font-family:var(--font-sans); text-align:left; }
        .wb-suggest button:hover { background:var(--accent-wash); }
        .wb-seg { display:inline-flex; padding:3px; gap:2px; border-radius:999px; background:var(--surface-overlay);
          border:1px solid var(--border-control); box-shadow:var(--shadow-pop); }
        .wb-seg button { height:30px; padding:0 12px; border:none; border-radius:999px; background:transparent; cursor:pointer;
          color:var(--text-muted); font-size:var(--text-xs); font-family:var(--font-sans); white-space:nowrap; }
        .wb-seg button[data-on] { background:var(--accent); color:var(--on-accent); font-weight:var(--weight-semibold); }
        .wb-seg button:focus-visible, .wb-search:focus-visible { outline:2px solid var(--focus-ring); outline-offset:2px; }
      `}</style>
    </div>
  )
}

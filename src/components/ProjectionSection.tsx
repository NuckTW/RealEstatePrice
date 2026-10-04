'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

const OneLineChart = dynamic(() => import('./MarketCharts').then(m => m.OneLineChart), {
  ssr: false,
  loading: () => <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>圖表載入中…</div>,
})

export interface ProjectionData {
  edition: string | null
  rows: { scope: string; area: string; year: number; total: number; a2534: number; a3544: number; a65p: number }[]
}

type Scope = '中推估' | '高推估' | '低推估'
/** 表格比較的年數：基準年 → +10 年（API 另提供 +5、+20） */
const HORIZONS = [5, 10, 20] as const

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 'var(--radius-lg)', padding: 16,
}
const pct = (a: number | undefined, b: number | undefined) => (a != null && b) ? (a / b - 1) * 100 : null
const wan = (v: number) => `${(v / 10000).toFixed(0)}萬`

export default function ProjectionSection({ data, highlightDistrict }: { data: ProjectionData; highlightDistrict?: string }) {
  const [scope, setScope] = useState<Scope>('中推估')
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(10)

  const view = useMemo(() => {
    const rows = data.rows.filter(r => r.scope === scope)
    const city = rows.filter(r => r.area === '臺南市').sort((a, b) => a.year - b.year)
    const y0 = city[0]?.year
    if (y0 == null) return null
    const y1 = y0 + horizon
    const at = (area: string, y: number) => rows.find(r => r.area === area && r.year === y)
    const districts = [...new Set(rows.map(r => r.area))].filter(a => a !== '臺南市').map(a => {
      const b = at(a, y0), f = at(a, y1)
      return {
        area: a, base: b?.total ?? null, future: f?.total ?? null,
        totalChg: pct(f?.total, b?.total),
        buyerChg: pct(f ? f.a2534 + f.a3544 : undefined, b ? b.a2534 + b.a3544 : undefined),
        old: f ? f.a65p / f.total * 100 : null,
      }
    }).sort((a, b) => (b.buyerChg ?? -999) - (a.buyerChg ?? -999))
    const cb = at('臺南市', y0), cf = at('臺南市', y1)
    return {
      y0, y1, districts,
      totalSeries: city.filter(r => r.year <= y0 + 30).map(r => ({ label: String(r.year), v: r.total })),
      buyerSeries: city.filter(r => r.year <= y0 + 30).map(r => ({ label: String(r.year), v: r.a2534 + r.a3544 })),
      cityTotalChg: pct(cf?.total, cb?.total),
      cityBuyerChg: pct(cf ? cf.a2534 + cf.a3544 : undefined, cb ? cb.a2534 + cb.a3544 : undefined),
    }
  }, [data, scope, horizon])

  if (!view) return null
  const chgCell = (v: number | null) => (
    <span style={{ color: v == null ? 'var(--text-faint)' : v >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
      {v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
    </span>
  )
  const seg = (opts: readonly (string | number)[], cur: string | number, on: (v: never) => void, fmt: (v: string | number) => string) => (
    <div role="tablist" style={{ display: 'inline-flex', padding: 3, gap: 3, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)', border: '1px solid var(--border-control)' }}>
      {opts.map(o => (
        <button key={o} role="tab" aria-selected={cur === o} onClick={() => on(o as never)} style={{
          height: 'var(--control-h-sm)', padding: '0 12px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
          fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
          background: cur === o ? 'var(--accent)' : 'transparent', color: cur === o ? 'var(--on-accent)' : 'var(--text-muted)',
        }}>{fmt(o)}</button>
      ))}
    </div>
  )
  const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-card)' }
  const td: React.CSSProperties = { padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>未來人口推估（行政區）</span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
          臺南市政府 {data.edition ?? ''} 版；購屋主力 = 25–44 歲；不計入村里指數
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        {seg(['中推估', '高推估', '低推估'], scope, setScope as (v: never) => void, v => String(v))}
        {seg(HORIZONS, horizon, setHorizon as (v: never) => void, v => `${v} 年後`)}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
          全市 {view.y0} → {view.y1}：總人口 {chgCell(view.cityTotalChg)}、25–44 歲 {chgCell(view.cityBuyerChg)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 18, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)' }}>全市總人口（{scope}）</div>
          <OneLineChart rows={view.totalSeries} name="總人口" unit=" 人" tickFormatter={wan} />
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginTop: 8 }}>全市 25–44 歲人口（{scope}）</div>
          <OneLineChart rows={view.buyerSeries} name="25–44 歲" unit=" 人" tickFormatter={wan} />
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 460 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-card)' }}>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>行政區</th>
                <th style={th}>{view.y0} 人口</th>
                <th style={th}>{view.y1} 人口</th>
                <th style={th}>總人口</th>
                <th style={th}>25–44 歲</th>
                <th style={th}>{view.y1} 65+ 占比</th>
              </tr>
            </thead>
            <tbody>
              {view.districts.map(r => (
                <tr key={r.area} style={{ borderBottom: '1px solid var(--border-card)', background: r.area === highlightDistrict ? 'var(--accent-wash)' : undefined }}>
                  <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>{r.area}</td>
                  <td style={td}>{r.base?.toLocaleString() ?? '—'}</td>
                  <td style={td}>{r.future?.toLocaleString() ?? '—'}</td>
                  <td style={td}>{chgCell(r.totalChg)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{chgCell(r.buyerChg)}</td>
                  <td style={td}>{r.old != null ? `${r.old.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        依 25–44 歲人口變化排序。⚠️ 官方推估只計出生、死亡，<b>未計入遷徙</b>：善化、新市、安平等淨移入多的區實際會比推估好，
        人口外移的偏鄉則會更差；適合看「現有人口自然老化」的趨勢，不是完整預測。
        資料：臺南市政府「臺南市人口推估」（參考國發會中華民國人口推估）。
      </div>
    </div>
  )
}

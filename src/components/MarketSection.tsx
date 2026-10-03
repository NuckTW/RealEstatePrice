'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'

const TwoLineChart = dynamic(() => import('./MarketCharts').then(m => m.TwoLineChart), {
  ssr: false,
  loading: () => <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>圖表載入中…</div>,
})

/* ── 型別（對應 /api/potential-buyers 的 market／lowUsage／transfers） ── */
export interface MarketPoint { indicator: string; area: string; period: string; value: number }
export interface LowUsageRow { indicator: string; level: string; area: string; period: string; isLatest: boolean; value: number }
export interface TransfersData {
  latestMonth: string | null
  rows: { district: string; first12m: number | null; firstPrev12m: number | null; sale12m: number | null; salePrev12m: number | null }[]
  city: { period: string; first: number | null; sale: number | null }[]
}

/** 季資料圖表起點：101 年起（較早的資料口徑與市場結構差異大，圖太擠） */
const SERIES_FROM = '101Q1'

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 'var(--radius-lg)', padding: 16,
}
const fmt = (v: number | null | undefined, d = 0) =>
  v == null ? '—' : v.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d })
const pctChange = (a: number | null, b: number | null) => (a != null && b) ? (a / b - 1) * 100 : null
/** '115Q1' → '115Q1'；'11508' → '115/08' */
const label = (p: string) => /Q|H/.test(p) ? p : `${p.slice(0, -2)}/${p.slice(-2)}`

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>{title}</span>
      {sub && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>{sub}</span>}
    </div>
  )
}

/** 最新值 + 與前一年同期比較 */
function Kpi({ title, value, unit, diff, diffUnit, goodWhenDown, diffNote = '較去年同期' }: {
  title: string; value: number | null; unit: string; diff: number | null; diffUnit: string; goodWhenDown?: boolean; diffNote?: string
}) {
  const tone = diff == null ? 'var(--text-faint)' : (diff < 0) === !!goodWhenDown ? 'var(--positive)' : 'var(--negative)'
  return (
    <div>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{title}</div>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>
        {fmt(value, 2)}<span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>
      </div>
      {diff != null && (
        <div style={{ fontSize: 'var(--text-2xs)', color: tone }}>
          {diff >= 0 ? '▲' : '▼'} {fmt(Math.abs(diff), 2)}{diffUnit}（{diffNote}）
        </div>
      )}
    </div>
  )
}

/* ── 負擔能力：房價所得比、貸款負擔率、新增房貸利率（臺南市 vs 全國） ── */
export function AffordabilitySection({ market }: { market: MarketPoint[] }) {
  const charts = useMemo(() => {
    const build = (ind: string) => {
      const pts = market.filter(m => m.indicator === ind && m.period >= SERIES_FROM)
      const periods = [...new Set(pts.map(p => p.period))].sort()
      const get = (area: string, p: string) => pts.find(x => x.area === area && x.period === p)?.value ?? null
      const rows = periods.map(p => ({ label: p, a: get('臺南市', p), b: get('全國', p) }))
      const last = rows.at(-1)
      const yearAgo = rows.at(-5)   // 季資料：往前 4 季
      return { rows, latest: last?.a ?? null, period: last?.label ?? null, diff: last?.a != null && yearAgo?.a != null ? last.a - yearAgo.a : null }
    }
    // 家庭收支（年）：可支配所得以「萬元」呈現，101 年起
    const buildYearly = (ind: string) => {
      const pts = market.filter(m => m.indicator === ind && /^\d+$/.test(m.period) && Number(m.period) >= 101)
      const periods = [...new Set(pts.map(p => p.period))].sort((x, y) => Number(x) - Number(y))
      const get = (area: string, p: string) => {
        const v = pts.find(x => x.area === area && x.period === p)?.value
        return v == null ? null : v / 10000
      }
      const rows = periods.map(p => ({ label: `${p}年`, a: get('臺南市', p), b: get('全國', p) }))
      const last = rows.at(-1), prev = rows.at(-2)
      return { rows, latest: last?.a ?? null, period: last?.label ?? null, diff: last?.a != null && prev?.a != null ? last.a - prev.a : null }
    }
    return {
      pir: build('price_income_ratio'),
      burden: build('mortgage_burden_pct'),
      rate: build('new_mortgage_rate'),
      income: buildYearly('fies_disposable_income'),
    }
  }, [market])

  const latestOf = (ind: string) => market.filter(m => m.indicator === ind && m.area === '臺南市').at(-1) ?? null
  const ltv = latestOf('new_mortgage_ltv'), term = latestOf('new_mortgage_term')
  const bank5 = market.filter(m => m.indicator === 'bank5_mortgage_rate').at(-1) ?? null

  if (!charts.pir.rows.length) return null
  const block = (title: string, c: typeof charts.pir, unit: string, kpiUnit: string, diffUnit: string, goodWhenDown = true, diffNote = '較去年同期') => (
    <div style={{ minWidth: 0 }}>
      <Kpi title={`${title}（臺南市 ${c.period}）`} value={c.latest} unit={kpiUnit} diff={c.diff} diffUnit={diffUnit} goodWhenDown={goodWhenDown} diffNote={diffNote} />
      <TwoLineChart rows={c.rows} nameA="臺南市" nameB="全國" unit={unit} />
    </div>
  )
  // 儲蓄率 = 1 − 消費支出 ÷ 可支配所得（臺南市最新年度）
  const lastIncome = latestOf('fies_disposable_income'), lastConsume = latestOf('fies_consumption')
  const savingRate = lastIncome && lastConsume && lastIncome.period === lastConsume.period
    ? (1 - lastConsume.value / lastIncome.value) * 100 : null
  return (
    <div style={cardStyle}>
      <SectionTitle title="負擔能力與房貸條件" sub="臺南市 vs 全國；所得比、負擔率、利率越低越容易負擔；縣市級資料，不計入村里指數" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {block('房價所得比', charts.pir, ' 倍', '倍', ' 倍')}
        {block('貸款負擔率', charts.burden, '%', '%', ' 個百分點')}
        {block('新增購屋貸款平均利率', charts.rate, '%', '%', ' 個百分點')}
        {charts.income.rows.length > 0 && block('平均每戶可支配所得', charts.income, ' 萬元', '萬元', ' 萬元', false, '較前一年')}
      </div>
      <div style={{ marginTop: 10, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        臺南市新增購屋貸款（{ltv?.period ?? '—'}）：平均成數 {fmt(ltv?.value ?? null)}%、平均期數 {fmt(term?.value ?? null)} 個月（約 {term ? fmt(term.value / 12) : '—'} 年）；
        五大銀行平均房貸利率 {fmt(bank5?.value ?? null, 2)}%（{bank5 ? label(bank5.period) : '—'}）。
        {savingRate != null && <>臺南市 {lastIncome!.period} 年家庭儲蓄率約 {savingRate.toFixed(1)}%（1 − 消費支出 ÷ 可支配所得）。</>}
        房價所得比 = 住宅價格中位數 ÷ 家戶年可支配所得中位數；貸款負擔率 = 中位數房價的房貸月付 ÷ 家戶月可支配所得中位數（內政部定義：貸款 7 成、20 年）。
        資料：內政部不動產資訊平台；家庭收支為主計總處家庭收支調查（年資料）。
      </div>
    </div>
  )
}

/* ── 建物移轉：新屋交屋（第一次移轉）與買賣移轉（行政區・月） ── */
export function TransfersSection({ data, highlightDistrict }: { data: TransfersData; highlightDistrict?: string }) {
  const { series, rows, total } = useMemo(() => {
    const series = data.city.slice(-60).map(r => ({ label: label(r.period), a: r.first, b: r.sale }))
    const rows = data.rows
      .map(r => ({ ...r, firstYoy: pctChange(r.first12m, r.firstPrev12m), saleYoy: pctChange(r.sale12m, r.salePrev12m) }))
      .sort((a, b) => (b.first12m ?? 0) - (a.first12m ?? 0))
    const sum = (k: 'first12m' | 'firstPrev12m' | 'sale12m' | 'salePrev12m') => data.rows.reduce((s, r) => s + (r[k] ?? 0), 0)
    return { series, rows, total: { first: sum('first12m'), firstPrev: sum('firstPrev12m'), sale: sum('sale12m'), salePrev: sum('salePrev12m') } }
  }, [data])
  if (!data.rows.length) return null

  const yoyCell = (v: number | null) => (
    <span style={{ color: v == null ? 'var(--text-faint)' : v >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
      {v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
    </span>
  )
  const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-card)' }
  const td: React.CSSProperties = { padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }
  const latest = data.latestMonth ? `${Number(data.latestMonth.slice(0, 4)) - 1911}/${data.latestMonth.slice(5)}` : '—'

  return (
    <div style={cardStyle}>
      <SectionTitle title="建物移轉（新屋交屋 × 買賣）" sub={`行政區月資料，最新 ${latest}；新屋交屋多 = 新入住家庭多，不計入村里指數`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 2 }}>全市每月件數（近 5 年）</div>
          <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
            近 12 個月：新屋交屋 {fmt(total.first)}（{yoyCell(pctChange(total.first, total.firstPrev))}）、買賣移轉 {fmt(total.sale)}（{yoyCell(pctChange(total.sale, total.salePrev))}）
          </div>
          <TwoLineChart rows={series} nameA="新屋交屋（建物第一次移轉）" nameB="買賣移轉（建物）" unit=" 件" height={240} digits={0} />
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 320 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-card)' }}>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>行政區</th>
                <th style={th}>新屋交屋（12 月）</th><th style={th}>年增</th>
                <th style={th}>買賣移轉（12 月）</th><th style={th}>年增</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.district} style={{ borderBottom: '1px solid var(--border-card)', background: r.district === highlightDistrict ? 'var(--accent-wash)' : undefined }}>
                  <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>{r.district}</td>
                  <td style={{ ...td, color: 'var(--text-strong)', fontWeight: 600 }}>{fmt(r.first12m)}</td>
                  <td style={td}>{yoyCell(r.firstYoy)}</td>
                  <td style={td}>{fmt(r.sale12m)}</td>
                  <td style={td}>{yoyCell(r.saleYoy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        新屋交屋 = 建物第一次移轉登記筆數（六層以下 + 七層以上），反映新成屋、預售屋交屋入住；買賣移轉 = 不動產買賣登記的建物件數。
        資料：臺南市政府資料開放平台（地政局），各區加總為全市。
      </div>
    </div>
  )
}

/* ── 低度使用（用電）住宅：行政區最新一期 vs 前一年同期 ── */
export function LowUsageSection({ rows, highlightDistrict }: { rows: LowUsageRow[]; highlightDistrict?: string }) {
  const { view, city, period, prevPeriod } = useMemo(() => {
    const get = (area: string, ind: string, latest: boolean) =>
      rows.find(r => r.area === area && r.indicator === ind && r.isLatest === latest)?.value ?? null
    const areas = [...new Set(rows.filter(r => r.level === 'district').map(r => r.area))]
    const view = areas.map(a => ({
      district: a, rate: get(a, 'low_usage_rate', true), units: get(a, 'low_usage_units', true),
      prevRate: get(a, 'low_usage_rate', false),
    })).filter(r => r.rate != null).sort((a, b) => b.rate! - a.rate!)
    const city = { rate: get('臺南市', 'low_usage_rate', true), units: get('臺南市', 'low_usage_units', true), prevRate: get('臺南市', 'low_usage_rate', false) }
    return {
      view, city,
      period: rows.find(r => r.isLatest)?.period ?? null,
      prevPeriod: rows.find(r => !r.isLatest)?.period ?? null,
    }
  }, [rows])
  if (!view.length) return null
  const maxRate = Math.max(...view.map(r => r.rate!))

  return (
    <div style={cardStyle}>
      <SectionTitle title="低度使用（用電）住宅" sub={`俗稱空屋率；${period ?? ''} 行政區，比較 ${prevPeriod ?? '前一年同期'}；不計入村里指數`} />
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)', marginBottom: 10 }}>
        全市 {fmt(city.units)} 宅，比率 <b style={{ color: 'var(--text-strong)' }}>{fmt(city.rate, 2)}%</b>
        {city.prevRate != null && city.rate != null && (
          <span style={{ color: 'var(--text-muted)' }}>（{city.rate - city.prevRate >= 0 ? '+' : ''}{(city.rate - city.prevRate).toFixed(2)} 個百分點）</span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', columnGap: 24 }}>
        {view.map(r => {
          const d = r.prevRate != null ? r.rate! - r.prevRate : null
          return (
            <div key={r.district} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 46px 52px', gap: 6, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border-card)', fontSize: 'var(--text-xs)', background: r.district === highlightDistrict ? 'var(--accent-wash)' : undefined }}>
              <span style={{ color: 'var(--text-default)' }}>{r.district}</span>
              <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)' }}>
                <div title={`${fmt(r.units)} 宅`} style={{ width: `${r.rate! / maxRate * 100}%`, height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--secondary)' }} />
              </div>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{fmt(r.rate, 1)}%</span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: d == null ? 'var(--text-faint)' : d <= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                {d == null ? '—' : `${d >= 0 ? '+' : ''}${d.toFixed(1)}`}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        低度使用（用電）住宅：房屋稅籍住宅中用電量低於門檻者（內政部第二版統計方法，定義見不動產資訊平台）。偏鄉比率高多為人口外移；市區比率高可能是投資持有或待售。
        右欄為較前一年同期增減（個百分點）。資料：內政部不動產資訊平台。
      </div>
    </div>
  )
}

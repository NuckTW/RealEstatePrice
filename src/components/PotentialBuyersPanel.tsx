'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { VillageGeo } from './VillageChoroplethMap'
import HouseAgeChart, { type HouseAgeRow } from './HouseAgeChart'
import {
  AffordabilitySection, TransfersSection, LowUsageSection,
  type MarketPoint, type LowUsageRow, type TransfersData,
} from './MarketSection'
import SouthParkSection, { type SouthParkRow } from './SouthParkSection'
import RentMortgageTable, { DEFAULT_ASSUMPTION, rentRatio, type MortgageAssumption, type RentRow } from './RentMortgageTable'

const VillageChoroplethMap = dynamic(() => import('./VillageChoroplethMap'), {
  ssr: false, loading: () => <div style={centerStyle('100%')}>地圖載入中…</div>,
})

/* ── 型別（對應 /api/potential-buyers） ───────────────────────── */
interface Village {
  code: string
  district: string
  village: string
  firstBuyer: number
  upgrader: number
  p: Record<'cohortYoung' | 'cohortMid' | 'share2534' | 'share3544' | 'marriage' | 'birth' | 'income' | 'social', number>
  raw: {
    pop: number; households: number
    share2534: number | null; share3544: number | null
    cohortYoung: number | null; cohortMid: number | null
    marriage: number | null; birth: number | null
    social: number | null; income: number | null
    hhSize: number | null; splitSpeed: number | null
    netOtherCity: number | null; netOtherTown: number | null; netSameTown: number | null
    women1549: number | null; women1549Share: number | null
    divorces: number | null; divorceKDistrict: number | null
    eduUnivPlus: number | null; eduGrad: number | null; singleHh: number | null
    headAvgAge: number | null; head2645: number | null; head2645Chg: number | null; head65p: number | null
    multiHh: number | null; multiHhChg: number | null; soloDwelling: number | null; dwellingsGrowth: number | null
  }
  lowConfidence: boolean
  cohortMissing: boolean
  incomeFromParent: boolean
}
interface ApiData {
  meta: {
    dataMonth: string | null; incomeTaxYear: number | null
    eduYear: number | null; hhYear: number | null; hhqPeriod: string | null
  }
  villages: Village[]
  rent: { rentPeriod: string | null; salePeriod: string | null; rows: RentRow[] }
  southPark: SouthParkRow[]
  houseAge: { period: string | null; cityAvgAge: number | null; rows: HouseAgeRow[] }
  market: MarketPoint[]
  lowUsage: LowUsageRow[]
  transfers: TransfersData
}

type Mode = 'firstBuyer' | 'upgrader'
type PKey = keyof Village['p']
type RawKey = keyof Village['raw']

/** 指數組成：權重與 supabase/migrations/20261003_village_buyer_indicators.sql 一致 */
const COMPONENTS: Record<Mode, { key: PKey; raw: RawKey; label: string; weight: number; unit: string; hint: string }[]> = {
  firstBuyer: [
    { key: 'cohortYoung', raw: 'cohortYoung', label: '世代淨移入（25–34 歲）', weight: 30, unit: '‰', hint: '同一批人一年後的人數變化，≈ 年輕人淨搬入' },
    { key: 'share2534',   raw: 'share2534',   label: '25–34 歲人口占比',      weight: 20, unit: '%', hint: '首購主力年齡層' },
    { key: 'marriage',    raw: 'marriage',    label: '結婚率',                 weight: 20, unit: '‰', hint: '每千人・年，已往行政區平均收縮' },
    { key: 'income',      raw: 'income',      label: '所得中位數（購買力）',   weight: 20, unit: '千元', hint: '綜所稅申報，代表購買力；只做相對排名' },
    { key: 'social',      raw: 'social',      label: '社會增加率',             weight: 10, unit: '‰', hint: '淨遷入（含同區跨里）' },
  ],
  upgrader: [
    { key: 'cohortMid',   raw: 'cohortMid',   label: '世代淨移入（35–44 歲）', weight: 20, unit: '‰', hint: '同一批人一年後的人數變化' },
    { key: 'share3544',   raw: 'share3544',   label: '35–44 歲人口占比',      weight: 20, unit: '%', hint: '換屋主力年齡層' },
    { key: 'birth',       raw: 'birth',       label: '出生率',                 weight: 20, unit: '‰', hint: '每千人・年，已往行政區平均收縮' },
    { key: 'income',      raw: 'income',      label: '所得中位數（購買力）',   weight: 30, unit: '千元', hint: '綜所稅申報，代表購買力；只做相對排名' },
    { key: 'social',      raw: 'social',      label: '社會增加率',             weight: 10, unit: '‰', hint: '淨遷入（含同區跨里）' },
  ],
}

const MODE_LABEL: Record<Mode, string> = { firstBuyer: '首購指數', upgrader: '換屋指數' }

/**
 * 單一色相（brass）五分位色階，以 CSS 變數 --pb-ramp-0..4 定義（0 = 最低）
 * 亮色主題：淺 → 深；暗色主題翻轉為 深 → 亮，高分在深底圖上才會突出
 */
const RAMP = [0, 1, 2, 3, 4].map(i => `var(--pb-ramp-${i})`)
const RAMP_CSS = `
  :root { --pb-ramp-0: #6a4312; --pb-ramp-1: #8f5a16; --pb-ramp-2: #b9761d; --pb-ramp-3: #e8ad3f; --pb-ramp-4: #f7dca2; }
  :root[data-theme="light"] { --pb-ramp-0: #f7dca2; --pb-ramp-1: #f0c86e; --pb-ramp-2: #d9912a; --pb-ramp-3: #a8661a; --pb-ramp-4: #6a4312; }
`
const RAMP_LABEL = ['後 20%', '20–40%', '40–60%', '60–80%', '前 20%']

/* ── 小工具 ───────────────────────────────────────────────────── */
function centerStyle(h: number | string): React.CSSProperties {
  return { height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }
}
const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 'var(--radius-lg)', padding: 16,
}
function fmt(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
function signed(v: number | null, digits = 1): string {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + fmt(v, digits)
}
/** '2026-08' → '115 年 8 月' */
function rocMonth(iso: string | null): string {
  if (!iso) return '—'
  const [y, m] = iso.split('-')
  return `${Number(y) - 1911} 年 ${Number(m)} 月`
}
/** 五分位切點（20/40/60/80%） */
function quintileBreaks(values: number[]): number[] {
  const s = [...values].sort((a, b) => a - b)
  return [0.2, 0.4, 0.6, 0.8].map(q => s[Math.floor(q * (s.length - 1))])
}
function classOf(v: number, breaks: number[]): number {
  let i = 0
  while (i < breaks.length && v > breaks[i]) i++
  return i
}

/* ── 主元件 ───────────────────────────────────────────────────── */
export default function PotentialBuyersPanel() {
  const [data, setData]       = useState<ApiData | null>(null)
  const [geo, setGeo]         = useState<VillageGeo | null>(null)
  const [error, setError]     = useState(false)
  const [mode, setMode]       = useState<Mode>('firstBuyer')
  const [district, setDistrict] = useState<string>('')        // '' = 全市
  const [hideLow, setHideLow] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [focusCodes, setFocusCodes] = useState<string[] | null>(null)
  const [assumption, setAssumption] = useState<MortgageAssumption>(DEFAULT_ASSUMPTION)

  useEffect(() => {
    Promise.all([
      fetch('/api/potential-buyers').then(r => r.json()),
      fetch('/geo/tainan_villages.json').then(r => r.json()),
    ])
      .then(([d, g]) => {
        if (d.error) { setError(true); return }
        setData(d); setGeo(g)
        // 租金／房貸比的預設利率改用臺南市最新一季「新增購置住宅貸款平均利率」
        const rate = (d as ApiData).market?.filter(m => m.indicator === 'new_mortgage_rate' && m.area === '臺南市').at(-1)
        if (rate) setAssumption(a => ({ ...a, ratePct: rate.value }))
      })
      .catch(() => setError(true))
  }, [])

  const villages = useMemo(() => data?.villages ?? [], [data])
  const byCode = useMemo(() => new Map(villages.map(v => [v.code, v])), [villages])

  const districts = useMemo(() => {
    // 依行政區平均指數排序，前面的區潛在客群較強
    const agg = new Map<string, { sum: number; n: number }>()
    for (const v of villages) {
      const a = agg.get(v.district) ?? { sum: 0, n: 0 }
      a.sum += v[mode]; a.n += 1
      agg.set(v.district, a)
    }
    return [...agg.entries()]
      .map(([name, a]) => ({ name, avg: a.sum / a.n, n: a.n }))
      .sort((a, b) => b.avg - a.avg)
  }, [villages, mode])

  // 全市排名（不受篩選影響）
  const cityRank = useMemo(() => {
    const sorted = [...villages].sort((a, b) => b[mode] - a[mode])
    return new Map(sorted.map((v, i) => [v.code, i + 1]))
  }, [villages, mode])

  const breaks = useMemo(() => quintileBreaks(villages.map(v => v[mode])), [villages, mode])

  const classByCode = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of villages) {
      if (district && v.district !== district) continue
      m.set(v.code, classOf(v[mode], breaks))
    }
    return m
  }, [villages, mode, breaks, district])

  const lowConfidence = useMemo(() => new Set(villages.filter(v => v.lowConfidence).map(v => v.code)), [villages])

  const tooltipByCode = useMemo(() => new Map(villages.map(v => [
    v.code,
    `${v.district} ${v.village}｜${MODE_LABEL[mode]} ${fmt(v[mode])}（全市第 ${cityRank.get(v.code)} 名）${v.lowConfidence ? '｜人口少，僅供參考' : ''}`,
  ])), [villages, mode, cityRank])

  const ranking = useMemo(() => villages
    .filter(v => (!district || v.district === district) && (!hideLow || !v.lowConfidence))
    .sort((a, b) => b[mode] - a[mode]), [villages, mode, district, hideLow])

  if (error) return <div style={centerStyle(300)}>資料載入失敗，請稍後再試</div>
  if (!data || !geo) return <div style={centerStyle(300)}>載入中…</div>

  const sel = selected ? byCode.get(selected) ?? null : null

  const changeDistrict = (d: string) => {
    setDistrict(d)
    setFocusCodes(d ? villages.filter(v => v.district === d).map(v => v.code) : villages.map(v => v.code))
  }
  const pickFromTable = (code: string) => {
    setSelected(code)
    setFocusCodes([code])
  }

  return (
    <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-sans)' }}>

      {/* 篩選列 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <div role="tablist" style={{ display: 'inline-flex', padding: 3, gap: 3, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)', border: '1px solid var(--border-control)' }}>
          {(['firstBuyer', 'upgrader'] as Mode[]).map(m => (
            <button
              key={m} role="tab" aria-selected={mode === m}
              onClick={() => setMode(m)}
              style={{
                height: 'var(--control-h-sm)', padding: '0 14px', borderRadius: 'var(--radius-full)',
                border: 'none', cursor: 'pointer',
                fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? 'var(--on-accent)' : 'var(--text-muted)',
                transition: 'var(--transition-base)',
              }}
            >{MODE_LABEL[m]}</button>
          ))}
        </div>

        <select
          value={district}
          onChange={e => changeDistrict(e.target.value)}
          aria-label="行政區"
          style={{
            height: 'var(--control-h-md)', padding: '0 10px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-control)', color: 'var(--text-default)',
            border: '1px solid var(--border-control)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
          }}
        >
          <option value="">全市（{villages.length} 里）</option>
          {districts.map(d => (
            <option key={d.name} value={d.name}>{d.name}（平均 {fmt(d.avg)}）</option>
          ))}
        </select>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={hideLow} onChange={e => setHideLow(e.target.checked)} />
          排行榜隱藏人口未滿 1,000 的里
        </label>

        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
          人口 {rocMonth(data.meta.dataMonth)}・所得 {data.meta.incomeTaxYear} 年度
        </span>
      </div>

      {/* 地圖 + 明細 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        <div style={{ ...cardStyle, padding: 8, gridColumn: 'span 2', minWidth: 0 }} className="pb-map-card">
          <div className="pb-map-box" style={{ position: 'relative' }}>
            <VillageChoroplethMap
              geojson={geo}
              classByCode={classByCode}
              lowConfidence={lowConfidence}
              tooltipByCode={tooltipByCode}
              selected={selected}
              onSelect={setSelected}
              focusCodes={focusCodes}
            />
            <Legend breaks={breaks} mode={mode} />
          </div>
        </div>

        <div style={{ ...cardStyle, minWidth: 0 }}>
          {sel
            ? <VillageDetail
                v={sel} mode={mode} rank={cityRank.get(sel.code) ?? 0} total={villages.length} meta={data.meta}
                rentRow={data.rent.rows.find(r => r.district === sel.district && r.btype === '大樓華廈') ?? null}
                assumption={assumption}
                onClose={() => setSelected(null)}
              />
            : <TopList rows={ranking.slice(0, 10)} mode={mode} district={district} onPick={pickFromTable} />}
        </div>
      </div>

      {/* 排行榜 */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>
            {district || '全市'}・{MODE_LABEL[mode]}排行
          </span>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
            前 30 名，點選列可在地圖上定位；率皆為每千人・年
          </span>
        </div>
        <RankingTable rows={ranking.slice(0, 30)} mode={mode} cityRank={cityRank} selected={selected} onPick={pickFromTable} />
      </div>

      {/* 租轉買：行政區租金 vs 房貸月付 */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>租金／房貸月付比（行政區）</span>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
            「租轉買」潛在客：月租越接近房貸月付，越容易從租屋轉為購屋；租賃資料只到行政區，不計入村里指數
          </span>
        </div>
        <RentMortgageTable
          rows={data.rent.rows}
          rentPeriod={data.rent.rentPeriod}
          salePeriod={data.rent.salePeriod}
          assumption={assumption}
          onAssumptionChange={setAssumption}
          rateNote={(() => {
            const r = data.market.filter(m => m.indicator === 'new_mortgage_rate' && m.area === '臺南市').at(-1)
            return r ? `預設利率為臺南市 ${r.period} 新增購屋貸款平均利率` : undefined
          })()}
          highlightDistrict={district || undefined}
        />
      </div>

      {/* 老屋換屋：行政區成交屋齡結構 */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>屋齡結構（行政區）</span>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
            房屋稅籍住宅存量；老屋占比高的區，換屋需求潛力越大；不計入村里指數
          </span>
        </div>
        <HouseAgeChart rows={data.houseAge.rows} period={data.houseAge.period} cityAvgAge={data.houseAge.cityAvgAge} highlightDistrict={district || undefined} />
      </div>

      {/* 市場環境：負擔能力、建物移轉、低度使用（縣市／行政區級，不計入村里指數） */}
      <AffordabilitySection market={data.market} />
      <TransfersSection data={data.transfers} highlightDistrict={district || undefined} />
      <LowUsageSection rows={data.lowUsage} highlightDistrict={district || undefined} />

      {/* 就業動能：南科（台南最大外來購屋族群來源） */}
      {data.southPark.length > 0 && (
        <div style={cardStyle}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>南科就業動能</span>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
              南科是台南最大的外來購屋族群來源；園區級資料，不計入村里指數
            </span>
          </div>
          <SouthParkSection rows={data.southPark} />
        </div>
      )}

      <Methodology />

      <style>{`
        ${RAMP_CSS}
        .pb-map-box { height: 620px; }
        @media (max-width: 760px) { .pb-map-card { grid-column: auto !important; } .pb-map-box { height: 460px; } }
      `}</style>
    </div>
  )
}

/* ── 圖例 ─────────────────────────────────────────────────────── */
function Legend({ breaks, mode }: { breaks: number[]; mode: Mode }) {
  const ranges = RAMP.map((_, i) => {
    const lo = i === 0 ? null : breaks[i - 1]
    const hi = i === RAMP.length - 1 ? null : breaks[i]
    return lo == null ? `≤ ${fmt(hi)}` : hi == null ? `> ${fmt(lo)}` : `${fmt(lo)}–${fmt(hi)}`
  })
  return (
    <div style={{
      position: 'absolute', left: 10, bottom: 24, zIndex: 1000,
      background: 'var(--surface-overlay)', border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-md)', padding: '8px 10px', boxShadow: 'var(--shadow-pop)',
      fontSize: 'var(--text-2xs)', color: 'var(--text-default)',
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>{MODE_LABEL[mode]}（全市五分位）</div>
      {[...RAMP].reverse().map((c, ri) => {
        const i = RAMP.length - 1 - ri
        return (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.7 }}>
            <span style={{ width: 14, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />
            <span style={{ minWidth: 48 }}>{RAMP_LABEL[i]}</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ranges[i]}</span>
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: 'var(--text-muted)' }}>
        <span style={{ width: 14, height: 10, borderRadius: 2, border: '1px dashed var(--text-muted)', display: 'inline-block' }} />
        人口未滿 1,000（淡色，僅供參考）
      </div>
    </div>
  )
}

/* ── 前 10 名（未選取村里時） ──────────────────────────────────── */
function TopList({ rows, mode, district, onPick }: { rows: Village[]; mode: Mode; district: string; onPick: (c: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 2 }}>
        {district || '全市'}前 10 名
      </div>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginBottom: 10 }}>點地圖上的村里看指標拆解</div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((v, i) => (
          <li key={v.code}>
            <button
              onClick={() => onPick(v.code)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px',
                background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-card)',
                cursor: 'pointer', textAlign: 'left', color: 'var(--text-default)', fontFamily: 'var(--font-sans)',
              }}
            >
              <span style={{ width: 20, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{v.district}</span> {v.village}
                {v.lowConfidence && <span title="人口未滿 1,000，指標雜訊較大" style={{ marginLeft: 6, fontSize: 'var(--text-3xs)', color: 'var(--warning)' }}>⚠ 小里</span>}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 600 }}>{fmt(v[mode])}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ── 村里明細 ─────────────────────────────────────────────────── */
function VillageDetail({ v, mode, rank, total, meta, rentRow, assumption, onClose }: {
  v: Village; mode: Mode; rank: number; total: number; meta: ApiData['meta']
  rentRow: RentRow | null; assumption: MortgageAssumption; onClose: () => void
}) {
  const comps = COMPONENTS[mode]
  const ratio = rentRow ? rentRatio(rentRow, assumption) : null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{v.district}</div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.2 }}>{v.village}</div>
        </div>
        <button onClick={onClose} aria-label="關閉明細" style={{
          background: 'transparent', border: '1px solid var(--border-control)', borderRadius: 'var(--radius-full)',
          color: 'var(--text-muted)', cursor: 'pointer', width: 26, height: 26, fontSize: 'var(--text-xs)',
        }}>✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '10px 0 4px' }}>
        <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--accent-tint)', fontFamily: 'var(--font-mono)' }}>{fmt(v[mode])}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{MODE_LABEL[mode]}・全市第 {rank} / {total} 名</span>
      </div>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', marginBottom: 12 }}>
        人口 {v.raw.pop.toLocaleString()}・{v.raw.households.toLocaleString()} 戶
      </div>

      {(v.lowConfidence || v.cohortMissing || v.incomeFromParent) && (
        <div style={{
          fontSize: 'var(--text-2xs)', color: 'var(--text-default)', background: 'rgba(232,162,59,0.10)',
          border: '1px solid rgba(232,162,59,0.30)', borderRadius: 'var(--radius-md)', padding: '6px 8px', marginBottom: 12,
        }}>
          {v.lowConfidence && <div>⚠ 人口未滿 1,000，各項比率雜訊較大，僅供參考</div>}
          {v.cohortMissing && <div>⚠ 近 12 個月內新設的里，世代淨移入以中性值 50 計</div>}
          {v.incomeFromParent && <div>ⓘ 所得沿用分割前的母里（東西庄里）</div>}
        </div>
      )}

      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 6 }}>指標拆解（全市百分位）</div>
      {comps.map(c => {
        const p = v.p[c.key]
        const raw = v.raw[c.raw]
        const rawText = c.unit === '千元' ? `${fmt(raw, 0)} 千元` : c.unit === '%' ? `${fmt(raw, 1)}%` : `${signed(raw, 1)}‰`
        return (
          <div key={c.key} title={c.hint} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', marginBottom: 3 }}>
              <span style={{ color: 'var(--text-default)' }}>{c.label} <span style={{ color: 'var(--text-faint)' }}>× {c.weight}%</span></span>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{rawText}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)', overflow: 'hidden' }}>
                <div style={{ width: `${p}%`, height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--accent)' }} />
              </div>
              <span style={{ width: 30, textAlign: 'right', fontSize: 'var(--text-2xs)', color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{Math.round(p)}</span>
            </div>
          </div>
        )
      })}

      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', margin: '14px 0 6px' }}>其他觀察（不計分）</div>
      <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, columnGap: 12, margin: 0, fontSize: 'var(--text-2xs)' }}>
        <dt style={{ color: 'var(--text-muted)' }}>戶量（人／戶）</dt><dd style={ddStyle}>{fmt(v.raw.hhSize, 2)}</dd>
        <dt style={{ color: 'var(--text-muted)' }}>分戶速度（戶數 − 人口成長）</dt><dd style={ddStyle}>{signed(v.raw.splitSpeed, 2)}%</dd>
        <dt style={{ color: 'var(--text-muted)' }}>跨縣市淨移入</dt><dd style={ddStyle}>{signed(v.raw.netOtherCity)}‰</dd>
        <dt style={{ color: 'var(--text-muted)' }}>市內他區淨移入</dt><dd style={ddStyle}>{signed(v.raw.netOtherTown)}‰</dd>
        <dt style={{ color: 'var(--text-muted)' }}>同區跨里淨移入</dt><dd style={ddStyle}>{signed(v.raw.netSameTown)}‰</dd>
        <dt style={{ color: 'var(--text-muted)' }}>育齡婦女（15–49 歲）</dt>
        <dd style={ddStyle}>{v.raw.women1549?.toLocaleString() ?? '—'}（{fmt(v.raw.women1549Share)}%）</dd>
        <dt style={{ color: 'var(--text-muted)' }} title="村里間離婚率差異經檢定為隨機波動，故以行政區離婚率代表">近 12 月離婚對數／{v.district}離婚率</dt>
        <dd style={ddStyle}>{v.raw.divorces ?? '—'} 對／{fmt(v.raw.divorceKDistrict, 2)}‰</dd>
        <dt style={{ color: 'var(--text-muted)' }}>{v.district}大樓租金／房貸月付比</dt>
        <dd style={ddStyle}>{ratio != null ? fmt(ratio, 2) : '樣本不足'}</dd>
      </dl>

      {v.raw.headAvgAge != null && (
        <>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', margin: '14px 0 6px' }}>
            家戶結構（不計分）
            <span style={{ fontWeight: 400, color: 'var(--text-faint)', marginLeft: 6, fontSize: 'var(--text-2xs)' }}>
              {meta.hhqPeriod}・教育 {meta.eduYear} 年・戶數 {meta.hhYear} 年
            </span>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, columnGap: 12, margin: 0, fontSize: 'var(--text-2xs)' }}>
            <dt style={{ color: 'var(--text-muted)' }}>戶長平均年齡</dt><dd style={ddStyle}>{fmt(v.raw.headAvgAge)} 歲</dd>
            <dt style={{ color: 'var(--text-muted)' }}>26–45 歲戶長占比（較一年前）</dt>
            <dd style={ddStyle}>{fmt(v.raw.head2645)}%（{signed(v.raw.head2645Chg)}）</dd>
            <dt style={{ color: 'var(--text-muted)' }}>65 歲以上戶長占比</dt><dd style={ddStyle}>{fmt(v.raw.head65p)}%</dd>
            <dt style={{ color: 'var(--text-muted)' }} title="同一住宅設籍 2 戶以上。市區多為成年子女與父母同住（潛在分戶購屋需求）；偏鄉偏高多為三代同堂，與購屋需求呈負相關，需搭配年齡結構判讀">一宅多戶占比（較一年前）</dt>
            <dd style={ddStyle}>{fmt(v.raw.multiHh)}%（{signed(v.raw.multiHhChg)}）</dd>
            <dt style={{ color: 'var(--text-muted)' }}>1 人一宅占比</dt><dd style={ddStyle}>{fmt(v.raw.soloDwelling)}%</dd>
            <dt style={{ color: 'var(--text-muted)' }} title="設有戶籍的住宅數年增率，反映新住宅入住">設籍宅數年增</dt><dd style={ddStyle}>{signed(v.raw.dwellingsGrowth)}%</dd>
            <dt style={{ color: 'var(--text-muted)' }}>大學以上學歷占比（15 歲以上）</dt><dd style={ddStyle}>{fmt(v.raw.eduUnivPlus)}%</dd>
            <dt style={{ color: 'var(--text-muted)' }}>單獨生活戶占比</dt><dd style={ddStyle}>{fmt(v.raw.singleHh)}%</dd>
          </dl>
        </>
      )}
    </div>
  )
}
const ddStyle: React.CSSProperties = { margin: 0, textAlign: 'right', color: 'var(--text-default)', fontFamily: 'var(--font-mono)' }

/* ── 排行榜表格 ───────────────────────────────────────────────── */
function RankingTable({ rows, mode, cityRank, selected, onPick }: {
  rows: Village[]; mode: Mode; cityRank: Map<string, number>; selected: string | null; onPick: (c: string) => void
}) {
  const young = mode === 'firstBuyer'
  const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-card)' }
  const td: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>全市排名</th>
            <th style={{ ...th, textAlign: 'left' }}>村里</th>
            <th style={th}>{MODE_LABEL[mode]}</th>
            <th style={th}>人口</th>
            <th style={th}>世代淨移入 {young ? '25–34' : '35–44'}</th>
            <th style={th}>{young ? '25–34' : '35–44'} 占比</th>
            <th style={th}>{young ? '結婚率' : '出生率'}</th>
            <th style={th}>所得中位數（購買力，千元）</th>
            <th style={th}>社會增加率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(v => (
            <tr
              key={v.code}
              onClick={() => onPick(v.code)}
              style={{ cursor: 'pointer', background: v.code === selected ? 'var(--accent-wash)' : undefined, borderBottom: '1px solid var(--border-card)' }}
            >
              <td style={{ ...td, textAlign: 'left', color: 'var(--text-faint)' }}>{cityRank.get(v.code)}</td>
              <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{v.district}</span> {v.village}
                {v.lowConfidence && <span title="人口未滿 1,000" style={{ marginLeft: 6, color: 'var(--warning)', fontSize: 'var(--text-3xs)' }}>⚠</span>}
              </td>
              <td style={{ ...td, color: 'var(--text-strong)', fontWeight: 600 }}>{fmt(v[mode])}</td>
              <td style={td}>{v.raw.pop.toLocaleString()}</td>
              <td style={td}>{signed(young ? v.raw.cohortYoung : v.raw.cohortMid)}‰</td>
              <td style={td}>{fmt(young ? v.raw.share2534 : v.raw.share3544)}%</td>
              <td style={td}>{fmt(young ? v.raw.marriage : v.raw.birth, 2)}‰</td>
              <td style={td}>{fmt(v.raw.income, 0)}</td>
              <td style={td}>{signed(v.raw.social)}‰</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── 方法說明 ─────────────────────────────────────────────────── */
function Methodology() {
  const li: React.CSSProperties = { marginBottom: 4 }
  return (
    <details style={{ ...cardStyle, fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>指數怎麼算？</summary>
      <ul style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
        <li style={li}>每項指標先換算成全市 650 里的百分位（0–100），再依權重加總；指數 50 約為全市中間水準。</li>
        <li style={li}><b>首購指數</b> = 世代淨移入（25–34）30% + 25–34 歲占比 20% + 結婚率 20% + 所得（購買力）20% + 社會增加率 10%。</li>
        <li style={li}><b>換屋指數</b> = 世代淨移入（35–44）20% + 35–44 歲占比 20% + 出生率 20% + 所得（購買力）30% + 社會增加率 10%。</li>
        <li style={li}><b>世代淨移入</b>：比較同一批人一年前後的人數（例如去年 25–34 歲 vs 今年 26–35 歲），這個年齡層死亡很少，差額約等於淨搬入。</li>
        <li style={li}><b>社會增加率</b>含同區跨里遷移；新社區的住戶常來自同區隔壁里，不加回會被低估。</li>
        <li style={li}><b>結婚率、出生率</b>在小里波動很大，已往所屬行政區的平均收縮（人口越少收縮越多）。</li>
        <li style={li}><b>所得（購買力）</b>為財政部綜所稅申報資料，用來代表各里的購買力；不含免稅與分離課稅所得，且落後約 2–3 年，只做相對排名。</li>
        <li style={li}>時間窗為最近 12 個月；人口未滿 1,000 的里雜訊大，地圖以淡色虛線標示。</li>
      </ul>
    </details>
  )
}

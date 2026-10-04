'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { VillageGeo } from './VillageChoroplethMap'
import HouseAgeChart, { type HouseAgeRow } from './HouseAgeChart'
import {
  AffordabilitySection, TransfersSection, LowUsageSection,
  type MarketPoint, type LowUsageRow, type TransfersData,
} from './MarketSection'
import SouthParkSection, { type SouthParkRow, type IndustryRow } from './SouthParkSection'
import ProjectionSection, { type ProjectionData } from './ProjectionSection'
import SchoolSection, { type SchoolData } from './SchoolSection'
import IndustrySection, { type IndustryPoint } from './IndustrySection'
import SupplyPipelineSection, { type SupplyData } from './SupplyPipelineSection'
import MajorProjectsSection, { StatusBadge } from './MajorProjectsSection'
import DataCatalogSection from './DataCatalogSection'
import CustomIndexSection from './CustomIndexSection'
import { MAJOR_PROJECTS } from '@/lib/majorProjects'
import RentMortgageTable, { DEFAULT_ASSUMPTION, rentRatio, type MortgageAssumption, type RentRow } from './RentMortgageTable'
import {
  buildCatalog, computeIndex, partOf, fmtValue, PRESET_INDICES, POI_LABELS,
  type Village, type Meta, type IndexDef, type IndexResult, type Catalog, type CustomDataset,
} from '@/lib/buyerIndex'
import { usePassword, savePassword } from '@/lib/chatPassword'
import { Legend, RAMP_CSS, quintileBreaks, classOf } from './ChoroplethLegend'

const VillageChoroplethMap = dynamic(() => import('./VillageChoroplethMap'), {
  ssr: false, loading: () => <div style={centerStyle('100%')}>地圖載入中…</div>,
})

/* ── 型別（對應 /api/potential-buyers） ───────────────────────── */
export interface ApiData {
  meta: Meta
  villages: Village[]
  rent: { rentPeriod: string | null; salePeriod: string | null; rows: RentRow[] }
  southPark: SouthParkRow[]
  southParkIndustry: IndustryRow[]
  projection: ProjectionData
  schools: SchoolData
  industry: IndustryPoint[]
  supply: SupplyData
  houseAge: { period: string | null; cityAvgAge: number | null; rows: HouseAgeRow[] }
  market: MarketPoint[]
  lowUsage: LowUsageRow[]
  transfers: TransfersData
}

/** 手動資料與自訂指數（/api/potential-buyers/custom，需密碼） */
export interface CustomStore {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
  datasets: CustomDataset[]
  indices: IndexDef[]
}

/** 頁籤：村里指數為主，其餘為行政區／縣市層級的背景資料（皆不計入村里指數） */
type Tab = '村里指數' | '自訂指數' | '人口與家庭' | '就業與產業' | '房市與負擔' | '重大建設' | '資料總覽'
const TABS: { key: Tab; desc: string }[] = [
  { key: '村里指數',   desc: '村里首購／換新屋／換二手指數地圖與排行' },
  { key: '自訂指數',   desc: '手動加入資料、自訂指數權重、AI 建議配方' },
  { key: '人口與家庭', desc: '未來人口推估、學區新生' },
  { key: '就業與產業', desc: '各區就業結構、南科就業動能' },
  { key: '房市與負擔', desc: '負擔能力、租金與房貸、建物移轉、空屋、屋齡' },
  { key: '重大建設',   desc: '捷運、鐵路地下化、交流道、產業園區、重劃區' },
  { key: '資料總覽',   desc: '所有資料清單，點選即可在地圖或圖表上顯示' },
]
/** 從網址 hash 讀取頁籤（如 #房市與負擔），方便分享連結 */
function tabFromHash(): Tab {
  if (typeof window === 'undefined') return '村里指數'
  const h = decodeURIComponent(window.location.hash.replace(/^#/, ''))
  return TABS.some(t => t.key === h) ? (h as Tab) : '村里指數'
}

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
/* ── 主元件 ───────────────────────────────────────────────────── */
export default function PotentialBuyersPanel() {
  const [data, setData]       = useState<ApiData | null>(null)
  const [geo, setGeo]         = useState<VillageGeo | null>(null)
  const [error, setError]     = useState(false)
  const [indexId, setIndexId] = useState<string>('firstBuyer')
  const [district, setDistrict] = useState<string>('')        // '' = 全市
  const [hideLow, setHideLow] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [focusCodes, setFocusCodes] = useState<string[] | null>(null)
  const [assumption, setAssumption] = useState<MortgageAssumption>(DEFAULT_ASSUMPTION)
  // 伺服器端渲染時資料尚未載入（只顯示「載入中」），因此直接以 hash 初始化不會造成 hydration 不一致
  const [tab, setTab] = useState<Tab>(tabFromHash)
  // 瀏覽器上一頁／下一頁或手動改 hash 時同步頁籤
  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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

  // 手動資料與自訂指數：與 AI 問答共用密碼，有密碼才載入
  const password = usePassword()
  const [customState, setCustom] = useState<CustomStore>({ status: 'loading', datasets: [], indices: [] })
  const [reloadTick, setReloadTick] = useState(0)
  useEffect(() => {
    if (!password) return
    let cancelled = false
    fetch('/api/potential-buyers/custom', { headers: { 'x-chat-password': password } })
      .then(async r => {
        const j = await r.json()
        if (cancelled) return
        if (r.status === 401) { savePassword(''); return }     // 密碼錯誤 → 清掉重問
        if (!r.ok) { setCustom({ status: 'error', error: j.error ?? '讀取失敗', datasets: [], indices: [] }); return }
        setCustom({
          status: 'ready',
          datasets: j.datasets,
          indices: (j.indices as Omit<IndexDef, 'short' | 'preset'>[]).map(x => ({ ...x, short: x.name, preset: false })),
        })
      })
      .catch(() => { if (!cancelled) setCustom({ status: 'error', error: '讀取失敗', datasets: [], indices: [] }) })
    return () => { cancelled = true }
  }, [password, reloadTick])
  const reloadCustom = useCallback(() => setReloadTick(t => t + 1), [])
  // 沒密碼時一律視為空（不顯示上一位使用者的資料）
  const custom: CustomStore = useMemo(
    () => (password ? customState : { status: 'idle', datasets: [], indices: [] }),
    [password, customState],
  )

  const villages = useMemo(() => data?.villages ?? [], [data])
  const byCode = useMemo(() => new Map(villages.map(v => [v.code, v])), [villages])
  const codes = useMemo(() => villages.map(v => v.code), [villages])

  // 指標目錄（含手動資料）與百分位快取：目錄變了才重算
  const catalog = useMemo<Catalog | null>(() => (data ? buildCatalog(data, custom.datasets) : null), [data, custom.datasets])
  const rankCache = useMemo(() => new Map<string, Map<string, number>>(), [catalog])   // eslint-disable-line react-hooks/exhaustive-deps

  const allIndices = useMemo(() => [...PRESET_INDICES, ...custom.indices], [custom.indices])
  const def = allIndices.find(i => i.id === indexId) ?? PRESET_INDICES[0]
  const result = useMemo<IndexResult | null>(
    () => (catalog ? computeIndex(def, catalog, codes, rankCache) : null),
    [def, catalog, codes, rankCache],
  )
  const score = useCallback((code: string) => result?.scores.get(code) ?? 50, [result])

  const districts = useMemo(() => {
    // 依行政區平均指數排序，前面的區潛在客群較強
    const agg = new Map<string, { sum: number; n: number }>()
    for (const v of villages) {
      const a = agg.get(v.district) ?? { sum: 0, n: 0 }
      a.sum += score(v.code); a.n += 1
      agg.set(v.district, a)
    }
    return [...agg.entries()]
      .map(([name, a]) => ({ name, avg: a.sum / a.n, n: a.n }))
      .sort((a, b) => b.avg - a.avg)
  }, [villages, score])

  // 全市排名（不受篩選影響）
  const cityRank = useMemo(() => {
    const sorted = [...villages].sort((a, b) => score(b.code) - score(a.code))
    return new Map(sorted.map((v, i) => [v.code, i + 1]))
  }, [villages, score])

  const breaks = useMemo(() => quintileBreaks(villages.map(v => score(v.code))), [villages, score])

  const classByCode = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of villages) {
      if (district && v.district !== district) continue
      m.set(v.code, classOf(score(v.code), breaks))
    }
    return m
  }, [villages, score, breaks, district])

  // 各區人口（村里加總），產業區塊算「每千居民工作數」用
  const popByDistrict = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of villages) m.set(v.district, (m.get(v.district) ?? 0) + (v.raw.pop ?? 0))
    return m
  }, [villages])
  // 各區戶數（村里加總），住宅供給區塊算「每千戶開工」用
  const householdsByDistrict = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of villages) m.set(v.district, (m.get(v.district) ?? 0) + (v.raw.households ?? 0))
    return m
  }, [villages])

  const lowConfidence = useMemo(() => new Set(villages.filter(v => v.lowConfidence).map(v => v.code)), [villages])

  const tooltipByCode = useMemo(() => new Map(villages.map(v => [
    v.code,
    `${v.district} ${v.village}｜${def.name} ${fmt(score(v.code))}（全市第 ${cityRank.get(v.code)} 名）${v.lowConfidence ? '｜人口少，僅供參考' : ''}`,
  ])), [villages, def.name, score, cityRank])

  const ranking = useMemo(() => villages
    .filter(v => (!district || v.district === district) && (!hideLow || !v.lowConfidence))
    .sort((a, b) => score(b.code) - score(a.code)), [villages, score, district, hideLow])

  if (error) return <div style={centerStyle(300)}>資料載入失敗，請稍後再試</div>
  if (!data || !geo || !catalog || !result) return <div style={centerStyle(300)}>載入中…</div>

  const sel = selected ? byCode.get(selected) ?? null : null

  const changeDistrict = (d: string) => {
    setDistrict(d)
    setFocusCodes(d ? villages.filter(v => v.district === d).map(v => v.code) : villages.map(v => v.code))
  }
  const changeTab = (t: Tab) => {
    setTab(t)
    window.history.replaceState(null, '', t === '村里指數' ? window.location.pathname : `#${encodeURIComponent(t)}`)
  }
  const pickFromTable = (code: string) => {
    setSelected(code)
    setFocusCodes([code])
  }
  /** 自訂指數頁「在地圖上看」：切回村里指數頁並選這個指數 */
  const viewIndexOnMap = (id: string) => { setIndexId(id); changeTab('村里指數') }

  const hl = district || undefined
  const customIndices = allIndices.filter(i => !i.preset)

  return (
    <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-sans)' }}>

      {/* 頁籤 + 共用篩選列（捲動時固定在導覽列下方） */}
      <div className="pb-sticky" style={{
        position: 'sticky', top: 'var(--nav-h)', zIndex: 1100,
        background: 'var(--bg-app)', margin: '0 -20px', padding: '8px 20px 10px',
        borderBottom: '1px solid var(--border-card)',
      }}>
        <div role="tablist" aria-label="潛在客群分析頁籤" className="pb-tabs" style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 8 }}>
          {TABS.map(t => (
            <button
              key={t.key} role="tab" aria-selected={tab === t.key}
              onClick={() => changeTab(t.key)}
              title={t.desc}
              style={{
                height: 'var(--control-h-md)', padding: '0 14px', whiteSpace: 'nowrap', cursor: 'pointer',
                fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
                color: tab === t.key ? 'var(--text-strong)' : 'var(--text-muted)',
                transition: 'var(--transition-base)',
              }}
            >{t.key}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {tab === '村里指數' && (
            <div role="tablist" aria-label="指數類型" style={{ display: 'inline-flex', padding: 3, gap: 3, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)', border: '1px solid var(--border-control)' }}>
              {PRESET_INDICES.map(m => (
                <button
                  key={m.id} role="tab" aria-selected={indexId === m.id}
                  onClick={() => setIndexId(m.id)}
                  title={m.desc}
                  style={{
                    height: 'var(--control-h-sm)', padding: '0 14px', borderRadius: 'var(--radius-full)',
                    border: 'none', cursor: 'pointer',
                    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
                    background: indexId === m.id ? 'var(--accent)' : 'transparent',
                    color: indexId === m.id ? 'var(--on-accent)' : 'var(--text-muted)',
                    transition: 'var(--transition-base)',
                  }}
                >{m.name}</button>
              ))}
            </div>
          )}
          {tab === '村里指數' && customIndices.length > 0 && (
            <select
              value={def.preset ? '' : def.id}
              onChange={e => setIndexId(e.target.value || 'firstBuyer')}
              aria-label="自訂指數"
              style={{
                height: 'var(--control-h-md)', padding: '0 10px', borderRadius: 'var(--radius-md)',
                background: def.preset ? 'var(--surface-control)' : 'var(--accent-wash)',
                color: def.preset ? 'var(--text-muted)' : 'var(--accent-tint)',
                border: `1px solid ${def.preset ? 'var(--border-control)' : 'var(--accent-wash-border)'}`,
                fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
              }}
            >
              <option value="">自訂指數…</option>
              {customIndices.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          )}

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
              <option key={d.name} value={d.name}>{d.name}（{def.short}平均 {fmt(d.avg)}）</option>
            ))}
          </select>

          {tab === '村里指數' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={hideLow} onChange={e => setHideLow(e.target.checked)} />
              排行榜隱藏人口未滿 1,000 的里
            </label>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>
            {tab === '村里指數'
              ? <span style={{ fontFamily: 'var(--font-mono)' }}>人口 {rocMonth(data.meta.dataMonth)}・所得 {data.meta.incomeTaxYear} 年度</span>
              : TABS.find(t => t.key === tab)?.desc}
            {district && tab !== '村里指數' && <span style={{ color: 'var(--accent-tint)' }}>；已標示{district}</span>}
          </span>
        </div>
      </div>

      {tab === '村里指數' && (
        <>
          {/* 地圖 + 明細 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 14 }}>
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
                <Legend breaks={breaks} title={def.name} />
              </div>
            </div>

            <div style={{ ...cardStyle, minWidth: 0 }}>
              {sel
                ? <VillageDetail
                    v={sel} def={def} result={result} catalog={catalog}
                    rank={cityRank.get(sel.code) ?? 0} total={villages.length} meta={data.meta}
                    rentRow={data.rent.rows.find(r => r.district === sel.district && r.btype === '大樓華廈') ?? null}
                    assumption={assumption}
                    onClose={() => setSelected(null)}
                  />
                : <TopList rows={ranking.slice(0, 10)} score={score} def={def} district={district} onPick={pickFromTable} />}
            </div>
          </div>

          {/* 排行榜 */}
          <div style={cardStyle}>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>
                {district || '全市'}・{def.name}排行
              </span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
                前 30 名，點選列可在地圖上定位；率皆為每千人・年
              </span>
            </div>
            <RankingTable rows={ranking.slice(0, 30)} def={def} result={result} catalog={catalog} score={score} cityRank={cityRank} selected={selected} onPick={pickFromTable} />
          </div>

          <Methodology />
        </>
      )}

      {tab === '自訂指數' && (
        <CustomIndexSection
          catalog={catalog}
          villages={villages}
          geo={geo}
          presets={PRESET_INDICES}
          store={custom}
          password={password}
          onPassword={savePassword}
          onChanged={reloadCustom}
          onViewOnMap={viewIndexOnMap}
          highlightDistrict={hl}
        />
      )}

      {tab === '人口與家庭' && (
        <>
          {/* 未來人口推估（行政區，僅計自然增減） */}
          {data.projection.rows.length > 0 && <ProjectionSection data={data.projection} highlightDistrict={hl} />}
          {/* 學區學生數（行政區・學年） */}
          {data.schools.byDistrict.length > 0 && <SchoolSection data={data.schools} highlightDistrict={hl} />}
        </>
      )}

      {tab === '就業與產業' && (
        <>
          {/* 產業與就業（普查 + 工商家數） */}
          {data.industry.length > 0 && (
            <IndustrySection data={data.industry} popByDistrict={popByDistrict} highlightDistrict={hl} />
          )}
          {/* 南科就業動能（台南最大外來購屋族群來源） */}
          {data.southPark.length > 0 && (
            <div style={cardStyle}>
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>南科就業動能</span>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
                  南科是台南最大的外來購屋族群來源；園區級資料，不計入村里指數
                </span>
              </div>
              <SouthParkSection rows={data.southPark} industry={data.southParkIndustry} />
            </div>
          )}
        </>
      )}

      {tab === '房市與負擔' && (
        <>
          {/* 負擔能力、房貸條件、家庭收支（縣市級） */}
          <AffordabilitySection market={data.market} />

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
              highlightDistrict={hl}
            />
          </div>

          {/* 住宅供給動能：開工 → 使照 → 新屋交屋 → 待售新成屋（行政區） */}
          {data.supply.stats.length > 0 && (
            <SupplyPipelineSection data={data.supply} transfers={data.transfers} householdsByDistrict={householdsByDistrict} highlightDistrict={hl} />
          )}

          {/* 建物移轉、低度使用（行政區） */}
          <TransfersSection data={data.transfers} highlightDistrict={hl} />
          <LowUsageSection rows={data.lowUsage} highlightDistrict={hl} />

          {/* 屋齡結構（房屋稅籍存量） */}
          <div style={cardStyle}>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>屋齡結構（行政區）</span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
                房屋稅籍住宅存量；老屋占比高的區，換屋需求潛力越大；不計入村里指數
              </span>
            </div>
            <HouseAgeChart rows={data.houseAge.rows} period={data.houseAge.period} cityAvgAge={data.houseAge.cityAvgAge} highlightDistrict={hl} />
          </div>
        </>
      )}

      {tab === '重大建設' && <MajorProjectsSection highlightDistrict={hl} />}

      {tab === '資料總覽' && (
        <DataCatalogSection
          catalog={catalog}
          villages={villages}
          geo={geo}
          indices={allIndices}
          customStatus={custom.status}
          onGoTab={(t: string) => changeTab(t as Tab)}
          highlightDistrict={hl}
        />
      )}

      <style>{`
        ${RAMP_CSS}
        .pb-map-box { height: 620px; }
        .pb-tabs::-webkit-scrollbar { display: none; }
        @media (max-width: 760px) {
          .pb-map-card { grid-column: auto !important; }
          .pb-map-box { height: 460px; }
          /* 手機不固定頁籤列，避免佔掉半個畫面 */
          .pb-sticky { position: static !important; }
        }
      `}</style>
    </div>
  )
}

/* ── 前 10 名（未選取村里時） ──────────────────────────────────── */
function TopList({ rows, score, def, district, onPick }: {
  rows: Village[]; score: (c: string) => number; def: IndexDef; district: string; onPick: (c: string) => void
}) {
  return (
    <div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 2 }}>
        {district || '全市'}前 10 名・{def.short}
      </div>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginBottom: 10 }}>{def.desc || '點地圖上的村里看指標拆解'}</div>
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 600 }}>{fmt(score(v.code))}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ── 村里明細 ─────────────────────────────────────────────────── */
function VillageDetail({ v, def, result, catalog, rank, total, meta, rentRow, assumption, onClose }: {
  v: Village; def: IndexDef; result: IndexResult; catalog: Catalog
  rank: number; total: number; meta: Meta
  rentRow: RentRow | null; assumption: MortgageAssumption; onClose: () => void
}) {
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
        <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--accent-tint)', fontFamily: 'var(--font-mono)' }}>{fmt(result.scores.get(v.code))}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{def.name}・全市第 {rank} / {total} 名</span>
      </div>
      {/* 三個預設指數並列，方便比較 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {PRESET_INDICES.map(p => (
          <span key={p.id} style={{
            fontSize: 'var(--text-2xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)',
            border: `1px solid ${p.id === def.id ? 'var(--accent-wash-border)' : 'var(--border-control)'}`,
            background: p.id === def.id ? 'var(--accent-wash)' : 'transparent',
            color: p.id === def.id ? 'var(--accent-tint)' : 'var(--text-muted)',
          }}>{p.short} <b style={{ fontFamily: 'var(--font-mono)' }}>{fmt(computeIndex(p, catalog, [v.code]).scores.get(v.code))}</b></span>
        ))}
      </div>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', marginBottom: 12 }}>
        人口 {(v.raw.pop ?? 0).toLocaleString()}・{(v.raw.households ?? 0).toLocaleString()} 戶
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
      {result.used.map(c => {
        const ind = catalog.byKey.get(c.key)
        const p = partOf(result, c, v.code)
        const raw = catalog.values.get(c.key)?.get(v.code) ?? null
        const w = Math.round(c.weight / result.totalWeight * 100)
        return (
          <div key={c.key + (c.invert ? 'i' : '')} title={ind ? `${ind.desc}（${ind.source}・${ind.period}）` : ''} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--text-2xs)', marginBottom: 3 }}>
              <span style={{ color: 'var(--text-default)' }}>
                {ind?.label ?? c.key}{ind?.level === '行政區' && <span style={{ color: 'var(--text-faint)' }}>（區）</span>}
                {c.invert && <span style={{ color: 'var(--warning)' }}> ↓越低越好</span>}
                <span style={{ color: 'var(--text-faint)' }}> × {w}%</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{fmtValue(ind, raw)}</span>
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
            家戶結構
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

      {(() => {
        const projects = MAJOR_PROJECTS.filter(p => p.districts.includes(v.district))
        if (!projects.length) return null
        return (
          <>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', margin: '14px 0 6px' }}>
              {v.district}相關重大建設
            </div>
            {projects.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', fontSize: 'var(--text-2xs)', padding: '3px 0', borderBottom: '1px solid var(--border-card)' }}>
                <span style={{ color: 'var(--text-default)' }}>{p.name}<span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>{p.expected}</span></span>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </>
        )
      })()}

      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', margin: '14px 0 6px' }}>
        生活機能（里內點數，不計分）
        <span style={{ fontWeight: 400, color: 'var(--text-faint)', marginLeft: 6, fontSize: 'var(--text-2xs)' }}>OpenStreetMap</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {POI_LABELS.map(([k, label]) => (
          <span key={k} style={{
            fontSize: 'var(--text-2xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: v.poi[k] ? 'var(--accent-wash)' : 'var(--surface-control)',
            color: v.poi[k] ? 'var(--accent-tint)' : 'var(--text-faint)',
            border: `1px solid ${v.poi[k] ? 'var(--accent-wash-border)' : 'var(--border-control)'}`,
          }}>{label} {v.poi[k] ?? 0}</span>
        ))}
      </div>
      <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', marginTop: 4 }}>
        © OpenStreetMap contributors；社群資料覆蓋率不一，0 不代表一定沒有。便利商店、診所資料過於不完整，未列入。
      </div>
    </div>
  )
}
const ddStyle: React.CSSProperties = { margin: 0, textAlign: 'right', color: 'var(--text-default)', fontFamily: 'var(--font-mono)' }

/* ── 排行榜表格（欄位跟著指數的組成變動） ───────────────────────── */
function RankingTable({ rows, def, result, catalog, score, cityRank, selected, onPick }: {
  rows: Village[]; def: IndexDef; result: IndexResult; catalog: Catalog; score: (c: string) => number
  cityRank: Map<string, number>; selected: string | null; onPick: (c: string) => void
}) {
  const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-card)' }
  const td: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }
  const cols = result.used.map(c => ({ c, ind: catalog.byKey.get(c.key) }))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>全市排名</th>
            <th style={{ ...th, textAlign: 'left' }}>村里</th>
            <th style={th}>{def.name}</th>
            <th style={th}>人口</th>
            {cols.map(({ c, ind }) => (
              <th key={c.key} style={th} title={ind?.desc}>
                {ind?.label ?? c.key}{ind?.unit && !['%', '‰'].includes(ind.unit) ? `（${ind.unit}）` : ''}
              </th>
            ))}
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
              <td style={{ ...td, color: 'var(--text-strong)', fontWeight: 600 }}>{fmt(score(v.code))}</td>
              <td style={td}>{(v.raw.pop ?? 0).toLocaleString()}</td>
              {cols.map(({ c, ind }) => {
                const raw = catalog.values.get(c.key)?.get(v.code) ?? null
                // 只顯示數字（單位放在表頭），% 與 ‰ 保留在數字後
                const text = fmtValue(ind ? { ...ind, unit: ['%', '‰'].includes(ind.unit) ? ind.unit : '' } : undefined, raw)
                return <td key={c.key} style={td}>{text}</td>
              })}
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
        <li style={li}><b>首購指數</b> = 世代淨移入（25–34）30% + 25–34 歲占比 25% + 結婚率 10% + 所得（購買力）25% + 社會增加率 10%。結婚率與各區預售成交的相關較弱，權重較低。</li>
        <li style={li}><b>換新屋指數</b> = 世代淨移入（35–44）20% + 35–44 歲占比 20% + 出生率 20% + 所得（購買力）20% + 設籍宅數成長 20%。和各區近 24 月預售＋新成屋交易量的排名相關 0.79。</li>
        <li style={li}><b>換二手指數</b> = 世代淨移入（35–44）10% + 35–44 歲占比 20% + 26–45 歲戶長占比 20% + 所得（購買力）30% + 大學以上學歷 20%。和各區近 24 月二手成屋（屋齡 5 年以上）交易量的排名相關 0.80。</li>
        <li style={li}><b>世代淨移入</b>：比較同一批人一年前後的人數（例如去年 25–34 歲 vs 今年 26–35 歲），這個年齡層死亡很少，差額約等於淨搬入。</li>
        <li style={li}><b>社會增加率</b>含同區跨里遷移；新社區的住戶常來自同區隔壁里，不加回會被低估。</li>
        <li style={li}><b>結婚率、出生率</b>在小里波動很大，已往所屬行政區的平均收縮（人口越少收縮越多）。</li>
        <li style={li}><b>所得（購買力）</b>為財政部綜所稅申報資料，用來代表各里的購買力；不含免稅與分離課稅所得，且落後約 2–3 年，只做相對排名。</li>
        <li style={li}><b>設籍宅數成長</b>、<b>26–45 歲戶長占比</b>為內政部戶政平台村里季資料；沒有資料的里以中性值 50 計。</li>
        <li style={li}>時間窗為最近 12 個月；人口未滿 1,000 的里雜訊大，地圖以淡色虛線標示。想用自己的權重，到「自訂指數」頁籤。</li>
      </ul>
    </details>
  )
}

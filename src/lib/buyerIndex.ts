/**
 * 潛在客群指數引擎（前端）
 *  - 指標目錄：所有可顯示、可放進指數的資料（村里層級 + 行政區層級 + 手動資料）
 *  - 百分位：與 MV 相同的 percent_rank 定義（NULL 不參與排名、給中性值 50）
 *  - 指數：各組成百分位 × 權重 ÷ 權重總和
 * 預設三個指數的權重須與 supabase/migrations/20261003_village_buyer_indicators.sql（v5）一致
 */
import type { IndustryPoint } from '@/components/IndustrySection'
import type { SupplyData } from '@/components/SupplyPipelineSection'
import type { LowUsageRow, TransfersData } from '@/components/MarketSection'
import type { HouseAgeRow } from '@/components/HouseAgeChart'
import type { ProjectionData } from '@/components/ProjectionSection'
import type { SchoolData } from '@/components/SchoolSection'
import { DEFAULT_ASSUMPTION, rentRatio, type RentRow } from '@/components/RentMortgageTable'

/* ── 型別 ─────────────────────────────────────────────────────── */
export type RawKey =
  | 'pop' | 'households' | 'share2534' | 'share3544' | 'cohortYoung' | 'cohortMid'
  | 'marriage' | 'birth' | 'social' | 'income' | 'hhSize' | 'splitSpeed'
  | 'netOtherCity' | 'netOtherTown' | 'netSameTown' | 'women1549' | 'women1549Share'
  | 'divorces' | 'divorceKDistrict' | 'eduUnivPlus' | 'eduGrad' | 'singleHh'
  | 'headAvgAge' | 'head2645' | 'head2645Chg' | 'head65p'
  | 'multiHh' | 'multiHhChg' | 'soloDwelling' | 'dwellingsGrowth'

export interface Village {
  code: string
  district: string
  village: string
  /** MV 算好的官方指數（資料庫為準；前端另以同公式計算供拆解與自訂指數使用） */
  firstBuyer: number
  newHome: number | null
  resale: number | null
  raw: Record<RawKey, number | null>
  poi: Record<string, number>
  lowConfidence: boolean
  cohortMissing: boolean
  incomeFromParent: boolean
}

export interface Meta {
  dataMonth: string | null; incomeTaxYear: number | null
  eduYear: number | null; hhYear: number | null; hhqPeriod: string | null
}

export type Level = '村里' | '行政區'

export interface Indicator {
  key: string
  label: string
  unit: string
  group: string
  level: Level
  /** 一句話說明 */
  desc: string
  source: string
  /** 資料期間（顯示用） */
  period: string
  digits: number
  /** true = 數值可正可負，顯示時加正負號 */
  signed?: boolean
}

export interface Component { key: string; weight: number; invert?: boolean }

export interface IndexDef {
  id: string
  name: string
  short: string
  desc: string
  components: Component[]
  /** 預設指數（不可刪改）或使用者自訂 */
  preset: boolean
  aiNote?: string | null
}

/** 手動資料（對應 custom_datasets + custom_dataset_values） */
export interface CustomDataset {
  id: string
  name: string
  unit: string | null
  level: 'village' | 'district'
  description: string | null
  source: string | null
  values: Record<string, number>   // village_code 或 行政區名稱 → 數值
  updatedAt?: string
}

export interface CatalogInput {
  meta: Meta
  villages: Village[]
  industry: IndustryPoint[]
  supply: SupplyData
  transfers: TransfersData
  lowUsage: LowUsageRow[]
  houseAge: { period: string | null; rows: HouseAgeRow[] }
  rent: { rentPeriod: string | null; rows: RentRow[] }
  projection: ProjectionData
  schools: SchoolData
}

export interface Catalog {
  indicators: Indicator[]
  byKey: Map<string, Indicator>
  /** 指標 → 村里代碼 → 數值（行政區層級指標已展開到所屬村里） */
  values: Map<string, Map<string, number | null>>
  /** 行政區層級指標 → 行政區 → 數值（資料總覽畫長條用） */
  districtValues: Map<string, Map<string, number | null>>
}

/* ── 預設三個指數 ─────────────────────────────────────────────── */
export const PRESET_INDICES: IndexDef[] = [
  {
    id: 'firstBuyer', name: '首購指數', short: '首購', preset: true,
    desc: '25–34 歲年輕人第一次買房的需求強度',
    components: [
      { key: 'cohortYoung', weight: 30 }, { key: 'share2534', weight: 25 }, { key: 'marriage', weight: 10 },
      { key: 'income', weight: 25 }, { key: 'social', weight: 10 },
    ],
  },
  {
    id: 'newHome', name: '換新屋指數', short: '換新屋', preset: true,
    desc: '35–44 歲家庭換屋、偏好預售與新成屋的需求強度',
    components: [
      { key: 'cohortMid', weight: 20 }, { key: 'share3544', weight: 20 }, { key: 'birth', weight: 20 },
      { key: 'income', weight: 20 }, { key: 'dwellingsGrowth', weight: 20 },
    ],
  },
  {
    id: 'resale', name: '換二手指數', short: '換二手', preset: true,
    desc: '35–44 歲家庭在成熟市區換購二手屋的需求強度',
    components: [
      { key: 'cohortMid', weight: 10 }, { key: 'share3544', weight: 20 }, { key: 'head2645', weight: 20 },
      { key: 'income', weight: 30 }, { key: 'eduUnivPlus', weight: 20 },
    ],
  },
]

/* ── 指標目錄 ─────────────────────────────────────────────────── */
const RIS = '內政部戶政司 村里統計'
const RIS_Q = '內政部 戶政平台村里季資料'

/** 村里層級指標（直接來自 /api/potential-buyers 的 raw 欄位） */
function villageIndicators(meta: Meta): (Omit<Indicator, 'level'> & { raw: RawKey })[] {
  const m = meta.dataMonth ?? '—'
  const w12 = `近 12 月（至 ${m}）`
  const q = meta.hhqPeriod ?? '—'
  return [
    { raw: 'pop', key: 'pop', label: '人口數', unit: '人', group: '人口結構', desc: '最新月份戶籍人口', source: RIS, period: m, digits: 0 },
    { raw: 'households', key: 'households', label: '戶數', unit: '戶', group: '人口結構', desc: '最新月份戶籍戶數', source: RIS, period: m, digits: 0 },
    { raw: 'share2534', key: 'share2534', label: '25–34 歲人口占比', unit: '%', group: '人口結構', desc: '首購主力年齡層占全里人口比例', source: RIS, period: m, digits: 1 },
    { raw: 'share3544', key: 'share3544', label: '35–44 歲人口占比', unit: '%', group: '人口結構', desc: '換屋主力年齡層占全里人口比例', source: RIS, period: m, digits: 1 },
    { raw: 'women1549Share', key: 'women1549Share', label: '育齡婦女占比', unit: '%', group: '人口結構', desc: '15–49 歲女性占全里人口比例', source: RIS, period: m, digits: 1 },
    { raw: 'hhSize', key: 'hhSize', label: '戶量', unit: '人／戶', group: '人口結構', desc: '平均每戶人數，越小代表小家庭越多', source: RIS, period: m, digits: 2 },
    { raw: 'splitSpeed', key: 'splitSpeed', label: '分戶速度', unit: '%', group: '人口結構', desc: '戶數成長減人口成長，正值代表分戶（成家、獨立）', source: RIS, period: w12, digits: 2, signed: true },

    { raw: 'cohortYoung', key: 'cohortYoung', label: '世代淨移入（25–34 歲）', unit: '‰', group: '遷徙', desc: '同一批年輕人一年後多了或少了多少，約等於淨搬入', source: RIS, period: w12, digits: 1, signed: true },
    { raw: 'cohortMid', key: 'cohortMid', label: '世代淨移入（35–44 歲）', unit: '‰', group: '遷徙', desc: '同一批中年家庭一年後多了或少了多少', source: RIS, period: w12, digits: 1, signed: true },
    { raw: 'social', key: 'social', label: '社會增加率', unit: '‰', group: '遷徙', desc: '全年齡遷入減遷出（含同區跨里）', source: RIS, period: w12, digits: 1, signed: true },
    { raw: 'netOtherCity', key: 'netOtherCity', label: '跨縣市淨移入', unit: '‰', group: '遷徙', desc: '從外縣市搬來減搬去外縣市', source: RIS, period: w12, digits: 1, signed: true },
    { raw: 'netOtherTown', key: 'netOtherTown', label: '市內他區淨移入', unit: '‰', group: '遷徙', desc: '台南市其他區搬來減搬去', source: RIS, period: w12, digits: 1, signed: true },
    { raw: 'netSameTown', key: 'netSameTown', label: '同區跨里淨移入', unit: '‰', group: '遷徙', desc: '同一區隔壁里搬來減搬去', source: RIS, period: w12, digits: 1, signed: true },

    { raw: 'marriage', key: 'marriage', label: '結婚率', unit: '‰', group: '婚育', desc: '每千人結婚對數，小里已往行政區平均收縮', source: RIS, period: w12, digits: 2 },
    { raw: 'birth', key: 'birth', label: '出生率', unit: '‰', group: '婚育', desc: '每千人出生數，小里已往行政區平均收縮', source: RIS, period: w12, digits: 2 },
    { raw: 'divorces', key: 'divorces', label: '離婚對數', unit: '對', group: '婚育', desc: '近 12 月離婚對數（村里間差異多為隨機）', source: RIS, period: w12, digits: 0 },

    { raw: 'income', key: 'income', label: '所得中位數（購買力）', unit: '千元', group: '所得與學歷', desc: '綜所稅申報所得中位數，代表購買力', source: '財政部財政資訊中心 綜合所得稅', period: `${meta.incomeTaxYear ?? '—'} 年度`, digits: 0 },
    { raw: 'eduUnivPlus', key: 'eduUnivPlus', label: '大學以上學歷占比', unit: '%', group: '所得與學歷', desc: '15 歲以上人口中大學以上畢業比例', source: '內政部戶政司 村里教育程度', period: `${meta.eduYear ?? '—'} 年`, digits: 1 },
    { raw: 'eduGrad', key: 'eduGrad', label: '碩博士占比', unit: '%', group: '所得與學歷', desc: '15 歲以上人口中碩博士比例', source: '內政部戶政司 村里教育程度', period: `${meta.eduYear ?? '—'} 年`, digits: 1 },

    { raw: 'headAvgAge', key: 'headAvgAge', label: '戶長平均年齡', unit: '歲', group: '家戶與住宅', desc: '戶長越年輕，成家購屋階段的家戶越多', source: RIS_Q, period: q, digits: 1 },
    { raw: 'head2645', key: 'head2645', label: '26–45 歲戶長占比', unit: '%', group: '家戶與住宅', desc: '正在成家、換屋階段的戶長比例', source: RIS_Q, period: q, digits: 1 },
    { raw: 'head2645Chg', key: 'head2645Chg', label: '26–45 歲戶長占比變化', unit: '百分點', group: '家戶與住宅', desc: '較一年前同季的變化', source: RIS_Q, period: q, digits: 2, signed: true },
    { raw: 'head65p', key: 'head65p', label: '65 歲以上戶長占比', unit: '%', group: '家戶與住宅', desc: '高齡戶長比例，越高通常購屋需求越低', source: RIS_Q, period: q, digits: 1 },
    { raw: 'multiHh', key: 'multiHh', label: '一宅多戶占比', unit: '%', group: '家戶與住宅', desc: '同一住宅設籍 2 戶以上（潛在分戶，偏鄉多為三代同堂）', source: RIS_Q, period: q, digits: 1 },
    { raw: 'multiHhChg', key: 'multiHhChg', label: '一宅多戶占比變化', unit: '百分點', group: '家戶與住宅', desc: '較一年前同季的變化', source: RIS_Q, period: q, digits: 2, signed: true },
    { raw: 'soloDwelling', key: 'soloDwelling', label: '1 人一宅占比', unit: '%', group: '家戶與住宅', desc: '獨居住宅比例', source: RIS_Q, period: q, digits: 1 },
    { raw: 'dwellingsGrowth', key: 'dwellingsGrowth', label: '設籍宅數成長', unit: '%', group: '家戶與住宅', desc: '設有戶籍的住宅數年增率，反映新住宅入住', source: RIS_Q, period: q, digits: 2, signed: true },
    { raw: 'singleHh', key: 'singleHh', label: '單獨生活戶占比', unit: '%', group: '家戶與住宅', desc: '一人一戶的戶數比例', source: '內政部戶政司 村里戶數結構', period: `${meta.hhYear ?? '—'} 年`, digits: 1 },
  ]
}

/** 生活機能類別（對應 poi_points.category） */
export const POI_LABELS: [string, string][] = [
  ['school', '學校'], ['park', '公園'], ['supermarket', '超市'], ['mall', '量販／百貨'],
  ['hospital', '醫院'], ['library', '圖書館'], ['station', '車站'],
]

const GROUP_ORDER = ['人口結構', '遷徙', '婚育', '所得與學歷', '家戶與住宅', '生活機能', '就業與產業', '房市與供給', '人口推估與學區', '手動資料']

/** 建立完整指標目錄與數值表 */
export function buildCatalog(input: CatalogInput, custom: CustomDataset[] = []): Catalog {
  const { villages, meta } = input
  const indicators: Indicator[] = []
  const values = new Map<string, Map<string, number | null>>()
  const districtValues = new Map<string, Map<string, number | null>>()

  // 1. 村里層級
  for (const ind of villageIndicators(meta)) {
    const { raw, ...rest } = ind
    indicators.push({ ...rest, level: '村里' })
    values.set(ind.key, new Map(villages.map(v => [v.code, v.raw[raw]])))
  }
  for (const [k, label] of POI_LABELS) {
    const key = `poi:${k}`
    indicators.push({ key, label: `${label}數量`, unit: '處', group: '生活機能', level: '村里', desc: `里內${label}點數（社群資料，0 不代表一定沒有）`, source: 'OpenStreetMap', period: '最新', digits: 0 })
    values.set(key, new Map(villages.map(v => [v.code, v.poi[k] ?? 0])))
  }

  // 2. 行政區層級：先算各區數值，再展開到所屬村里
  const pop = new Map<string, number>(), hh = new Map<string, number>()
  for (const v of villages) {
    pop.set(v.district, (pop.get(v.district) ?? 0) + (v.raw.pop ?? 0))
    hh.set(v.district, (hh.get(v.district) ?? 0) + (v.raw.households ?? 0))
  }
  const districts = [...pop.keys()]
  const addDistrict = (ind: Omit<Indicator, 'level'>, get: (d: string) => number | null | undefined) => {
    const dm = new Map(districts.map(d => {
      const x = get(d)
      return [d, x == null || !Number.isFinite(x) ? null : x] as const
    }))
    if (![...dm.values()].some(x => x != null)) return   // 整個指標沒資料就不列
    indicators.push({ ...ind, level: '行政區' })
    districtValues.set(ind.key, dm)
    values.set(ind.key, new Map(villages.map(v => [v.code, dm.get(v.district) ?? null])))
  }
  const perK = (x: number | null | undefined, base: number | undefined) => (x == null || !base ? null : x / base * 1000)

  // 婚育：離婚率只有行政區有意義
  addDistrict({ key: 'divorceKDistrict', label: '離婚率', unit: '‰', group: '婚育', desc: '每千人離婚對數（行政區）', source: RIS, period: `近 12 月（至 ${meta.dataMonth ?? '—'}）`, digits: 2 },
    d => villages.find(v => v.district === d)?.raw.divorceKDistrict)

  // 就業與產業
  const ind = (area: string, key: string) => input.industry.find(r => r.area === area && r.indicator === key)?.value ?? null
  const censusYear = input.industry.find(r => r.indicator.startsWith('census_'))?.period ?? '—'
  const bizYear = input.industry.find(r => r.indicator.startsWith('biz_count:'))?.period ?? '—'
  addDistrict({ key: 'd:jobsPerK', label: '每千居民工作數', unit: '個', group: '就業與產業', desc: '從業員工 ÷ 戶籍人口 × 1000，超過 1000 為就業中心', source: '主計總處 工業及服務業普查', period: `${censusYear} 年`, digits: 0 },
    d => perK(ind(d, 'census_employees:all'), pop.get(d)))
  addDistrict({ key: 'd:officerShare', label: '職員占比', unit: '%', group: '就業與產業', desc: '監督及專技人員占從業員工比例（白領程度）', source: '主計總處 工業及服務業普查', period: `${censusYear} 年`, digits: 1 },
    d => { const e = ind(d, 'census_employees:all'), o = ind(d, 'census_officers'); return e && o != null ? o / e * 100 : null })
  addDistrict({ key: 'd:mfgShare', label: '製造業占比', unit: '%', group: '就業與產業', desc: '製造業員工占從業員工比例', source: '主計總處 工業及服務業普查', period: `${censusYear} 年`, digits: 1 },
    d => { const e = ind(d, 'census_employees:all'), m = ind(d, 'census_employees:mfg'); return e && m != null ? m / e * 100 : null })
  addDistrict({ key: 'd:bizPerK', label: '每千人工商家數', unit: '家', group: '就業與產業', desc: '公司與商業登記家數 ÷ 人口 × 1000', source: '內政部 SEGIS 工商家數', period: `${bizYear} 年底`, digits: 1 },
    d => perK(ind(d, 'biz_count:all'), pop.get(d)))

  // 房市與供給
  const startYears = [...new Set(input.supply.stats.filter(s => s.indicator === 'construction_start_units').map(s => s.period))].sort()
  const y1 = startYears.at(-1)
  const sup = (area: string, key: string, period?: string) =>
    input.supply.stats.find(s => s.indicator === key && s.area === area && (!period || s.period === period))?.value ?? null
  addDistrict({ key: 'd:startPerK', label: '每千戶住宅開工', unit: '戶', group: '房市與供給', desc: '開工戶數 ÷ 現有戶數 × 1000，未來 2–4 年完工量', source: '臺南市工務局 建築物開工統計', period: `${y1 ?? '—'} 年`, digits: 1 },
    d => (y1 ? perK(sup(d, 'construction_start_units', y1), hh.get(d)) : null))
  const tm = input.transfers.latestMonth ?? '—'
  addDistrict({ key: 'd:firstPerK', label: '每千戶新屋交屋', unit: '棟', group: '房市與供給', desc: '建物第一次移轉 ÷ 戶數 × 1000', source: '內政部 建物移轉統計', period: `近 12 月（至 ${tm}）`, digits: 1 },
    d => perK(input.transfers.rows.find(r => r.district === d)?.first12m, hh.get(d)))
  addDistrict({ key: 'd:salePerK', label: '每千戶買賣移轉', unit: '棟', group: '房市與供給', desc: '建物買賣移轉 ÷ 戶數 × 1000（成交熱度）', source: '內政部 建物移轉統計', period: `近 12 月（至 ${tm}）`, digits: 1 },
    d => perK(input.transfers.rows.find(r => r.district === d)?.sale12m, hh.get(d)))
  addDistrict({ key: 'd:unsoldPerK', label: '每千戶待售新成屋', unit: '宅', group: '房市與供給', desc: '已完工未售出的新成屋 ÷ 戶數 × 1000（去化壓力）', source: '公會 新建餘屋統計', period: input.supply.unsoldPeriod ?? '—', digits: 1 },
    d => perK(input.supply.unsold.find(u => u.district === d)?.units, hh.get(d)))
  const lu = (d: string) => input.lowUsage.find(r => r.area === d && r.indicator === 'low_usage_rate' && r.isLatest)
  addDistrict({ key: 'd:lowUsage', label: '低度使用住宅比例', unit: '%', group: '房市與供給', desc: '用電量低的住宅比例（近似空屋率）', source: '內政部 低度使用（用電）住宅', period: input.lowUsage.find(r => r.isLatest)?.period ?? '—', digits: 1 },
    d => lu(d)?.value)
  addDistrict({ key: 'd:stockAge', label: '住宅平均屋齡', unit: '年', group: '房市與供給', desc: '房屋稅籍住宅存量平均屋齡', source: '財政部 房屋稅籍', period: input.houseAge.period ?? '—', digits: 1 },
    d => input.houseAge.rows.find(r => r.district === d)?.avgAge)
  addDistrict({ key: 'd:old30', label: '30 年以上老屋占比', unit: '%', group: '房市與供給', desc: '屋齡 30 年以上住宅占存量比例（換屋潛力）', source: '財政部 房屋稅籍', period: input.houseAge.period ?? '—', digits: 1 },
    d => { const r = input.houseAge.rows.find(x => x.district === d); return r ? r.pct30_40 + r.pctGe40 : null })
  addDistrict({ key: 'd:rentRatio', label: '大樓租金／房貸月付比', unit: '倍', group: '房市與供給', desc: '月租 ÷ 同坪數房貸月付（2.2%、八成、30 年），越接近 1 越容易租轉買', source: '實價登錄 租賃與買賣', period: input.rent.rentPeriod ?? '—', digits: 2 },
    d => { const r = input.rent.rows.find(x => x.district === d && x.btype === '大樓華廈'); return r ? rentRatio(r, DEFAULT_ASSUMPTION) : null })

  // 人口推估與學區
  const proj = input.projection.rows.filter(r => r.scope === '中推估')
  const projYears = [...new Set(proj.map(r => r.year))].sort((a, b) => a - b)
  const py0 = projYears[0], py10 = projYears.find(y => y >= (py0 ?? 0) + 10)
  addDistrict({ key: 'd:proj2544', label: '10 年後 25–44 歲人口變化', unit: '%', group: '人口推估與學區', desc: '中推估，只計自然增減（不含遷徙）', source: `臺南市人口推估 ${input.projection.edition ?? ''}`.trim(), period: py0 && py10 ? `${py0}→${py10} 年` : '—', digits: 1, signed: true },
    d => {
      const a = proj.find(r => r.area === d && r.year === py0), b = proj.find(r => r.area === d && r.year === py10)
      return a && b && a.a2534 + a.a3544 ? ((b.a2534 + b.a3544) / (a.a2534 + a.a3544) - 1) * 100 : null
    })
  const elem = input.schools.byDistrict.filter(r => r.level === '國小')
  const sy = [...new Set(elem.map(r => r.year))].sort((a, b) => a - b)
  const syNow = sy.at(-1), syThen = sy.find(y => syNow != null && y >= syNow - 5)
  addDistrict({ key: 'd:entryChg', label: '國小新生變化', unit: '%', group: '人口推估與學區', desc: '一年級新生較 5 年前增減，反映年輕家庭移入', source: '教育部 各級學校基本資料', period: syNow && syThen ? `${syThen}→${syNow} 學年` : '—', digits: 1, signed: true },
    d => {
      const a = elem.find(r => r.district === d && r.year === syThen), b = elem.find(r => r.district === d && r.year === syNow)
      return a && b && a.entry ? (b.entry / a.entry - 1) * 100 : null
    })

  // 3. 手動資料
  for (const c of custom) {
    const key = `custom:${c.id}`
    const base = { key, label: c.name, unit: c.unit ?? '', group: '手動資料', desc: c.description || '使用者手動加入', source: c.source || '手動輸入', period: c.updatedAt ? `更新 ${c.updatedAt.slice(0, 10)}` : '—', digits: 2 }
    if (c.level === 'village') {
      indicators.push({ ...base, level: '村里' })
      values.set(key, new Map(villages.map(v => [v.code, c.values[v.code] ?? null])))
    } else {
      addDistrict(base, d => c.values[d])
    }
  }

  // 依分類排序（同分類內保持原順序；村里層級在前、行政區層級在後）
  const order = (g: string) => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? GROUP_ORDER.length : i }
  indicators.sort((a, b) => order(a.group) - order(b.group))
  return { indicators, byKey: new Map(indicators.map(i => [i.key, i])), values, districtValues }
}

/* ── 計算 ─────────────────────────────────────────────────────── */
/** 全市百分位（0–100），與 Postgres percent_rank() 相同：(比自己小的個數) ÷ (n − 1)；NULL → 50 */
export function percentRanks(m: Map<string, number | null>): Map<string, number> {
  const vals = [...m.values()].filter((x): x is number => x != null).sort((a, b) => a - b)
  const n = vals.length
  const out = new Map<string, number>()
  for (const [code, x] of m) {
    if (x == null || n < 2) { out.set(code, 50); continue }
    // 二分搜尋：第一個 >= x 的位置 = 比 x 小的個數
    let lo = 0, hi = n
    while (lo < hi) { const mid = (lo + hi) >> 1; if (vals[mid] < x) lo = mid + 1; else hi = mid }
    out.set(code, lo / (n - 1) * 100)
  }
  return out
}

export interface IndexResult {
  /** 村里代碼 → 指數（0–100，小數一位） */
  scores: Map<string, number>
  /** 組成指標 → 村里代碼 → 百分位（已處理反向） */
  parts: Map<string, Map<string, number>>
  /** 有效組成（目錄裡找不到的指標會被略過） */
  used: Component[]
  totalWeight: number
}

export function computeIndex(def: { components: Component[] }, catalog: Catalog, villageCodes: string[], rankCache?: Map<string, Map<string, number>>): IndexResult {
  const used = def.components.filter(c => c.weight > 0 && catalog.values.has(c.key))
  const totalWeight = used.reduce((s, c) => s + c.weight, 0)
  const parts = new Map<string, Map<string, number>>()
  for (const c of used) {
    let r = rankCache?.get(c.key)
    if (!r) { r = percentRanks(catalog.values.get(c.key)!); rankCache?.set(c.key, r) }
    parts.set(c.key + (c.invert ? ':inv' : ''), c.invert ? new Map([...r].map(([k, p]) => [k, 100 - p])) : r)
  }
  const scores = new Map<string, number>()
  for (const code of villageCodes) {
    if (!totalWeight) { scores.set(code, 50); continue }
    let s = 0
    for (const c of used) s += c.weight * (parts.get(c.key + (c.invert ? ':inv' : ''))!.get(code) ?? 50)
    scores.set(code, Math.round(s / totalWeight * 10) / 10)
  }
  return { scores, parts, used, totalWeight }
}

/** 取得某組成在某村里的百分位 */
export function partOf(res: IndexResult, c: Component, code: string): number {
  return res.parts.get(c.key + (c.invert ? ':inv' : ''))?.get(code) ?? 50
}

/** Spearman 等級相關（兩個指數在 650 里的排名相似度） */
export function rankCorr(a: Map<string, number>, b: Map<string, number>): number | null {
  const codes = [...a.keys()].filter(k => b.has(k))
  if (codes.length < 3) return null
  const ra = percentRanks(new Map(codes.map(k => [k, a.get(k)!])))
  const rb = percentRanks(new Map(codes.map(k => [k, b.get(k)!])))
  const xs = codes.map(k => ra.get(k)!), ys = codes.map(k => rb.get(k)!)
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2 }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null
}

/* ── 格式化 ───────────────────────────────────────────────────── */
export function fmtValue(ind: Indicator | undefined, v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  const d = ind?.digits ?? 1
  const s = v.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d })
  const sign = ind?.signed && v > 0 ? '+' : ''
  const unit = ind?.unit ? (['%', '‰'].includes(ind.unit) ? ind.unit : ` ${ind.unit}`) : ''
  return sign + s + unit
}

/* ── 手動資料貼上解析 ─────────────────────────────────────────── */
export interface ParseResult { values: Record<string, number>; unmatched: string[] }

/**
 * 解析貼上的文字（每行一筆，逗號或 Tab 分隔，可含標題列）
 *  - 村里層級：「村里代碼, 數值」或「行政區, 村里, 數值」或「行政區村里, 數值」
 *  - 行政區層級：「行政區, 數值」
 */
export function parseAreaValues(text: string, level: 'village' | 'district', villages: Village[]): ParseResult {
  const values: Record<string, number> = {}
  const unmatched: string[] = []
  const districts = new Set(villages.map(v => v.district))
  const byName = new Map(villages.map(v => [v.district + v.village, v.code]))
  const codes = new Set(villages.map(v => v.code))
  // 「台」「臺」通用；行政區可省略「區」
  const norm = (s: string) => s.trim().replace(/台/g, '臺').replace(/\s+/g, '')
  const fixDistrict = (s: string) => { const n = norm(s); return districts.has(n) ? n : districts.has(n + '區') ? n + '區' : null }

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells = line.split(/[,\t，]/).map(c => c.trim()).filter(Boolean)
    if (cells.length < 2) { unmatched.push(line); continue }
    const value = Number(cells.at(-1)!.replace(/[,％%]/g, ''))
    if (!Number.isFinite(value)) { if (Object.keys(values).length || unmatched.length) unmatched.push(line); continue }  // 第一行非數字視為標題
    const keys = cells.slice(0, -1)
    let key: string | null = null
    if (level === 'district') {
      key = fixDistrict(keys.join(''))
    } else if (keys.length === 1 && codes.has(keys[0])) {
      key = keys[0]
    } else {
      const joined = keys.length >= 2 ? (fixDistrict(keys[0]) ?? norm(keys[0])) + norm(keys[1]) : norm(keys[0])
      key = byName.get(joined) ?? null
    }
    if (key) values[key] = value
    else unmatched.push(line)
  }
  return { values, unmatched }
}

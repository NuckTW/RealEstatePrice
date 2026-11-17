/**
 * 共用篩選條件解析
 * 所有 API route 的日期區間、行政區、區域（重劃區）、建物型態、房型、預售/成屋、屋齡
 * 解析邏輯集中在這裡，確保各 API 套用相同規則。
 */
import { zonesWhere } from './zones'

/** SQL 字串跳脫（單引號） */
export function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''")
}

export interface RocDateRange {
  fromDate: string    // 含（YYYY-MM-01）
  toDateExcl: string  // 不含（迄月的次月 1 日）
}

/** 民國年月 → SQL 日期範圍（前含後不含） */
export function rocDateRange(
  fromYear: number, fromMonth: number,
  toYear: number, toMonth: number
): RocDateRange {
  const fy = fromYear + 1911
  const ty = toYear + 1911
  const fromDate  = `${fy}-${String(fromMonth).padStart(2, '0')}-01`
  const nextMonth = toMonth === 12 ? 1 : toMonth + 1
  const nextYear  = toMonth === 12 ? ty + 1 : ty
  return {
    fromDate,
    toDateExcl: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  }
}

interface DateParamKeys {
  fromYear: string; fromMonth: string
  toYear: string;   toMonth: string
}

/** 預設參數名（/api/charts、/api/map、/api/case-detail 使用） */
const DEFAULT_DATE_KEYS: DateParamKeys = {
  fromYear: 'dateFromYear', fromMonth: 'dateFromMonth',
  toYear: 'dateToYear', toMonth: 'dateToMonth',
}

/** /api/analysis 使用的參數名 */
export const ANALYSIS_DATE_KEYS: DateParamKeys = {
  fromYear: 'yearFrom', fromMonth: 'monthFrom',
  toYear: 'yearTo', toMonth: 'monthTo',
}

const ROC_YEAR_MIN = 80
const ROC_YEAR_MAX = 200

/**
 * 整數參數解析：必須是純數字且落在 [min, max]，否則回預設值。
 * 參數會直接拼進 SQL，所以不合法的值（NaN、超大數字、夾帶其他字元）一律不放行，
 * 也避免組出無效日期讓查詢失敗回 500。
 */
function intInRange(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw == null || !/^\d{1,4}$/.test(raw.trim())) return fallback
  const n = Number(raw.trim())
  return n >= min && n <= max ? n : fallback
}

/** 從 URL params 解析民國年月日期區間（預設 110/1 ～ 115/12） */
export function parseRocDateRange(
  params: URLSearchParams,
  keys: DateParamKeys = DEFAULT_DATE_KEYS
): RocDateRange {
  return rocDateRange(
    intInRange(params.get(keys.fromYear),  ROC_YEAR_MIN, ROC_YEAR_MAX, 110),
    intInRange(params.get(keys.fromMonth), 1, 12, 1),
    intInRange(params.get(keys.toYear),    ROC_YEAR_MIN, ROC_YEAR_MAX, 115),
    intInRange(params.get(keys.toMonth),   1, 12, 12),
  )
}

/** 多選參數上限：最多幾項、每項最長幾字（擋掉用超長清單組出巨大 SQL 的請求） */
export const CSV_MAX_ITEMS = 60
export const CSV_MAX_ITEM_CHARS = 60

/** 解析逗號分隔的多選參數（超過上限的項目與過長的項目直接丟棄） */
export function parseCsv(params: URLSearchParams, key: string, maxItems = CSV_MAX_ITEMS): string[] {
  return (params.get(key) ?? '').split(',').map(s => s.trim())
    .filter(s => s && s.length <= CSV_MAX_ITEM_CHARS)
    .slice(0, maxItems)
}

/**
 * 共用 WHERE 條件建構器
 * 用於 /api/charts 和 /api/map，確保兩者套用相同篩選邏輯。
 *
 * @param params      URL search params
 * @param tableAlias  有 JOIN 時需傳入 transactions 的 alias（如 't'），避免欄位名稱衝突
 * @param skipDate    true 時不加日期條件（預售屋完整銷售期統計用）
 */
export function buildWhere(params: URLSearchParams, tableAlias = '', skipDate = false): string {
  const p = tableAlias ? `${tableAlias}.` : ''
  const conds: string[] = [`${p}unit_price_sqm > 0`, `${p}total_price > 0`]

  if (!skipDate) {
    const { fromDate, toDateExcl } = parseRocDateRange(params)
    conds.push(`${p}transaction_date >= '${fromDate}' AND ${p}transaction_date < '${toDateExcl}'`)
  }

  const districts = parseCsv(params, 'districts')
  if (districts.length > 0) {
    const list = districts.map(d => `'${escapeSqlString(d)}'`).join(',')
    conds.push(`${p}district IN (${list})`)
  }

  // 重劃區／生活圈：依路名規則比對地址（規則見 zones.ts），多選取聯集
  const zoneCond = zonesWhere(parseCsv(params, 'zones'), p)
  if (zoneCond) conds.push(zoneCond)

  const types = parseCsv(params, 'types')
  if (types.length > 0) {
    const typeConds = types.map(t => `TRIM(${p}building_type) LIKE '${escapeSqlString(t)}%'`)
    conds.push(`(${typeConds.join(' OR ')})`)
  }

  // 房數只收 0–9 的單一數字或 '5+'，其餘忽略（值會直接拼進 SQL）
  const rooms = parseCsv(params, 'rooms').filter(r => r === '5+' || /^\d$/.test(r))
  if (rooms.length > 0) {
    const roomConds = rooms.map(r => {
      if (r === '5+') return `${p}rooms >= 5`
      return `COALESCE(${p}rooms, 0) = ${Number(r)}`
    })
    conds.push(`(${roomConds.join(' OR ')})`)
  }

  const presale = params.get('presale') ?? 'all'
  if (presale === 'true')       conds.push(`${p}is_presale = true`)
  else if (presale === 'false') conds.push(`${p}is_presale = false`)

  // 屋齡只收 '30+' 或 1–3 位數字，其餘視同未篩選
  const rawAge = params.get('buildingAge') ?? 'all'
  const buildingAge = rawAge === '30+' || /^\d{1,3}$/.test(rawAge) ? rawAge : 'all'
  if (buildingAge !== 'all' && presale !== 'true') {
    const ageExpr   = `(EXTRACT(YEAR FROM ${p}transaction_date) - (CAST(LEFT(${p}completion_date, 3) AS INT) + 1911))`
    const ageFilter = `${p}completion_date IS NOT NULL AND LENGTH(${p}completion_date) >= 3 AND ${ageExpr} >= 0`
    const ageCond   = buildingAge === '30+'
      ? `${ageFilter} AND ${ageExpr} > 30`
      : `${ageFilter} AND ${ageExpr} <= ${Number(buildingAge)}`

    if (presale === 'all') {
      conds.push(`(${p}is_presale = true OR (${ageCond}))`)
    } else {
      conds.push(ageCond)
    }
  }

  return conds.join(' AND ')
}

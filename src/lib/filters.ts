/**
 * 共用篩選條件解析
 * 所有 API route 的日期區間、行政區、建物型態、房型、預售/成屋、屋齡
 * 解析邏輯集中在這裡，確保各 API 套用相同規則。
 */

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

/** 從 URL params 解析民國年月日期區間（預設 110/1 ～ 115/12） */
export function parseRocDateRange(
  params: URLSearchParams,
  keys: DateParamKeys = DEFAULT_DATE_KEYS
): RocDateRange {
  return rocDateRange(
    parseInt(params.get(keys.fromYear)  ?? '110'),
    parseInt(params.get(keys.fromMonth) ?? '1'),
    parseInt(params.get(keys.toYear)    ?? '115'),
    parseInt(params.get(keys.toMonth)   ?? '12'),
  )
}

/** 解析逗號分隔的多選參數 */
export function parseCsv(params: URLSearchParams, key: string): string[] {
  return (params.get(key) ?? '').split(',').map(s => s.trim()).filter(Boolean)
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

  const types = parseCsv(params, 'types')
  if (types.length > 0) {
    const typeConds = types.map(t => `TRIM(${p}building_type) LIKE '${escapeSqlString(t)}%'`)
    conds.push(`(${typeConds.join(' OR ')})`)
  }

  const rooms = parseCsv(params, 'rooms')
  if (rooms.length > 0) {
    const roomConds = rooms.map(r => {
      if (r === '5+') return `${p}rooms >= 5`
      return `COALESCE(${p}rooms, 0) = ${parseInt(r)}`
    })
    conds.push(`(${roomConds.join(' OR ')})`)
  }

  const presale = params.get('presale') ?? 'all'
  if (presale === 'true')       conds.push(`${p}is_presale = true`)
  else if (presale === 'false') conds.push(`${p}is_presale = false`)

  const buildingAge = params.get('buildingAge') ?? 'all'
  if (buildingAge !== 'all' && presale !== 'true') {
    const ageExpr   = `(EXTRACT(YEAR FROM ${p}transaction_date) - (CAST(LEFT(${p}completion_date, 3) AS INT) + 1911))`
    const ageFilter = `${p}completion_date IS NOT NULL AND LENGTH(${p}completion_date) >= 3 AND ${ageExpr} >= 0`
    const ageCond   = buildingAge === '30+'
      ? `${ageFilter} AND ${ageExpr} > 30`
      : `${ageFilter} AND ${ageExpr} <= ${parseInt(buildingAge)}`

    if (presale === 'all') {
      conds.push(`(${p}is_presale = true OR (${ageCond}))`)
    } else {
      conds.push(ageCond)
    }
  }

  return conds.join(' AND ')
}

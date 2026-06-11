/**
 * 數據分析查詢（/api/analysis 的時序序列）
 */
import { escapeSqlString } from '@/lib/filters'
import { cachedQuery } from './client'

export const METRIC_SQL: Record<string, string> = {
  unit_price:  `ROUND(AVG(unit_price_sqm * 3.3058 / 10000), 1)`,
  total_price: `ROUND(AVG(total_price / 10000), 0)`,
  area:        `ROUND(AVG(building_area_sqm * 0.3025), 1)`,
  parking:     `ROUND(AVG(CASE WHEN parking_price > 0 THEN parking_price / 10000.0 END), 1)`,
  count:       `COUNT(*)`,
  sales:       `ROUND(SUM(total_price) / 100000000.0, 2)`,
}

// 個別交易數值欄位運算式（用於最高 / 最低，需指出是哪一筆交易）
export const METRIC_COL: Record<string, string> = {
  unit_price:  `ROUND((unit_price_sqm * 3.3058 / 10000)::numeric, 1)`,
  total_price: `ROUND((total_price / 10000)::numeric, 0)`,
  area:        `ROUND((building_area_sqm * 0.3025)::numeric, 1)`,
  parking:     `ROUND((CASE WHEN parking_price > 0 THEN parking_price / 10000.0 END)::numeric, 1)`,
}

// 哪些指標支援「最高 / 最低」統計（需要有單筆交易數值可比較）
export const STAT_SUPPORTED = new Set(['unit_price', 'total_price', 'area', 'parking'])

export const PERIOD_SQL: Record<string, string> = {
  month:   `TO_CHAR(transaction_date, 'YYYY-MM')`,
  quarter: `TO_CHAR(DATE_TRUNC('quarter', transaction_date), 'YYYY') || 'Q' || EXTRACT(QUARTER FROM transaction_date)::int`,
  year:    `TO_CHAR(transaction_date, 'YYYY')`,
}

export interface ExtremeRecord {
  project_name: string | null
  address: string | null
  transaction_date: string | null
  is_presale: boolean | null
}

export interface SeriesRow {
  district: string
  period: string
  value: number
  record?: ExtremeRecord | null
}

/** 最高 / 最低統計：每個（行政區 × 期間）取極值那一筆交易 */
export async function fetchExtremeSeries(
  districts: string[],
  metric: string,
  granularity: string,
  stat: 'max' | 'min',
  extraConds: string[]
): Promise<SeriesRow[]> {
  const colExpr = METRIC_COL[metric]
  const periodExpr = PERIOD_SQL[granularity]
  const districtList = districts.map(d => `'${escapeSqlString(d)}'`).join(',')
  const order = stat === 'max' ? 'DESC' : 'ASC'

  const where = [
    `unit_price_sqm > 0`,
    `total_price > 0`,
    `district IN (${districtList})`,
    `${colExpr} IS NOT NULL`,
    ...extraConds,
  ].join(' AND ')

  const sql = `
    SELECT district, period, value, project_name, address, transaction_date, is_presale
    FROM (
      SELECT district, ${periodExpr} AS period, ${colExpr} AS value,
             project_name, address, transaction_date, is_presale,
             ROW_NUMBER() OVER (PARTITION BY district, ${periodExpr} ORDER BY ${colExpr} ${order}) AS rn
      FROM transactions
      WHERE ${where}
    ) t
    WHERE rn = 1
    ORDER BY period, district`

  let data: Record<string, unknown>[]
  try {
    data = await cachedQuery(sql)
  } catch (error) {
    console.error('[analysis-extreme]', error)
    return []
  }

  return data.map(r => ({
    district: String(r.district),
    period:   String(r.period),
    value:    Number(r.value) || 0,
    record: {
      project_name:     r.project_name != null ? String(r.project_name) : null,
      address:          r.address != null ? String(r.address) : null,
      transaction_date: r.transaction_date != null ? String(r.transaction_date) : null,
      is_presale:       typeof r.is_presale === 'boolean' ? r.is_presale : null,
    },
  }))
}

/** 平均統計：每個（行政區 × 期間）聚合一個值 */
export async function fetchSeries(
  districts: string[],
  metric: string,
  granularity: string,
  extraConds: string[]
): Promise<SeriesRow[]> {
  const metricExpr = METRIC_SQL[metric]
  const periodExpr = PERIOD_SQL[granularity]
  const districtList = districts.map(d => `'${escapeSqlString(d)}'`).join(',')

  const where = [
    `unit_price_sqm > 0`,
    `total_price > 0`,
    `district IN (${districtList})`,
    ...extraConds,
  ].join(' AND ')

  const sql = `
    SELECT district, ${periodExpr} AS period, ${metricExpr} AS value
    FROM transactions
    WHERE ${where}
    GROUP BY district, ${periodExpr}
    ORDER BY period, district`

  let data: Record<string, unknown>[]
  try {
    data = await cachedQuery(sql)
  } catch (error) {
    console.error('[analysis]', error)
    return []
  }

  return data.map(r => ({
    district: String(r.district),
    period:   String(r.period),
    value:    Number(r.value) || 0,
  }))
}

/** 未指定行政區時：依交易量取前 5 名行政區 */
export async function fetchTopDistricts(filterConds: string[]): Promise<string[]> {
  const sql = `
    SELECT district, COUNT(*) AS cnt
    FROM transactions
    WHERE unit_price_sqm > 0 AND total_price > 0
      AND ${filterConds.join(' AND ')}
      AND district IS NOT NULL
    GROUP BY district ORDER BY cnt DESC LIMIT 5`

  try {
    const data = await cachedQuery(sql)
    return data.map(r => String(r.district)).filter(Boolean)
  } catch {
    return []
  }
}

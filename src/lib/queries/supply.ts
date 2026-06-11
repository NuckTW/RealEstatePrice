/**
 * 市場供給面查詢（/api/supply）
 * 資料表 supply_permits / unsold_new_houses 由 scripts/fetch_tnh_opendata.py 抓取
 * 來源：台南市不動產開發公會開放資料（https://tnh.org.tw/open_gov.asp）
 */
import { cachedQuery, type Row } from './client'

/** 臺南市建照/使照月趨勢 */
export function fetchPermitTrend(): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      source_period,
      permit_type,
      permits,
      floor_area_m2::float  AS floor_area_m2,
      cost_thousand::float  AS cost_thousand
    FROM supply_permits
    WHERE city = '臺南市'
    ORDER BY period_date, permit_type
  `)
}

/** 全市待售新成屋季趨勢 */
export function fetchUnsoldTrend(): Promise<Row[]> {
  return cachedQuery(`
    SELECT source_period, unsold_units
    FROM unsold_new_houses
    WHERE district = '全區'
    ORDER BY period_date
  `)
}

/** 最新一季各行政區待售新成屋 */
export function fetchUnsoldByDistrict(): Promise<Row[]> {
  return cachedQuery(`
    SELECT source_period, district, unsold_units
    FROM unsold_new_houses
    WHERE source_period = (
        SELECT source_period FROM unsold_new_houses
        ORDER BY period_date DESC LIMIT 1
      )
      AND district != '全區'
    ORDER BY unsold_units DESC
  `)
}

/**
 * 實價登錄月成交量（供需對照疊圖用）
 * 2025-01-01 = 民國 11401，對齊建照/使照資料的最早可取得期別
 */
export function fetchMonthlyTxCount(): Promise<Row[]> {
  return cachedQuery(`
    SELECT TO_CHAR(transaction_date, 'YYYY-MM') AS month, COUNT(*)::int AS count
    FROM transactions
    WHERE transaction_date >= '2025-01-01'
      AND unit_price_sqm > 0 AND total_price > 0
    GROUP BY 1 ORDER BY 1
  `)
}

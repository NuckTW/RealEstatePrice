/**
 * KPI / 總覽統計查詢（/api/charts 的 KPI、行政區、建物型態、房型分布，/api/meta）
 */
import { cachedQuery, type Row } from './client'

/**
 * 全市 KPI。
 * 首頁 KPI 預設呈現中位數（不受少數豪宅、特殊交易拉高），平均數保留給卡片小字對照；
 * 每項附上實際納入計算的筆數（*_n），0 與 NULL 都不計入。
 */
export function fetchKpi(where: string): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      COUNT(*)::int                                                   AS total,
      ROUND((AVG(unit_price_sqm) * 3.3058 / 10000)::numeric, 1)      AS avg_unit_price,
      ROUND((AVG(NULLIF(building_area_sqm,0)) * 0.3025)::numeric, 1) AS avg_area,
      ROUND(AVG(total_price) / 10000)::int                           AS avg_total,
      -- 中位數（percentile_cont 會自動略過 NULL）
      ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(unit_price_sqm, 0)) * 3.3058 / 10000)::numeric, 1)
                                                                      AS median_unit_price,
      COUNT(NULLIF(unit_price_sqm, 0))::int                           AS unit_price_n,
      ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(building_area_sqm, 0)) * 0.3025)::numeric, 1)
                                                                      AS median_area,
      COUNT(NULLIF(building_area_sqm, 0))::int                        AS area_n,
      ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(total_price, 0)) / 10000)::numeric)::int
                                                                      AS median_total,
      COUNT(NULLIF(total_price, 0))::int                              AS total_price_n,
      -- 只計有拆出車位價的交易（NULLIF 讓 0 變 NULL，AVG 會自動略過）。
      -- 全庫僅約 44% 的交易有拆分車位價，其餘併入房價，故分母與上面幾項不同。
      ROUND(AVG(NULLIF(parking_price, 0)) / 10000)::int               AS avg_parking,
      ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(parking_price, 0)) / 10000)::numeric)::int
                                                                      AS median_parking,
      COUNT(*) FILTER (WHERE COALESCE(parking_price,0) > 0)::int      AS parking_count,
      ROUND(SUM(total_price) / 100000000)::int                       AS total_sales
    FROM transactions WHERE ${where}
  `)
}

/** 月度量價走勢（首頁 KPI 下方小圖）：每月成交筆數與中位單價 */
export function fetchMonthlyTrend(where: string): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      TO_CHAR(transaction_date, 'YYYY-MM')                            AS period,
      COUNT(*)::int                                                   AS count,
      ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(unit_price_sqm, 0)) * 3.3058 / 10000)::numeric, 1)
                                                                      AS median_unit_price
    FROM transactions
    WHERE ${where} AND transaction_date IS NOT NULL
    GROUP BY 1 ORDER BY 1
  `)
}

/** 行政區統計 */
export function fetchDistrictStats(where: string): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      district,
      COUNT(*)::int                                                   AS count,
      ROUND((AVG(unit_price_sqm) * 3.3058 / 10000)::numeric, 1)      AS unit_price,
      ROUND((AVG(NULLIF(building_area_sqm,0)) * 0.3025)::numeric, 1) AS area,
      ROUND(AVG(total_price) / 10000)::int                           AS avg_total,
      ROUND(SUM(total_price) / 100000000)::int                       AS sales
    FROM transactions
    WHERE ${where} AND district IS NOT NULL
    GROUP BY district ORDER BY count DESC
  `)
}

/** 建物型態分布 */
export function fetchBuildingTypeStats(where: string): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      TRIM(building_type)                AS type,
      COUNT(*)::int                      AS count,
      -- 與行政區排行、房型統計同口徑，先前只算了 count 與 sales
      ROUND((AVG(unit_price_sqm) * 3.3058 / 10000)::numeric, 1)      AS unit_price,
      ROUND((AVG(NULLIF(building_area_sqm,0)) * 0.3025)::numeric, 1) AS area,
      ROUND(AVG(total_price) / 10000)::int                           AS avg_total,
      ROUND(SUM(total_price)/100000000)::int AS sales
    FROM transactions
    WHERE ${where} AND building_type IS NOT NULL AND TRIM(building_type) != ''
    GROUP BY TRIM(building_type) ORDER BY count DESC LIMIT 10
  `)
}

/** 房型分布 */
export function fetchRoomStats(where: string): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      COALESCE(rooms, 0)                                              AS rooms,
      COUNT(*)::int                                                   AS count,
      ROUND((AVG(unit_price_sqm) * 3.3058 / 10000)::numeric, 1)      AS unit_price,
      ROUND((AVG(NULLIF(building_area_sqm,0)) * 0.3025)::numeric, 1) AS area,
      ROUND(AVG(total_price) / 10000)::int                           AS avg_total,
      ROUND(SUM(total_price) / 100000000)::int                       AS sales,
      ROUND(MIN(total_price) / 10000)::int                           AS min_price,
      ROUND(MAX(total_price) / 10000)::int                           AS max_price
    FROM transactions WHERE ${where}
    GROUP BY COALESCE(rooms, 0) ORDER BY rooms
  `)
}

/** 資料庫概況（最新交易日、總筆數） */
export function fetchMeta(): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      MAX(transaction_date)::text AS last_date,
      COUNT(*)::int               AS total
    FROM transactions
  `)
}

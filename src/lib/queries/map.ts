/**
 * 地圖標記查詢（/api/map）
 * 注意：熱力圖模式僅支援預售屋，不可擴展到成屋。
 */
import { cachedQuery, type Row } from './client'

/**
 * 預售屋標記：按 project_name 聚合，JOIN building_locations 取座標。
 * HAVING 過濾掉 36 個月內無交易的建案（僅顯示銷售中建案，Signal 1）。
 */
export function fetchPresaleMarkers(where: string): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      t.project_name                                          AS location_key,
      '預售'                                                   AS case_type,
      t.district,
      t.project_name                                          AS display_name,
      COUNT(*)::int                                           AS count,
      ROUND((AVG(t.unit_price_sqm)*3.3058/10000)::numeric,1) AS unit_price,
      ROUND(AVG(t.total_price)/10000)::int                   AS avg_total,
      bl.lat,
      bl.lon
    FROM transactions t
    JOIN building_locations bl
      ON bl.location_key = t.project_name
     AND bl.location_type = 'presale'
    WHERE ${where}
      AND t.is_presale = true
      AND t.project_name IS NOT NULL AND t.project_name != ''
      AND bl.lat IS NOT NULL
    GROUP BY t.project_name, t.district, bl.lat, bl.lon
    HAVING MAX(t.transaction_date) >= CURRENT_DATE - INTERVAL '36 months'
    ORDER BY count DESC
    LIMIT 2000
  `)
}

/** 成屋標記：按去樓層地址聚合，JOIN building_locations 取座標 */
export function fetchExistingMarkers(where: string): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      REGEXP_REPLACE(t.address, '[0-9零一二三四五六七八九十百千]+樓.*$', '') AS location_key,
      '成屋'                                                   AS case_type,
      t.district,
      REGEXP_REPLACE(t.address, '[0-9零一二三四五六七八九十百千]+樓.*$', '') AS display_name,
      COUNT(*)::int                                           AS count,
      ROUND((AVG(t.unit_price_sqm)*3.3058/10000)::numeric,1) AS unit_price,
      ROUND(AVG(t.total_price)/10000)::int                   AS avg_total,
      bl.lat,
      bl.lon
    FROM transactions t
    JOIN building_locations bl
      ON bl.location_key = REGEXP_REPLACE(t.address, '[0-9零一二三四五六七八九十百千]+樓.*$', '')
     AND bl.location_type = 'existing'
    WHERE ${where}
      AND t.is_presale = false
      AND t.address IS NOT NULL AND t.address != ''
      AND t.transaction_target LIKE '%建物%'
      AND bl.lat IS NOT NULL
    GROUP BY
      REGEXP_REPLACE(t.address, '[0-9零一二三四五六七八九十百千]+樓.*$', ''),
      t.district, bl.lat, bl.lon
    HAVING COUNT(*) >= 2
    ORDER BY count DESC
    LIMIT 3000
  `)
}

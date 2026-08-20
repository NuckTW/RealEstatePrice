/**
 * 地圖標記查詢（/api/map）
 * 注意：熱力圖模式僅支援預售屋，不可擴展到成屋。
 */
import { escapeSqlString } from '@/lib/filters'
import { cachedQuery, type Row } from './client'

/**
 * 預售屋標記：按 project_name 聚合，JOIN building_locations 取座標。
 * HAVING 過濾掉 36 個月內無交易的建案（僅顯示銷售中建案，Signal 1）。
 * s 子查詢統計「完整銷售期」的已售戶數與最新成交月（不受日期篩選影響），
 * 搭配 presale_projects 的核准總戶數算銷售成數，口徑與建案排行一致。
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
      pp.total_units                                          AS total_units,
      s.sold_total::int                                       AS sold_total,
      CASE WHEN pp.total_units > 0
        THEN ROUND(s.sold_total::numeric / pp.total_units * 100)::int
        ELSE NULL END                                         AS sales_ratio,
      TO_CHAR(s.last_tx, 'YYYY-MM')                           AS last_tx_month,
      bl.lat,
      bl.lon
    FROM transactions t
    JOIN building_locations bl
      ON bl.location_key = t.project_name
     AND bl.location_type = 'presale'
    LEFT JOIN (
      SELECT project_name, COUNT(*) AS sold_total, MAX(transaction_date) AS last_tx
      FROM transactions
      WHERE is_presale = true AND project_name IS NOT NULL AND project_name != ''
        AND unit_price_sqm > 0 AND total_price > 0
      GROUP BY project_name
    ) s ON s.project_name = t.project_name
    LEFT JOIN presale_projects pp ON pp.project_name = t.project_name
    WHERE ${where}
      AND t.is_presale = true
      AND t.project_name IS NOT NULL AND t.project_name != ''
      AND bl.lat IS NOT NULL
    GROUP BY t.project_name, t.district, bl.lat, bl.lon,
             pp.total_units, s.sold_total, s.last_tx
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
    ORDER BY count DESC
    LIMIT 3000
  `)
}

/**
 * 單一建案座標（/api/project-location，供「建案搜尋」頁地圖使用）
 * 只查預售（第一版範圍限定）。
 *
 * 比對刻意做成大小寫／前後空白不敏感：來源資料同一個建案會有異寫
 * （例如「禾震SUPER3」與「禾震Super3」），而 fetchProjectStats 是用
 * min(project_name) 挑一個寫法回傳，若這裡用完全相等比對，
 * 挑到的寫法一旦與 building_locations 記錄的不同就會查無座標。
 */
export function fetchProjectLocation(projectName: string): Promise<Row[]> {
  const safeName = escapeSqlString(projectName)
  return cachedQuery(`
    SELECT lat, lon
    FROM building_locations
    WHERE location_type = 'presale'
      AND lower(btrim(location_key)) = lower(btrim('${safeName}'))
    LIMIT 1
  `)
}

/**
 * 點位周邊行情查詢（/api/land-context，供 tainan-land-yield 土地開發評估使用）
 *
 * ⚠️ 這裡的 SQL 只拼接「已驗證、clamp 過的數字」，不接受任何字串參數。
 * 呼叫端（route.ts）負責驗證；本檔的 normalize() 再保險一次。
 *
 * 座標精度提醒：building_locations 的預售與成屋座標都是「路名級」
 * （Nominatim 查路名，同一條路共用一點），所以半徑篩選是以路段中心點為準。
 */
import { cachedQuery, type Row } from './client'

export interface LandContextParams {
  lat: number
  lon: number
  radius: number // 公尺
  months: number // 只看最近 N 個月
}

/** 成屋門牌去樓層（與 fetchExistingMarkers 相同口徑，對應 building_locations.location_key） */
const ADDR_KEY = `REGEXP_REPLACE(t.address, '[0-9零一二三四五六七八九十百千]+樓.*$', '')`

/** 再保險：確保拼進 SQL 的一定是有限數字，並固定小數位讓快取 key 穩定 */
function normalize(p: LandContextParams) {
  const lat = Number(p.lat)
  const lon = Number(p.lon)
  const radius = Math.round(Number(p.radius))
  const months = Math.round(Number(p.months))
  if (![lat, lon, radius, months].every(Number.isFinite)) {
    throw new Error('landContext: 參數不是有效數字')
  }
  return { lat: lat.toFixed(5), lon: lon.toFixed(5), radius, months }
}

/**
 * 產生「半徑內座標點」子查詢：先用 bbox 粗篩（1 度緯度 ≈ 111 km），再用 haversine 精算距離。
 * 回傳欄位：location_key, lat, lon, dist（公尺）
 */
function nearSql(p: ReturnType<typeof normalize>, locationType: 'presale' | 'existing'): string {
  const latNum = Number(p.lat)
  const dLat = (p.radius / 111_000).toFixed(6)
  const dLon = (p.radius / (111_000 * Math.cos((latNum * Math.PI) / 180))).toFixed(6)
  return `
    SELECT * FROM (
      SELECT
        bl.location_key, bl.lat, bl.lon,
        2 * 6371000 * ASIN(SQRT(
          POWER(SIN(RADIANS(bl.lat::float8 - ${p.lat}) / 2), 2)
          + COS(RADIANS(${p.lat})) * COS(RADIANS(bl.lat::float8))
            * POWER(SIN(RADIANS(bl.lon::float8 - ${p.lon}) / 2), 2)
        )) AS dist
      FROM building_locations bl
      WHERE bl.location_type = '${locationType}'
        AND bl.lat BETWEEN ${p.lat} - ${dLat} AND ${p.lat} + ${dLat}
        AND bl.lon BETWEEN ${p.lon} - ${dLon} AND ${p.lon} + ${dLon}
    ) x
    WHERE x.dist <= ${p.radius}`
}

/** transactions 最新交易日（資料截止日） */
export function fetchDataAsOf(): Promise<Row[]> {
  return cachedQuery(`SELECT MAX(transaction_date)::text AS data_as_of FROM transactions`)
}

/**
 * 周邊預售案：距離由近到遠，最多 10 案。
 * 聚合口徑同 fetchPresaleMarkers：單價／總價／坪數為「最近 N 個月」成交平均，
 * sold_total 與 sales_ratio 則看完整銷售期（不受 months 影響），
 * HAVING 排除 36 個月內無成交的建案。
 */
export function fetchNearbyPresale(params: LandContextParams): Promise<Row[]> {
  const p = normalize(params)
  return cachedQuery(`
    WITH near AS (${nearSql(p, 'presale')})
    SELECT
      t.project_name,
      t.district,
      ROUND(near.dist)::int                                   AS distance_m,
      near.lat, near.lon,
      ROUND((AVG(t.unit_price_sqm)*3.3058/10000)::numeric,1)  AS unit_price_wan_per_ping,
      ROUND(AVG(t.total_price)/10000)::int                    AS avg_total_wan,
      ROUND((AVG(NULLIF(t.building_area_sqm,0))*0.3025)::numeric,1) AS avg_area_ping,
      COUNT(*)::int                                           AS count,
      s.sold_total::int                                       AS sold_total,
      pp.total_units                                          AS total_units,
      CASE WHEN pp.total_units > 0
        THEN ROUND(s.sold_total::numeric / pp.total_units * 100)::int
        ELSE NULL END                                         AS sales_ratio,
      TO_CHAR(s.last_tx, 'YYYY-MM')                           AS last_tx_month,
      ARRAY_AGG(DISTINCT TRIM(t.building_type))
        FILTER (WHERE t.building_type IS NOT NULL AND TRIM(t.building_type) != '') AS building_types
    FROM near
    JOIN transactions t ON t.project_name = near.location_key
    LEFT JOIN (
      SELECT project_name, COUNT(*) AS sold_total, MAX(transaction_date) AS last_tx
      FROM transactions
      WHERE is_presale = true AND project_name IS NOT NULL AND project_name != ''
        AND unit_price_sqm > 0 AND total_price > 0
      GROUP BY project_name
    ) s ON s.project_name = t.project_name
    LEFT JOIN presale_projects pp ON pp.project_name = t.project_name
    WHERE t.is_presale = true
      AND t.unit_price_sqm > 0 AND t.total_price > 0
      AND t.transaction_date >= CURRENT_DATE - INTERVAL '${p.months} months'
    GROUP BY t.project_name, t.district, near.dist, near.lat, near.lon,
             pp.total_units, s.sold_total, s.last_tx
    HAVING MAX(t.transaction_date) >= CURRENT_DATE - INTERVAL '36 months'
    ORDER BY near.dist ASC
    LIMIT 10
  `)
}

/**
 * 半徑內成屋統計（is_presale=false、含建物）。
 * 用 GROUPING SETS 一次算出「各建物型態」與「全部合計」（is_total = 1 的那列）。
 */
export function fetchNearbyExisting(params: LandContextParams): Promise<Row[]> {
  const p = normalize(params)
  return cachedQuery(`
    WITH near AS (${nearSql(p, 'existing')})
    SELECT
      GROUPING(TRIM(t.building_type))::int AS is_total,
      TRIM(t.building_type)                AS building_type,
      COUNT(*)::int                        AS count,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY t.unit_price_sqm)*3.3058/10000)::numeric,1)
                                           AS median_unit_price_wan_per_ping,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY t.total_price)/10000)::numeric)::int
                                           AS median_total_wan
    FROM near
    JOIN transactions t ON ${ADDR_KEY} = near.location_key
    WHERE t.is_presale = false
      AND t.address IS NOT NULL AND t.address != ''
      AND t.transaction_target LIKE '%建物%'
      AND t.unit_price_sqm > 0 AND t.total_price > 0
      AND t.transaction_date >= CURRENT_DATE - INTERVAL '${p.months} months'
    GROUP BY GROUPING SETS ((TRIM(t.building_type)), ())
    ORDER BY is_total DESC, count DESC
  `)
}

/**
 * 半徑內交易登記的「都市土地使用分區」統計（預售＋成屋，只取非空值），依筆數排序。
 * 僅供參考線索：登記值是買賣申報時填的分區大類，不等於都市計畫圖的正式分區。
 */
export function fetchZoningHints(params: LandContextParams): Promise<Row[]> {
  const p = normalize(params)
  return cachedQuery(`
    WITH near_p AS (${nearSql(p, 'presale')}),
         near_e AS (${nearSql(p, 'existing')}),
    hits AS (
      SELECT TRIM(t.urban_land_use) AS urban_land_use, near_p.dist
      FROM near_p
      JOIN transactions t ON t.project_name = near_p.location_key
      WHERE t.is_presale = true
        AND t.transaction_date >= CURRENT_DATE - INTERVAL '${p.months} months'
      UNION ALL
      SELECT TRIM(t.urban_land_use) AS urban_land_use, near_e.dist
      FROM near_e
      JOIN transactions t ON ${ADDR_KEY} = near_e.location_key
      WHERE t.is_presale = false
        AND t.address IS NOT NULL AND t.address != ''
        AND t.transaction_date >= CURRENT_DATE - INTERVAL '${p.months} months'
    )
    SELECT urban_land_use, COUNT(*)::int AS count, ROUND(MIN(dist))::int AS nearest_m
    FROM hits
    WHERE urban_land_use IS NOT NULL AND urban_land_use != ''
    GROUP BY urban_land_use
    ORDER BY count DESC, nearest_m ASC
    LIMIT 20
  `)
}

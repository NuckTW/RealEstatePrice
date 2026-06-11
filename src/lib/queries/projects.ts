/**
 * 建案相關查詢（/api/charts 的建案排行、/api/case-detail 的交易明細）
 */
import { escapeSqlString, type RocDateRange } from '@/lib/filters'
import { cachedQuery, type Row } from './client'

/**
 * 建案排行（預售 + 成屋 UNION）
 * @param where        含日期的篩選條件
 * @param whereNoDate  不含日期的篩選條件（預售屋統計完整銷售期資料用）
 */
export function fetchCaseRanking(where: string, whereNoDate: string): Promise<Row[]> {
  return cachedQuery(`
    SELECT case_type, district, name, count,
           total_count, sales_ratio, common_ratio,
           unit_price, area, avg_total, sales, min_price, max_price
    FROM (
      -- 預售屋建案
      SELECT
        '預售' AS case_type,
        f.district, f.name, f.count,
        p.total_units AS total_count,
        CASE WHEN p.total_units IS NOT NULL
          THEN ROUND(f.count::numeric / NULLIF(p.total_units,0)*100)::int
          ELSE NULL END AS sales_ratio,
        f.common_ratio,
        f.unit_price, f.area, f.avg_total, f.sales, f.min_price, f.max_price
      FROM (
        -- 統計在日期範圍內有交易的建案的「完整」銷售資料（不限日期）
        SELECT district, project_name AS name, COUNT(*)::int AS count,
          ROUND((AVG(unit_price_sqm)*3.3058/10000)::numeric,1)        AS unit_price,
          ROUND((AVG(NULLIF(building_area_sqm,0))*0.3025)::numeric,1) AS area,
          ROUND(AVG(total_price)/10000)::int                          AS avg_total,
          ROUND(SUM(total_price)/100000000)::int                      AS sales,
          ROUND(MIN(total_price)/10000)::int                          AS min_price,
          ROUND(MAX(total_price)/10000)::int                          AS max_price,
          NULL::numeric                                                AS common_ratio
        FROM transactions
        WHERE is_presale = true
          AND project_name IS NOT NULL AND project_name != ''
          AND (${whereNoDate})
          AND project_name IN (
            -- 只取日期範圍內有銷售的建案
            SELECT DISTINCT project_name
            FROM transactions
            WHERE ${where} AND is_presale = true
              AND project_name IS NOT NULL AND project_name != ''
          )
        GROUP BY district, project_name
      ) f
      LEFT JOIN presale_projects p ON f.name = p.project_name

      UNION ALL

      -- 成屋（地址去掉樓層後分組，≥2 筆才顯示）
      SELECT
        '成屋' AS case_type,
        district,
        REGEXP_REPLACE(address,
          '[0-9零一二三四五六七八九十百千]+樓.*$', '') AS name,
        COUNT(*)::int AS count,
        NULL::int AS total_count,
        NULL::int AS sales_ratio,
        ROUND(AVG(
          CASE WHEN main_building_area_sqm > 0
                AND building_area_sqm > main_building_area_sqm
            THEN (building_area_sqm
                  - main_building_area_sqm
                  - COALESCE(auxiliary_building_area,0)
                  - COALESCE(balcony_area_sqm,0))
                 / NULLIF(building_area_sqm,0) * 100
            ELSE NULL END
        )::numeric, 1)                                              AS common_ratio,
        ROUND((AVG(unit_price_sqm)*3.3058/10000)::numeric,1)      AS unit_price,
        ROUND((AVG(NULLIF(building_area_sqm,0))*0.3025)::numeric,1) AS area,
        ROUND(AVG(total_price)/10000)::int                        AS avg_total,
        ROUND(SUM(total_price)/100000000)::int                    AS sales,
        ROUND(MIN(total_price)/10000)::int                        AS min_price,
        ROUND(MAX(total_price)/10000)::int                        AS max_price
      FROM transactions
      WHERE ${where} AND is_presale = false
        AND address IS NOT NULL AND address != ''
        AND transaction_target LIKE '%建物%'
      GROUP BY district,
        REGEXP_REPLACE(address, '[0-9零一二三四五六七八九十百千]+樓.*$', '')
      HAVING COUNT(*) >= 2
    ) combined
    ORDER BY count DESC LIMIT 500
  `)
}

const DETAIL_COLS = `
      transaction_date,
      floor,
      total_floors,
      COALESCE(rooms, 0)                                               AS rooms,
      ROUND((NULLIF(building_area_sqm,0) * 0.3025)::numeric, 1)       AS area,
      ROUND((unit_price_sqm * 3.3058 / 10000)::numeric, 1)            AS unit_price,
      ROUND(total_price / 10000)::int                                  AS total_price,
      CASE
        WHEN parking_type IS NULL OR parking_type = '' THEN 'x'
        WHEN COALESCE(parking_price, 0) = 0             THEN '含'
        ELSE ROUND(parking_price / 10000)::int::text
      END                                                              AS parking_price,
      unit_number,
      building_type,
      main_material,
      ROUND((NULLIF(main_building_area_sqm,0) * 0.3025)::numeric, 1)  AS main_area,
      ROUND((NULLIF(auxiliary_building_area,0) * 0.3025)::numeric, 1) AS aux_area,
      ROUND((NULLIF(balcony_area_sqm,0) * 0.3025)::numeric, 1)        AS balcony_area,
      ROUND((NULLIF(land_area_sqm,0) * 0.3025)::numeric, 1)           AS land_area,
      urban_land_use,
      parking_type,
      ROUND((NULLIF(parking_area_sqm,0) * 0.3025)::numeric, 2)        AS parking_area,
      bathrooms,
      living_rooms`

/**
 * 單一建案交易明細
 * 預售屋：建案只要在篩選範圍內有銷售記錄就顯示全部交易（不限日期），
 * 因為預售銷售期可能跨越使用者設定的範圍，顯示完整建案資料較有意義。
 */
export function fetchCaseDetail(opts: {
  caseType: string
  district: string
  name: string
  dateRange: RocDateRange
}): Promise<Row[]> {
  const safeName     = escapeSqlString(opts.name)
  const safeDistrict = escapeSqlString(opts.district)

  if (opts.caseType === 'presale') {
    return cachedQuery(`
      SELECT ${DETAIL_COLS}
      FROM transactions
      WHERE district = '${safeDistrict}'
        AND project_name = '${safeName}'
        AND is_presale = true
        AND unit_price_sqm > 0
      ORDER BY transaction_date DESC
      LIMIT 500
    `)
  }

  return cachedQuery(`
    SELECT ${DETAIL_COLS}
    FROM transactions
    WHERE district = '${safeDistrict}'
      AND REGEXP_REPLACE(address, '[0-9零一二三四五六七八九十百千]+樓.*$', '') = '${safeName}'
      AND is_presale = false
      AND address IS NOT NULL AND address != ''
      AND transaction_target LIKE '%建物%'
      AND transaction_date >= '${opts.dateRange.fromDate}'
      AND transaction_date < '${opts.dateRange.toDateExcl}'
      AND unit_price_sqm > 0
    ORDER BY transaction_date DESC
    LIMIT 200
  `)
}

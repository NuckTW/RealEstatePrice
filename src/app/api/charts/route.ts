import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildWhere } from '@/lib/queryBuilder'

async function runQuery(sql: string) {
  const { data, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql.trim() })
  if (error) throw error
  return (data as Record<string, unknown>[]) ?? []
}

type Row = Record<string, unknown>

function addPct(rows: Row[], total: number, key = 'count') {
  return rows.map(r => ({
    ...r,
    pct: total > 0 ? Math.round((Number(r[key]) / total) * 100) : 0,
  }))
}

export async function GET(req: NextRequest) {
  try {
    const where = buildWhere(req.nextUrl.searchParams)

    // 預售屋：不含日期的篩選條件（用於統計完整銷售期資料）
    const whereNoDate = buildWhere(req.nextUrl.searchParams, '', true)

    const [kpiRows, distRows, typeRows, roomRows, caseRows] = await Promise.all([

      runQuery(`
        SELECT
          COUNT(*)::int                                                   AS total,
          ROUND((AVG(unit_price_sqm) * 3.3058 / 10000)::numeric, 1)      AS avg_unit_price,
          ROUND((AVG(NULLIF(building_area_sqm,0)) * 0.3025)::numeric, 1) AS avg_area,
          ROUND(AVG(total_price) / 10000)::int                           AS avg_total,
          ROUND(SUM(total_price) / 100000000)::int                       AS total_sales
        FROM transactions WHERE ${where}
      `),

      runQuery(`
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
      `),

      runQuery(`
        SELECT
          TRIM(building_type)                AS type,
          COUNT(*)::int                      AS count,
          ROUND(SUM(total_price)/100000000)::int AS sales
        FROM transactions
        WHERE ${where} AND building_type IS NOT NULL AND TRIM(building_type) != ''
        GROUP BY TRIM(building_type) ORDER BY count DESC LIMIT 10
      `),

      runQuery(`
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
      `),

      runQuery(`
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
      `),
    ])

    const total = Number(kpiRows[0]?.total) || 1
    const typeTotal  = typeRows.reduce((s, r) => s + (Number(r.count) || 0), 0) || 1
    const roomsTotal = roomRows.reduce((s, r) => s + (Number(r.count) || 0), 0) || 1

    return NextResponse.json({
      kpi:       kpiRows[0] ?? {},
      districts: addPct(distRows, total),
      types:     addPct(typeRows, typeTotal),
      rooms:     addPct(roomRows, roomsTotal),
      cases:     caseRows,
    })
  } catch (err) {
    console.error('[/api/charts]', err)
    return NextResponse.json({ error: '資料查詢失敗' }, { status: 500 })
  }
}

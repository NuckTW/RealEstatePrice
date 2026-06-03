import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function runQuery(sql: string) {
  const { data, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql.trim() })
  if (error) throw error
  return (data as Record<string, unknown>[]) ?? []
}

function buildWhere(params: URLSearchParams): string {
  const conds: string[] = ['unit_price_sqm > 0', 'total_price > 0']

  const fromYear  = parseInt(params.get('dateFromYear')  ?? '110') + 1911
  const fromMonth = parseInt(params.get('dateFromMonth') ?? '1')
  const toYear    = parseInt(params.get('dateToYear')    ?? '115') + 1911
  const toMonth   = parseInt(params.get('dateToMonth')   ?? '12')

  const fromDate = `${fromYear}-${String(fromMonth).padStart(2,'0')}-01`
  // 結束月的下一月第一天，以 < 做篩選（含當月全部）
  const nextMonth = toMonth === 12 ? 1 : toMonth + 1
  const nextYear  = toMonth === 12 ? toYear + 1 : toYear
  const toDateExcl = `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`

  conds.push(`transaction_date >= '${fromDate}' AND transaction_date < '${toDateExcl}'`)

  const districts = (params.get('districts') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (districts.length > 0) {
    const list = districts.map(d => `'${d.replace(/'/g, "''")}'`).join(',')
    conds.push(`district IN (${list})`)
  }

  // 類型（多選，逗號分隔）
  const types = (params.get('types') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (types.length > 0) {
    const typeConds = types.map(t => {
      const safe = t.replace(/'/g, "''")
      return `TRIM(building_type) LIKE '${safe}%'`
    })
    conds.push(`(${typeConds.join(' OR ')})`)
  }

  // 房型（多選，逗號分隔）
  const rooms = (params.get('rooms') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (rooms.length > 0) {
    const roomConds = rooms.map(r => {
      if (r === '5+') return 'rooms >= 5'
      return `COALESCE(rooms, 0) = ${parseInt(r)}`
    })
    conds.push(`(${roomConds.join(' OR ')})`)
  }

  const presale = params.get('presale') ?? 'all'
  if (presale === 'true') conds.push('is_presale = true')
  else if (presale === 'false') conds.push('is_presale = false')

  const buildingAge = params.get('buildingAge') ?? 'all'
  if (buildingAge !== 'all' && presale !== 'true') {
    // completion_date 格式為 7碼民國日期，如 "1100315" = 民國110年03月15日
    const ageExpr = `(EXTRACT(YEAR FROM transaction_date) - (CAST(LEFT(completion_date, 3) AS INT) + 1911))`
    const ageFilter = `completion_date IS NOT NULL AND LENGTH(completion_date) >= 3 AND ${ageExpr} >= 0`
    const ageCond = buildingAge === '30+'
      ? `${ageFilter} AND ${ageExpr} > 30`
      : `${ageFilter} AND ${ageExpr} <= ${parseInt(buildingAge)}`

    if (presale === 'all') {
      // 成屋+預售屋：預售屋全部通過，成屋才套用屋齡篩選
      conds.push(`(is_presale = true OR (${ageCond}))`)
    } else {
      // 純成屋：直接套用
      conds.push(ageCond)
    }
  }

  return conds.join(' AND ')
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
            SELECT district, project_name AS name, COUNT(*)::int AS count,
              ROUND((AVG(unit_price_sqm)*3.3058/10000)::numeric,1)      AS unit_price,
              ROUND((AVG(NULLIF(building_area_sqm,0))*0.3025)::numeric,1) AS area,
              ROUND(AVG(total_price)/10000)::int                        AS avg_total,
              ROUND(SUM(total_price)/100000000)::int                    AS sales,
              ROUND(MIN(total_price)/10000)::int                        AS min_price,
              ROUND(MAX(total_price)/10000)::int                        AS max_price,
              NULL::numeric                                              AS common_ratio
            FROM transactions
            WHERE ${where} AND is_presale = true
              AND project_name IS NOT NULL AND project_name != ''
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

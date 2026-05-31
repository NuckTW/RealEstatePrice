import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function runQuery(sql: string) {
  const { data, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql.trim() })
  if (error) throw error
  return (data as Record<string, unknown>[]) ?? []
}

function buildWhere(params: URLSearchParams): string {
  const conds: string[] = ['unit_price_sqm > 0', 'total_price > 0']

  const months = parseInt(params.get('months') ?? '1')
  if (months > 0) {
    const cutoff = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)
    conds.push(`transaction_date >= '${cutoff}'`)
  }

  const districts = (params.get('districts') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (districts.length > 0) {
    const list = districts.map(d => `'${d.replace(/'/g, "''")}'`).join(',')
    conds.push(`district IN (${list})`)
  }

  const type = params.get('type') ?? ''
  if (type && type !== 'all') {
    conds.push(`TRIM(building_type) LIKE '${type.replace(/'/g, "''")}%'`)
  }

  const rooms = params.get('rooms') ?? ''
  if (rooms && rooms !== 'all') {
    if (rooms === '5+') conds.push('rooms >= 5')
    else conds.push(`COALESCE(rooms, 0) = ${parseInt(rooms)}`)
  }

  const presale = params.get('presale') ?? 'all'
  if (presale === 'true') conds.push('is_presale = true')
  else if (presale === 'false') conds.push('is_presale = false')

  const buildingAge = params.get('buildingAge') ?? 'all'
  if (buildingAge !== 'all' && presale === 'false') {
    // completion_date 格式為 7碼民國日期，如 "1100315" = 民國110年03月15日
    // 取前3碼為民國年，+1911 = 西元年
    const ageExpr = `(EXTRACT(YEAR FROM transaction_date) - (CAST(LEFT(completion_date, 3) AS INT) + 1911))`
    const ageFilter = `completion_date IS NOT NULL AND LENGTH(completion_date) >= 3 AND ${ageExpr} >= 0`
    if (buildingAge === '30+') {
      conds.push(`${ageFilter} AND ${ageExpr} > 30`)
    } else {
      const maxAge = parseInt(buildingAge)
      conds.push(`${ageFilter} AND ${ageExpr} <= ${maxAge}`)
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
        SELECT
          district,
          project_name                                                    AS name,
          COUNT(*)::int                                                   AS count,
          ROUND((AVG(unit_price_sqm) * 3.3058 / 10000)::numeric, 1)      AS unit_price,
          ROUND((AVG(NULLIF(building_area_sqm,0)) * 0.3025)::numeric, 1) AS area,
          ROUND(AVG(total_price) / 10000)::int                           AS avg_total,
          ROUND(SUM(total_price) / 100000000)::int                       AS sales,
          ROUND(MIN(total_price) / 10000)::int                           AS min_price,
          ROUND(MAX(total_price) / 10000)::int                           AS max_price
        FROM transactions
        WHERE ${where} AND is_presale = true
          AND project_name IS NOT NULL AND project_name != ''
        GROUP BY district, project_name ORDER BY count DESC LIMIT 500
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

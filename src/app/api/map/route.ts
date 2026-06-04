import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildWhere } from '@/lib/queryBuilder'

async function runQuery(sql: string) {
  const { data, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql.trim() })
  if (error) throw error
  return (data as Record<string, unknown>[]) ?? []
}

export async function GET(req: NextRequest) {
  const p       = req.nextUrl.searchParams
  const presale = p.get('presale') ?? 'all'
  const where   = buildWhere(p, 't')  // 'T' alias 避免與 building_locations.district 衝突

  try {
    // 預售屋：按 project_name 聚合，JOIN building_locations 取座標
    const presaleRows = presale !== 'false' ? await runQuery(`
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
      ORDER BY count DESC
      LIMIT 2000
    `) : []

    // 成屋：按去樓層地址聚合，JOIN building_locations 取座標
    const existingRows = presale !== 'true' ? await runQuery(`
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
    `) : []

    return NextResponse.json({
      markers: [...presaleRows, ...existingRows]
    })
  } catch (err) {
    console.error('[/api/map]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

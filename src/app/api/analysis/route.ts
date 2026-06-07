import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// 指標定義
const METRIC_SQL: Record<string, string> = {
  unit_price: `ROUND(AVG(unit_price_sqm * 3.3058 / 10000), 1)`,
  total_price: `ROUND(AVG(total_price / 10000), 0)`,
  area: `ROUND(AVG(building_area_sqm * 0.3025), 1)`,
  parking: `ROUND(AVG(CASE WHEN parking_price > 0 THEN parking_price / 10000.0 END), 1)`,
  count: `COUNT(*)`,
  sales: `ROUND(SUM(total_price) / 100000000.0, 2)`,
}

// 時間粒度格式
const PERIOD_SQL: Record<string, string> = {
  month:   `TO_CHAR(transaction_date, 'YYYY-MM')`,
  quarter: `TO_CHAR(DATE_TRUNC('quarter', transaction_date), 'YYYY') || 'Q' || EXTRACT(QUARTER FROM transaction_date)::int`,
  year:    `TO_CHAR(transaction_date, 'YYYY')`,
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams

  const metric      = p.get('metric')      ?? 'unit_price'
  const granularity = p.get('granularity') ?? 'quarter'
  const presale     = p.get('presale')     ?? 'all'
  const yearFrom    = parseInt(p.get('yearFrom') ?? '110') + 1911
  const yearTo      = parseInt(p.get('yearTo')   ?? '115') + 1911
  const rawDistricts = p.get('districts') ?? ''

  if (!METRIC_SQL[metric] || !PERIOD_SQL[granularity]) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }

  // 行政區清單：若未傳入，自動查前5大
  let districts: string[] = rawDistricts
    .split(',').map(s => s.trim()).filter(Boolean)

  if (!districts.length) {
    const topSql = `
      SELECT district, COUNT(*) AS cnt
      FROM transactions
      WHERE unit_price_sqm > 0 AND total_price > 0
        AND transaction_date >= '${yearFrom}-01-01'
        AND transaction_date < '${yearTo + 1}-01-01'
        AND district IS NOT NULL
      GROUP BY district
      ORDER BY cnt DESC
      LIMIT 5`

    const { data: topData } = await supabaseAdmin.rpc('execute_query', { query_text: topSql })
    districts = (Array.isArray(topData) ? topData : [])
      .map((r: Record<string, unknown>) => String(r.district))
      .filter(Boolean)
  }

  if (!districts.length) {
    return NextResponse.json({ periods: [], series: [] })
  }

  // WHERE 條件
  const conditions: string[] = [
    `unit_price_sqm > 0`,
    `total_price > 0`,
    `transaction_date >= '${yearFrom}-01-01'`,
    `transaction_date < '${yearTo + 1}-01-01'`,
    `district IN (${districts.map(d => `'${d.replace(/'/g, "''")}'`).join(',')})`,
  ]
  if (presale === 'true')  conditions.push(`is_presale = true`)
  if (presale === 'false') conditions.push(`is_presale = false`)

  // 主查詢
  const metricExpr  = METRIC_SQL[metric]
  const periodExpr  = PERIOD_SQL[granularity]
  const whereClause = conditions.join(' AND ')

  const sql = `
    SELECT
      district,
      ${periodExpr} AS period,
      ${metricExpr} AS value
    FROM transactions
    WHERE ${whereClause}
    GROUP BY district, ${periodExpr}
    ORDER BY period, district`

  const { data: raw, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql })

  if (error) {
    console.error('[analysis]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows: { district: string; period: string; value: number }[] =
    (Array.isArray(raw) ? raw : []).map((r: Record<string, unknown>) => ({
      district: String(r.district),
      period:   String(r.period),
      value:    Number(r.value) || 0,
    }))

  // 整理成 { periods, series } 格式
  const periodSet = Array.from(new Set(rows.map(r => r.period))).sort()
  const series = districts.map(district => ({
    district,
    data: periodSet.map(period => {
      const found = rows.find(r => r.district === district && r.period === period)
      return { period, value: found ? found.value : null }
    }),
  }))

  return NextResponse.json({ periods: periodSet, series, districts })
}

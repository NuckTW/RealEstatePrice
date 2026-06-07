import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const METRIC_SQL: Record<string, string> = {
  unit_price:  `ROUND(AVG(unit_price_sqm * 3.3058 / 10000), 1)`,
  total_price: `ROUND(AVG(total_price / 10000), 0)`,
  area:        `ROUND(AVG(building_area_sqm * 0.3025), 1)`,
  parking:     `ROUND(AVG(CASE WHEN parking_price > 0 THEN parking_price / 10000.0 END), 1)`,
  count:       `COUNT(*)`,
  sales:       `ROUND(SUM(total_price) / 100000000.0, 2)`,
}

const PERIOD_SQL: Record<string, string> = {
  month:   `TO_CHAR(transaction_date, 'YYYY-MM')`,
  quarter: `TO_CHAR(DATE_TRUNC('quarter', transaction_date), 'YYYY') || 'Q' || EXTRACT(QUARTER FROM transaction_date)::int`,
  year:    `TO_CHAR(transaction_date, 'YYYY')`,
}

async function queryOneSeries(
  districts: string[],
  metric: string,
  granularity: string,
  extraConds: string[]
): Promise<{ district: string; period: string; value: number }[]> {
  const metricExpr = METRIC_SQL[metric]
  const periodExpr = PERIOD_SQL[granularity]
  const districtList = districts.map(d => `'${d.replace(/'/g, "''")}'`).join(',')

  const where = [
    `unit_price_sqm > 0`,
    `total_price > 0`,
    `district IN (${districtList})`,
    ...extraConds,
  ].join(' AND ')

  const sql = `
    SELECT district, ${periodExpr} AS period, ${metricExpr} AS value
    FROM transactions
    WHERE ${where}
    GROUP BY district, ${periodExpr}
    ORDER BY period, district`.trim()

  const { data, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql })
  if (error) { console.error('[analysis]', error); return [] }

  return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    district: String(r.district),
    period:   String(r.period),
    value:    Number(r.value) || 0,
  }))
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams

  const metric      = p.get('metric')      ?? 'unit_price'
  const granularity = p.get('granularity') ?? 'quarter'
  const mode = p.get('mode') ?? 'all'  // 'all' | 'presale' | 'existing'
  const yearFrom    = parseInt(p.get('yearFrom')  ?? '110') + 1911
  const monthFrom   = parseInt(p.get('monthFrom') ?? '1')
  const yearTo      = parseInt(p.get('yearTo')    ?? '115') + 1911
  const monthTo     = parseInt(p.get('monthTo')   ?? '12')

  if (!METRIC_SQL[metric] || !PERIOD_SQL[granularity]) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }

  // 日期範圍 condition
  const dateFrom = `${yearFrom}-${String(monthFrom).padStart(2, '0')}-01`
  const nextM    = monthTo === 12 ? 1 : monthTo + 1
  const nextY    = monthTo === 12 ? yearTo + 1 : yearTo
  const dateTo   = `${nextY}-${String(nextM).padStart(2, '0')}-01`
  const dateCond = `transaction_date >= '${dateFrom}' AND transaction_date < '${dateTo}'`

  // 行政區清單
  let districts: string[] = (p.get('districts') ?? '').split(',').map(s => s.trim()).filter(Boolean)

  if (!districts.length) {
    const topSql = `
      SELECT district, COUNT(*) AS cnt
      FROM transactions
      WHERE unit_price_sqm > 0 AND total_price > 0
        AND ${dateCond}
        AND district IS NOT NULL
      GROUP BY district ORDER BY cnt DESC LIMIT 5`.trim()

    const { data: topData } = await supabaseAdmin.rpc('execute_query', { query_text: topSql })
    districts = (Array.isArray(topData) ? topData : [])
      .map((r: Record<string, unknown>) => String(r.district)).filter(Boolean)
  }

  if (!districts.length) return NextResponse.json({ periods: [], series: [], districts: [] })

  if (mode === 'presale' || mode === 'existing') {
    // ── 單一類型：只看預售 or 只看成屋 ─────────────────
    const cond = mode === 'presale' ? `is_presale = true` : `is_presale = false`
    const rows = await queryOneSeries(districts, metric, granularity, [dateCond, cond])
    const periodSet = Array.from(new Set(rows.map(r => r.period))).sort()
    const series = districts.map(district => ({
      district,
      data: periodSet.map(period => {
        const found = rows.find(r => r.district === district && r.period === period)
        return { period, value: found ? found.value : null }
      }),
    }))
    return NextResponse.json({ periods: periodSet, series, districts })

  } else if (mode === 'split') {
    // ── 分開模式：每區兩條線（預售 + 成屋） ─────────────
    const [presaleRows, existingRows] = await Promise.all([
      queryOneSeries(districts, metric, granularity, [dateCond, `is_presale = true`]),
      queryOneSeries(districts, metric, granularity, [dateCond, `is_presale = false`]),
    ])
    const allPeriods = Array.from(new Set([
      ...presaleRows.map(r => r.period),
      ...existingRows.map(r => r.period),
    ])).sort()
    const series = districts.flatMap(district => [
      {
        district: `${district}（預售）`,
        data: allPeriods.map(period => {
          const found = presaleRows.find(r => r.district === district && r.period === period)
          return { period, value: found ? found.value : null }
        }),
      },
      {
        district: `${district}（成屋）`,
        data: allPeriods.map(period => {
          const found = existingRows.find(r => r.district === district && r.period === period)
          return { period, value: found ? found.value : null }
        }),
      },
    ])
    return NextResponse.json({ periods: allPeriods, series, districts })

  } else {
    // ── 合計模式（預設） ─────────────────────────────────
    const rows = await queryOneSeries(districts, metric, granularity, [dateCond])
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
}

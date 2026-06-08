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

// 個別交易數值欄位運算式（用於最高 / 最低，需指出是哪一筆交易）
const METRIC_COL: Record<string, string> = {
  unit_price:  `ROUND((unit_price_sqm * 3.3058 / 10000)::numeric, 1)`,
  total_price: `ROUND((total_price / 10000)::numeric, 0)`,
  area:        `ROUND((building_area_sqm * 0.3025)::numeric, 1)`,
  parking:     `ROUND((CASE WHEN parking_price > 0 THEN parking_price / 10000.0 END)::numeric, 1)`,
}

// 哪些指標支援「最高 / 最低」統計（需要有單筆交易數值可比較）
const STAT_SUPPORTED = new Set(['unit_price', 'total_price', 'area', 'parking'])

const PERIOD_SQL: Record<string, string> = {
  month:   `TO_CHAR(transaction_date, 'YYYY-MM')`,
  quarter: `TO_CHAR(DATE_TRUNC('quarter', transaction_date), 'YYYY') || 'Q' || EXTRACT(QUARTER FROM transaction_date)::int`,
  year:    `TO_CHAR(transaction_date, 'YYYY')`,
}

interface ExtremeRow {
  district: string
  period: string
  value: number
  record: { project_name: string | null; address: string | null; transaction_date: string | null; is_presale: boolean | null }
}

async function queryExtremeSeries(
  districts: string[],
  metric: string,
  granularity: string,
  stat: 'max' | 'min',
  extraConds: string[]
): Promise<ExtremeRow[]> {
  const colExpr = METRIC_COL[metric]
  const periodExpr = PERIOD_SQL[granularity]
  const districtList = districts.map(d => `'${d.replace(/'/g, "''")}'`).join(',')
  const order = stat === 'max' ? 'DESC' : 'ASC'

  const where = [
    `unit_price_sqm > 0`,
    `total_price > 0`,
    `district IN (${districtList})`,
    `${colExpr} IS NOT NULL`,
    ...extraConds,
  ].join(' AND ')

  const sql = `
    SELECT district, period, value, project_name, address, transaction_date, is_presale
    FROM (
      SELECT district, ${periodExpr} AS period, ${colExpr} AS value,
             project_name, address, transaction_date, is_presale,
             ROW_NUMBER() OVER (PARTITION BY district, ${periodExpr} ORDER BY ${colExpr} ${order}) AS rn
      FROM transactions
      WHERE ${where}
    ) t
    WHERE rn = 1
    ORDER BY period, district`.trim()

  const { data, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql })
  if (error) { console.error('[analysis-extreme]', error); return [] }

  return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    district: String(r.district),
    period:   String(r.period),
    value:    Number(r.value) || 0,
    record: {
      project_name:     r.project_name != null ? String(r.project_name) : null,
      address:          r.address != null ? String(r.address) : null,
      transaction_date: r.transaction_date != null ? String(r.transaction_date) : null,
      is_presale:       typeof r.is_presale === 'boolean' ? r.is_presale : null,
    },
  }))
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

  // 統計方式：平均（預設）/ 最高 / 最低（僅特定指標支援，其餘自動回退為平均）
  const statParam = p.get('stat') ?? 'avg'
  const stat: 'avg' | 'max' | 'min' = (statParam === 'max' || statParam === 'min') ? statParam : 'avg'
  const useExtreme = stat !== 'avg' && STAT_SUPPORTED.has(metric)

  type Row = { district: string; period: string; value: number; record?: ExtremeRow['record'] | null }

  async function runSeries(extraConds: string[]): Promise<Row[]> {
    if (useExtreme) {
      const rows = await queryExtremeSeries(districts, metric, granularity, stat as 'max' | 'min', extraConds)
      return rows.map(r => ({ district: r.district, period: r.period, value: r.value, record: r.record }))
    }
    const rows = await queryOneSeries(districts, metric, granularity, extraConds)
    return rows.map(r => ({ district: r.district, period: r.period, value: r.value, record: null }))
  }

  function buildSeries(rows: Row[], periodSet: string[], names: string[]) {
    return names.map(district => ({
      district,
      data: periodSet.map(period => {
        const found = rows.find(r => r.district === district && r.period === period)
        return { period, value: found ? found.value : null, record: found?.record ?? null }
      }),
    }))
  }

  if (mode === 'presale' || mode === 'existing') {
    // ── 單一類型：只看預售 or 只看成屋 ─────────────────
    const cond = mode === 'presale' ? `is_presale = true` : `is_presale = false`
    const rows = await runSeries([dateCond, cond])
    const periodSet = Array.from(new Set(rows.map(r => r.period))).sort()
    const series = buildSeries(rows, periodSet, districts)
    return NextResponse.json({ periods: periodSet, series, districts, stat: useExtreme ? stat : 'avg' })

  } else if (mode === 'split') {
    // ── 分開模式：每區兩條線（預售 + 成屋） ─────────────
    const [presaleRows, existingRows] = await Promise.all([
      runSeries([dateCond, `is_presale = true`]),
      runSeries([dateCond, `is_presale = false`]),
    ])
    const allPeriods = Array.from(new Set([
      ...presaleRows.map(r => r.period),
      ...existingRows.map(r => r.period),
    ])).sort()
    const series = districts.flatMap(district => [
      { district: `${district}（預售）`, data: buildSeries(presaleRows, allPeriods, [district])[0].data },
      { district: `${district}（成屋）`, data: buildSeries(existingRows, allPeriods, [district])[0].data },
    ])
    return NextResponse.json({ periods: allPeriods, series, districts, stat: useExtreme ? stat : 'avg' })

  } else {
    // ── 合計模式（預設） ─────────────────────────────────
    const rows = await runSeries([dateCond])
    const periodSet = Array.from(new Set(rows.map(r => r.period))).sort()
    const series = buildSeries(rows, periodSet, districts)
    return NextResponse.json({ periods: periodSet, series, districts, stat: useExtreme ? stat : 'avg' })
  }
}

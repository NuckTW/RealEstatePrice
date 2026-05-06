import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 快取 6 小時（每個 URL 參數組合各自獨立快取）
export const revalidate = 21600

async function runQuery(sql: string) {
  const { data, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql })
  if (error) throw error
  return (data as Record<string, unknown>[]) ?? []
}

export async function GET(req: NextRequest) {
  try {
    const presale = req.nextUrl.searchParams.get('presale') ?? 'false'
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // 預售屋 / 成屋 / 全部 篩選條件
    const presaleFilter =
      presale === 'true'  ? 'AND is_presale = true'  :
      presale === 'false' ? 'AND is_presale = false'  : ''

    const baseFilter = `unit_price_sqm > 0 AND total_price > 0 ${presaleFilter}`

    const [yearlyData, monthlyData, buildingTypes] = await Promise.all([

      // 年度概況（2021 年起，PostgreSQL 做 GROUP BY）
      runQuery(`
        SELECT
          EXTRACT(YEAR FROM transaction_date)::int AS year,
          COUNT(*)::int                            AS total_transactions,
          ROUND(AVG(unit_price_sqm))::int          AS avg_unit_price,
          ROUND(AVG(total_price) / 10000)::int     AS avg_total_price_wan
        FROM transactions
        WHERE ${baseFilter}
          AND transaction_date >= '2021-01-01'
        GROUP BY year
        ORDER BY year
      `),

      // 行政區月統計（近 12 個月）
      runQuery(`
        SELECT
          district,
          TO_CHAR(transaction_date, 'YYYY-MM')   AS month,
          COUNT(*)::int                           AS transaction_count,
          ROUND(AVG(unit_price_sqm))::int         AS avg_unit_price,
          ROUND(AVG(total_price))::int            AS avg_total_price
        FROM transactions
        WHERE ${baseFilter}
          AND transaction_date >= '${cutoff}'
          AND district IS NOT NULL
        GROUP BY district, month
        ORDER BY month
      `),

      // 建物型態分佈（前 6 名）
      runQuery(`
        SELECT
          TRIM(building_type) AS name,
          COUNT(*)::int       AS value
        FROM transactions
        WHERE building_type IS NOT NULL AND TRIM(building_type) != ''
          ${presaleFilter}
        GROUP BY TRIM(building_type)
        ORDER BY value DESC
        LIMIT 6
      `),
    ])

    return NextResponse.json({ yearlyData, monthlyData, buildingTypes })
  } catch (err) {
    console.error('[/api/charts]', err)
    return NextResponse.json({ error: '資料查詢失敗' }, { status: 500 })
  }
}

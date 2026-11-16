import { NextRequest, NextResponse } from 'next/server'
import { buildWhere } from '@/lib/filters'
import { fetchMonthlyTrend } from '@/lib/queries/kpi'

/**
 * 月度量價走勢（首頁情報欄的小圖用）：只跑一支查詢，
 * 不必為了一張小圖去打 /api/charts（那支同時算 KPI、排行、分布共 6 個查詢）。
 * 篩選參數與 /api/charts、/api/map 相同。
 */
export async function GET(req: NextRequest) {
  try {
    const where = buildWhere(req.nextUrl.searchParams)
    const rows = await fetchMonthlyTrend(where)
    return NextResponse.json({
      trend: rows.map(r => ({
        period: String(r.period),
        count: Number(r.count) || 0,
        median_unit_price: r.median_unit_price != null ? Number(r.median_unit_price) : null,
      })),
    })
  } catch (err) {
    console.error('[/api/trend]', err)
    return NextResponse.json({ error: '資料查詢失敗' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { buildWhere } from '@/lib/filters'
import { fetchKpi, fetchDistrictStats, fetchBuildingTypeStats, fetchRoomStats } from '@/lib/queries/kpi'
import { fetchCaseRanking } from '@/lib/queries/projects'

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
      fetchKpi(where),
      fetchDistrictStats(where),
      fetchBuildingTypeStats(where),
      fetchRoomStats(where),
      fetchCaseRanking(where, whereNoDate),
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

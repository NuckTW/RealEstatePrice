import { NextRequest, NextResponse } from 'next/server'
import { fetchProjectLocation } from '@/lib/queries/map'

/**
 * 單一建案座標查詢（建案搜尋頁用）。
 * 第一版只做預售建案：預售交易有 project_name 可直接查，building_locations
 * 的預售座標也是建案級精度最可靠；成屋要靠門牌正規化，留待第二階段。
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') ?? ''
  if (!name) {
    return NextResponse.json({ lat: null, lon: null })
  }

  try {
    const rows = await fetchProjectLocation(name)
    const row = rows[0]
    const lat = row?.lat != null ? Number(row.lat) : null
    const lon = row?.lon != null ? Number(row.lon) : null
    return NextResponse.json({ lat, lon })
  } catch (err) {
    console.error('[/api/project-location]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

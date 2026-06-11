import { NextRequest, NextResponse } from 'next/server'
import { buildWhere } from '@/lib/filters'
import { fetchPresaleMarkers, fetchExistingMarkers } from '@/lib/queries/map'

export async function GET(req: NextRequest) {
  const p       = req.nextUrl.searchParams
  const presale = p.get('presale') ?? 'all'
  const where   = buildWhere(p, 't')  // 't' alias 避免與 building_locations.district 衝突

  try {
    const [presaleRows, existingRows] = await Promise.all([
      presale !== 'false' ? fetchPresaleMarkers(where) : [],
      presale !== 'true'  ? fetchExistingMarkers(where) : [],
    ])

    return NextResponse.json({
      markers: [...presaleRows, ...existingRows]
    })
  } catch (err) {
    console.error('[/api/map]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

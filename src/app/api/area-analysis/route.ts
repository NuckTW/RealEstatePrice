import { NextRequest, NextResponse } from 'next/server'
import { parseCsv } from '@/lib/filters'
import { fetchProjectStats, fetchProjectTrend, fetchProjectBuildingTypes, searchPresaleProjects } from '@/lib/queries/areaAnalysis'

const MAX_PROJECTS     = 200
const MAX_SEARCH_CHARS = 30

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  // 框選的建案清單最多 200 個；搜尋關鍵字最長 30 字（搜尋不走快取、是全表 ILIKE，不能放任超長字串）
  const projects = parseCsv(p, 'projects', MAX_PROJECTS)
  const search   = (p.get('search') ?? '').trim().slice(0, MAX_SEARCH_CHARS)

  try {
    if (search) {
      const results = await searchPresaleProjects(search)
      return NextResponse.json({ results })
    }

    if (!projects.length) return NextResponse.json({ stats: [], trend: [] })

    const [stats, trend, buildingTypes] = await Promise.all([
      fetchProjectStats(projects),
      fetchProjectTrend(projects),
      fetchProjectBuildingTypes(projects),
    ])
    return NextResponse.json({ stats, trend, buildingTypes })
  } catch (err) {
    console.error('[/api/area-analysis]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

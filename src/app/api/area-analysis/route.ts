import { NextRequest, NextResponse } from 'next/server'
import { fetchProjectStats, fetchProjectTrend, fetchProjectBuildingTypes, searchPresaleProjects } from '@/lib/queries/areaAnalysis'

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const projects = (p.get('projects') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const search   = p.get('search') ?? ''

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

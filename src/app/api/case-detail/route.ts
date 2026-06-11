import { NextRequest, NextResponse } from 'next/server'
import { parseRocDateRange } from '@/lib/filters'
import { fetchCaseDetail } from '@/lib/queries/projects'

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams

  try {
    const rows = await fetchCaseDetail({
      caseType:  p.get('case_type') ?? 'presale',   // 'presale' | 'existing'
      district:  p.get('district')  ?? '',
      name:      p.get('name')      ?? '',
      dateRange: parseRocDateRange(p),
    })
    return NextResponse.json({ rows })
  } catch (err) {
    console.error('[/api/case-detail]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

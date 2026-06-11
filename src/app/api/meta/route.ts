import { NextResponse } from 'next/server'
import { fetchMeta } from '@/lib/queries/kpi'

export async function GET() {
  try {
    const rows = await fetchMeta()
    const row = rows[0] ?? {}
    return NextResponse.json({ last_date: row.last_date ?? null, total: row.total ?? 0 })
  } catch {
    return NextResponse.json({ last_date: null, total: 0 })
  }
}

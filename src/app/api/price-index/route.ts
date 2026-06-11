import { NextRequest, NextResponse } from 'next/server'
import { parseCsv } from '@/lib/filters'
import { fetchIndexSeriesNames, fetchIndexSeries } from '@/lib/queries/priceIndex'

/** '11503' → '115/03' */
function ymLabel(ym: string): string {
  return `${ym.slice(0, -2)}/${ym.slice(-2)}`
}

interface Point {
  ym: string
  label: string
  value: number
  mom: number | null
  yoy: number | null
}

export async function GET(req: NextRequest) {
  try {
    const availableRows = await fetchIndexSeriesNames()
    const available = availableRows.map(r => String(r.series))

    let names = parseCsv(req.nextUrl.searchParams, 'series').filter(s => available.includes(s))
    if (!names.length) names = ['全市']

    const rows = await fetchIndexSeries(names)

    const byName = new Map<string, Point[]>(names.map(n => [n, []]))
    for (const r of rows) {
      byName.get(String(r.series))?.push({
        ym:    String(r.ym),
        label: ymLabel(String(r.ym)),
        value: Number(r.value),
        mom:   r.mom != null ? Number(r.mom) : null,
        yoy:   r.yoy != null ? Number(r.yoy) : null,
      })
    }
    const series = names.map(name => ({ name, points: byName.get(name) ?? [] }))

    // 摘要卡：以第一個選取的數列為準
    const first = series[0]?.points ?? []
    let summary = null
    if (first.length) {
      const latest = first[first.length - 1]
      const peak = first.reduce((a, b) => (b.value >= a.value ? b : a))
      summary = {
        name:      series[0].name,
        latest_ym: latest.ym,
        label:     latest.label,
        value:     latest.value,
        mom:       latest.mom,
        yoy:       latest.yoy,
        peak:      { ym: peak.ym, label: peak.label, value: peak.value },
        drawdown:  peak.value > 0 ? Math.round((latest.value / peak.value - 1) * 10000) / 100 : null,
      }
    }

    return NextResponse.json({ available, series, summary })
  } catch (err) {
    console.error('[/api/price-index]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

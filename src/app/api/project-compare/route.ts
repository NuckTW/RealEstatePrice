import { NextResponse } from 'next/server'
import { fetchProjectStats } from '@/lib/queries/projectCompare'

/** 低於此筆數的中位數等同少數幾筆的算術結果，前端會標示為僅供參考 */
export const MIN_RELIABLE_TX = 10

export interface ProjectPoint {
  key: string
  name: string
  district: string
  buildingType: string
  txCount: number
  reliable: boolean
  priceMedian: number
  priceP25: number | null
  priceP75: number | null
  areaMedian: number
  totalMedian: number
  firstTx: string
  lastTx: string
}

export async function GET() {
  try {
    const rows = await fetchProjectStats()

    const projects: ProjectPoint[] = rows
      .map(r => ({
        key:          String(r.key),
        name:         String(r.name),
        district:     String(r.district ?? ''),
        buildingType: String(r.building_type ?? ''),
        txCount:      Number(r.tx_count),
        reliable:     Number(r.tx_count) >= MIN_RELIABLE_TX,
        priceMedian:  Number(r.price_median),
        priceP25:     r.price_p25 != null ? Number(r.price_p25) : null,
        priceP75:     r.price_p75 != null ? Number(r.price_p75) : null,
        areaMedian:   Number(r.area_median),
        totalMedian:  Number(r.total_median),
        firstTx:      String(r.first_tx ?? ''),
        lastTx:       String(r.last_tx ?? ''),
      }))
      // 面積或單價缺失者無法定位，直接排除而非畫在原點誤導
      .filter(p => p.areaMedian > 0 && p.priceMedian > 0)
      .sort((a, b) => b.txCount - a.txCount)

    const districts = [...new Set(projects.map(p => p.district).filter(Boolean))].sort()

    return NextResponse.json({ projects, districts, minReliableTx: MIN_RELIABLE_TX })
  } catch (err) {
    console.error('[/api/project-compare]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { fetchPresaleProjectProfiles } from '@/lib/queries/potentialBuyers'

/** 客源分析：預售建案清單（座標＋產品條件中位數），1 小時快取 */
export async function GET() {
  try {
    const rows = await fetchPresaleProjectProfiles()
    return NextResponse.json({
      projects: rows.map(r => ({
        name: String(r.name), district: String(r.district), n: Number(r.n),
        firstDate: String(r.first_date), lastDate: String(r.last_date),
        priceWan: Number(r.price_wan),     // 總價中位數（萬，不含車位）
        ping: Number(r.ping),              // 坪數中位數（不含車位）
        rooms: Number(r.rooms),            // 房數中位數
        smallShare: Number(r.small_share), // 2 房以下成交占比
        unitWan: Number(r.unit_wan),       // 單價中位數（萬／坪）
        lat: Number(r.lat), lon: Number(r.lon),
      })),
    })
  } catch (err) {
    console.error('[/api/potential-buyers/projects]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

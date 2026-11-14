import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchDataAsOf,
  fetchNearbyExisting,
  fetchNearbyPresale,
  fetchZoningHints,
} from '@/lib/queries/landContext'

/**
 * 點位周邊行情（唯讀），供 tainan-land-yield 伺服器端代理呼叫。
 * GET /api/land-context?lat=23.0263&lon=120.2311&radius=800&months=24
 *
 * - lat/lon 必填，限台南範圍，超出回 400
 * - radius（公尺）預設 800，clamp 到 100–3000；months 預設 24，clamp 到 6–120
 * - 若設定環境變數 LAND_CONTEXT_KEY，需帶相符的 x-api-key header，否則 401
 */

// 台南市大致範圍（WGS84）
const LAT_MIN = 22.8, LAT_MAX = 23.5
const LON_MIN = 119.9, LON_MAX = 120.8

const PRECISION =
  '預售與成屋皆為路名級座標（以路名 geocode，同一條路共用一點）；預售每案對應其所在路段，非建案精確位置'

/** 解析數字參數：缺漏或非數字用預設值，再 clamp 到範圍內並取整數 */
function clampInt(raw: string | null, def: number, min: number, max: number): number {
  const n = raw == null || raw.trim() === '' ? NaN : Number(raw)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** 常數時間比對 API key，避免 timing attack */
function keyMatches(given: string | null, expected: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))

export async function GET(req: NextRequest) {
  // 選配的 API key 驗證：未設定環境變數則公開
  const expectedKey = process.env.LAND_CONTEXT_KEY
  if (expectedKey && !keyMatches(req.headers.get('x-api-key'), expectedKey)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const latRaw = sp.get('lat')
  const lonRaw = sp.get('lon')
  const lat = latRaw == null || latRaw.trim() === '' ? NaN : Number(latRaw)
  const lon = lonRaw == null || lonRaw.trim() === '' ? NaN : Number(lonRaw)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat、lon 為必填數字' }, { status: 400 })
  }
  if (lat < LAT_MIN || lat > LAT_MAX || lon < LON_MIN || lon > LON_MAX) {
    return NextResponse.json({ error: '座標超出台南範圍' }, { status: 400 })
  }

  // 座標取到小數 5 位（約 1 公尺），讓相近點擊能命中同一份快取
  const params = {
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
    radius: clampInt(sp.get('radius'), 800, 100, 3000),
    months: clampInt(sp.get('months'), 24, 6, 120),
  }

  try {
    const [asOfRows, presaleRows, existingRows, zoningRows] = await Promise.all([
      fetchDataAsOf(),
      fetchNearbyPresale(params),
      fetchNearbyExisting(params),
      fetchZoningHints(params),
    ])

    // 成屋：is_total = 1 那列是全部合計，其餘為各建物型態
    const total = existingRows.find(r => Number(r.is_total) === 1)
    const byType = existingRows
      .filter(r => Number(r.is_total) !== 1)
      .map(r => ({
        building_type: (r.building_type as string | null) || '未分類',
        count: Number(r.count),
        median_unit_price_wan_per_ping: num(r.median_unit_price_wan_per_ping),
        median_total_wan: num(r.median_total_wan),
      }))

    return NextResponse.json({
      center: { lat: params.lat, lon: params.lon },
      radius_m: params.radius,
      months: params.months,
      data_as_of: (asOfRows[0]?.data_as_of as string | null) ?? null,
      precision: PRECISION,
      presale: presaleRows.map(r => ({
        project_name: r.project_name,
        district: r.district,
        distance_m: Number(r.distance_m),
        lat: num(r.lat),
        lon: num(r.lon),
        unit_price_wan_per_ping: num(r.unit_price_wan_per_ping),
        avg_total_wan: num(r.avg_total_wan),
        avg_area_ping: num(r.avg_area_ping),
        count: Number(r.count),            // 最近 N 個月成交筆數
        sold_total: num(r.sold_total),     // 完整銷售期已售戶數（sales_ratio 的分子）
        total_units: num(r.total_units),
        sales_ratio: num(r.sales_ratio),
        last_tx_month: r.last_tx_month ?? null,
        building_types: (r.building_types as string[] | null) ?? [],
      })),
      existing: {
        count: total ? Number(total.count) : 0,
        median_unit_price_wan_per_ping: total ? num(total.median_unit_price_wan_per_ping) : null,
        by_type: byType,
      },
      // 只有土地的交易目前未入庫（scraper 匯入時只保留含「建物」的交易標的），固定回 null
      land: null,
      zoning_hints: zoningRows.map(r => ({
        urban_land_use: r.urban_land_use,
        count: Number(r.count),
        nearest_m: Number(r.nearest_m),
      })),
    })
  } catch (err) {
    console.error('[/api/land-context]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

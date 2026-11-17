/** /api/map 回傳的一筆標記：預售按建案、成屋按去樓層地址聚合（座標為路名級） */
export interface MapMarker {
  location_key: string
  case_type: '預售' | '成屋'
  district: string
  display_name: string
  count: number
  unit_price: number
  avg_total: number
  avg_area?: number | null
  lat: number
  lon: number
  total_units?: number | null
  sold_total?: number | null
  sales_ratio?: number | null
  last_tx_month?: string | null
  /** 篩選期間內最新成交日 'YYYY-MM-DD'（情報欄依日期排序用） */
  last_tx_date?: string | null
}

/** 情報欄目前顯示的內容 */
export type Selection =
  | { kind: 'viewport' }
  | { kind: 'group'; title: string; keys: string[] }
  | { kind: 'project'; key: string; from?: Selection }
  | { kind: 'area'; shape: 'box'; bounds: [[number, number], [number, number]] }
  | { kind: 'area'; shape: 'point'; center: [number, number] }

/** 地圖工具 */
export type MapTool = 'none' | 'box' | 'point'

/** 落點半徑選項（公尺）：座標只到路段級，下限 800m */
export const POINT_RADII = [800, 1000, 1500, 2000] as const

/** 同一座標的標記 key（路名級座標，同一條路會共用一點） */
export function coordKey(m: Pick<MapMarker, 'lat' | 'lon'>): string {
  return `${m.lat.toFixed(5)},${m.lon.toFixed(5)}`
}

/**
 * 依成交筆數加權的中位單價：每個標記本身是一個建案的平均單價，
 * 用筆數加權比較接近「交易層級」的中位數，避免只賣 2 戶的案跟賣 300 戶的案同權重。
 */
export function weightedMedianPrice(markers: MapMarker[]): number | null {
  const v = markers.filter(m => m.unit_price > 0).map(m => ({ p: m.unit_price, w: Math.max(1, m.count) }))
  if (!v.length) return null
  v.sort((a, b) => a.p - b.p)
  const total = v.reduce((s, x) => s + x.w, 0)
  let acc = 0
  for (const x of v) {
    acc += x.w
    if (acc >= total / 2) return x.p
  }
  return v[v.length - 1].p
}

/** 一組標記的摘要（情報欄 KPI） */
export function summarize(markers: MapMarker[]) {
  const presale = markers.filter(m => m.case_type === '預售')
  const txCount = markers.reduce((s, m) => s + (m.count || 0), 0)
  const ratios = presale.map(m => m.sales_ratio).filter((r): r is number => r != null)
  return {
    places: markers.length,
    presaleCount: presale.length,
    txCount,
    medianPrice: weightedMedianPrice(markers),
    avgSalesRatio: ratios.length ? Math.round(ratios.reduce((s, r) => s + r, 0) / ratios.length) : null,
  }
}

/** 兩點距離（公尺，haversine） */
export function distanceMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface Bounds { south: number; west: number; north: number; east: number }

export function inBounds(m: Pick<MapMarker, 'lat' | 'lon'>, b: Bounds): boolean {
  return m.lat >= b.south && m.lat <= b.north && m.lon >= b.west && m.lon <= b.east
}

/** 'YYYY-MM-DD' → '115/05/21' */
export function rocDate(ymd?: string | null): string {
  if (!ymd || ymd.length < 10) return ''
  return `${rocMonth(ymd)}/${ymd.slice(8, 10)}`
}

/** 'YYYY-MM' → '115/05' */
export function rocMonth(ym?: string | null): string {
  if (!ym || ym.length < 7) return ''
  return `${parseInt(ym.slice(0, 4)) - 1911}/${ym.slice(5, 7)}`
}

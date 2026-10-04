/**
 * 客源分析（Huff／重力模型的簡化版）
 *
 * 給一個位置（建案或地圖上任一點）與產品條件，估計各村里是潛在客源的相對可能性：
 *   村里客源分數 = 距離衰減 × 負擔能力 × Σ_客群 [ 客群比重 × 目標年齡人口 × 指數係數 ]
 *     - 客群：首購（25–34 歲、首購指數）＋換屋（35–44 歲；預售／新成屋用換新屋指數、成屋用換二手指數）
 *     - 距離衰減：0.5 ^ (直線距離 ÷ 減半距離)；減半距離為假設值（無買方戶籍資料可校準），前端提供滑桿
 *     - 指數係數：0.5 + 指數 ÷ 100（指數 0 → 0.5 倍、100 → 1.5 倍），避免指數把人口效果完全蓋掉
 *     - 負擔能力：年房貸 ÷ 里所得中位數 ≤ 50% → 1；≥ 100% → 0.15；中間線性
 *   客源占比 = 村里分數 ÷ 全市分數總和
 * ⚠️ 這是「相對可能性」的推估，不是實際買方來源統計
 */
import type { VillageGeo } from '@/components/VillageChoroplethMap'
import type { Village } from './buyerIndex'

export type ProductType = 'presale' | 'resale'

export interface Site { lat: number; lon: number; label: string }
export interface Product {
  priceWan: number      // 總價（萬，不含車位）
  rooms: number
  type: ProductType     // presale = 預售／新成屋，resale = 成屋（二手）
}
export interface CatchmentParams {
  halfKm: number        // 距離減半（公里）
  fbShare: number       // 首購比重 0–1（其餘為換屋）
  ratePct: number       // 房貸利率（%）
  ltv: number           // 貸款成數
  years: number         // 貸款年限
}

export interface CatchmentRow {
  code: string
  district: string
  village: string
  distKm: number
  fbPop: number         // 25–34 歲人口
  upPop: number         // 35–44 歲人口
  fbIdx: number
  upIdx: number
  burden: number | null // 年房貸 ÷ 所得中位數
  affordF: number
  decay: number
  score: number
  share: number         // 客源占比（0–1）
  cum: number           // 依占比排序後的累計占比
  lowConfidence: boolean
}

export interface CatchmentResult {
  rows: CatchmentRow[]                                   // 依占比由高到低
  districts: { district: string; share: number; distKm: number }[]
  annualWan: number                                      // 年房貸（萬）
  radius80: number | null                                // 由近到遠累計到 80% 客源的距離
  fbPart: number                                         // 首購客群占總分比例
  jobs: { district: string; employees: number; weighted: number; distKm: number }[]
}

/* ── 幾何 ─────────────────────────────────────────────────────── */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371, toRad = Math.PI / 180
  const dLat = (bLat - aLat) * toRad, dLon = (bLon - aLon) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 多邊形外環的面積加權中心（鞋帶公式）；MultiPolygon 取面積最大的一塊 */
function ringCentroid(ring: number[][]): { lat: number; lon: number; area: number } {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j], [x1, y1] = ring[i]
    const f = x0 * y1 - x1 * y0
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f
  }
  if (Math.abs(a) < 1e-12) {
    const n = ring.length
    return { lon: ring.reduce((s, p) => s + p[0], 0) / n, lat: ring.reduce((s, p) => s + p[1], 0) / n, area: 0 }
  }
  return { lon: cx / (3 * a), lat: cy / (3 * a), area: Math.abs(a / 2) }
}

export function villageCentroids(geo: VillageGeo): Map<string, { lat: number; lon: number }> {
  const out = new Map<string, { lat: number; lon: number }>()
  for (const f of geo.features) {
    const g = f.geometry
    const polys: number[][][][] = g.type === 'Polygon' ? [g.coordinates as number[][][]]
      : g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]) : []
    let best: { lat: number; lon: number; area: number } | null = null
    for (const p of polys) {
      const c = ringCentroid(p[0])
      if (!best || c.area > best.area) best = c
    }
    if (best) out.set(f.properties.code, { lat: best.lat, lon: best.lon })
  }
  return out
}

/* ── 參數 ─────────────────────────────────────────────────────── */
/** 預設首購比重：全是 2 房以下 → 85%；全是 3 房以上 → 25% */
export function defaultFbShare(smallShare: number): number {
  return Math.min(0.9, Math.max(0.1, 0.25 + 0.6 * smallShare))
}

/** 年房貸（萬）：本息平均攤還 */
export function annualPaymentWan(priceWan: number, p: Pick<CatchmentParams, 'ratePct' | 'ltv' | 'years'>): number {
  const loan = priceWan * p.ltv
  const r = p.ratePct / 100 / 12, n = p.years * 12
  const monthly = r > 0 ? loan * r / (1 - (1 + r) ** -n) : loan / n
  return monthly * 12
}

function affordFactor(burden: number | null): number {
  if (burden == null) return 0.7                    // 沒有所得資料：給中間偏保守的值
  if (burden <= 0.5) return 1
  if (burden >= 1) return 0.15
  return 1 - (burden - 0.5) / 0.5 * 0.85
}

/* ── 主計算 ───────────────────────────────────────────────────── */
export function computeCatchment(args: {
  villages: Village[]
  centroids: Map<string, { lat: number; lon: number }>
  site: Site
  product: Product
  params: CatchmentParams
  /** 三個預設指數（前端計算值） */
  scores: { firstBuyer: Map<string, number>; newHome: Map<string, number>; resale: Map<string, number> }
  /** 行政區從業員工（普查），算就業地客源 */
  employeesByDistrict?: Map<string, number>
}): CatchmentResult {
  const { villages, centroids, site, product, params, scores } = args
  const annualWan = annualPaymentWan(product.priceWan, params)
  const upScores = product.type === 'presale' ? scores.newHome : scores.resale
  const fbShare = Math.min(1, Math.max(0, params.fbShare))

  let total = 0, fbTotal = 0
  const raw: Omit<CatchmentRow, 'share' | 'cum'>[] = []
  for (const v of villages) {
    const c = centroids.get(v.code)
    if (!c) continue
    const distKm = haversineKm(site.lat, site.lon, c.lat, c.lon)
    const decay = 0.5 ** (distKm / Math.max(0.5, params.halfKm))
    const pop = v.raw.pop ?? 0
    const fbPop = (v.raw.share2534 ?? 0) * pop / 100
    const upPop = (v.raw.share3544 ?? 0) * pop / 100
    const fbIdx = scores.firstBuyer.get(v.code) ?? 50
    const upIdx = upScores.get(v.code) ?? 50
    // 所得中位數單位為千元／年 → 萬元／年 = ÷ 10
    const burden = v.raw.income ? annualWan / (v.raw.income / 10) : null
    const affordF = affordFactor(burden)
    const fbPart = fbShare * fbPop * (0.5 + fbIdx / 100)
    const upPart = (1 - fbShare) * upPop * (0.5 + upIdx / 100)
    const score = decay * affordF * (fbPart + upPart)
    total += score
    fbTotal += decay * affordF * fbPart
    raw.push({ code: v.code, district: v.district, village: v.village, distKm, fbPop, upPop, fbIdx, upIdx, burden, affordF, decay, score, lowConfidence: v.lowConfidence })
  }

  const rows: CatchmentRow[] = raw
    .map(r => ({ ...r, share: total ? r.score / total : 0, cum: 0 }))
    .sort((a, b) => b.share - a.share)
  let cum = 0
  for (const r of rows) { cum += r.share; r.cum = cum }

  // 由近到遠累計到 80% 的距離
  let acc = 0, radius80: number | null = null
  for (const r of [...rows].sort((a, b) => a.distKm - b.distKm)) {
    acc += r.share
    if (acc >= 0.8) { radius80 = r.distKm; break }
  }

  // 行政區彙總（距離取分數加權平均）
  const dm = new Map<string, { share: number; dw: number }>()
  for (const r of rows) {
    const d = dm.get(r.district) ?? { share: 0, dw: 0 }
    d.share += r.share; d.dw += r.share * r.distKm
    dm.set(r.district, d)
  }
  const districts = [...dm.entries()]
    .map(([district, d]) => ({ district, share: d.share, distKm: d.share ? d.dw / d.share : 0 }))
    .sort((a, b) => b.share - a.share)

  // 就業地客源：在附近工作的人（不論住在哪），以行政區人口重心算距離
  const jobs: CatchmentResult['jobs'] = []
  if (args.employeesByDistrict) {
    const center = new Map<string, { lat: number; lon: number; w: number }>()
    for (const v of villages) {
      const c = centroids.get(v.code); if (!c) continue
      const w = v.raw.pop ?? 0
      const m = center.get(v.district) ?? { lat: 0, lon: 0, w: 0 }
      m.lat += c.lat * w; m.lon += c.lon * w; m.w += w
      center.set(v.district, m)
    }
    for (const [district, employees] of args.employeesByDistrict) {
      const m = center.get(district); if (!m || !m.w) continue
      const distKm = haversineKm(site.lat, site.lon, m.lat / m.w, m.lon / m.w)
      jobs.push({ district, employees, distKm, weighted: employees * 0.5 ** (distKm / Math.max(0.5, params.halfKm)) })
    }
    jobs.sort((a, b) => b.weighted - a.weighted)
  }

  return { rows, districts, annualWan, radius80, fbPart: total ? fbTotal / total : fbShare, jobs: jobs.slice(0, 6) }
}

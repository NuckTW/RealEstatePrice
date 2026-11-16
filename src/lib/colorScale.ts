/**
 * 價格色階（資料色）
 *
 * 改版後的色彩語意：
 *   - 黃銅（--accent）只代表「互動／選取」
 *   - 價格用赤陶單色系：低價中性淺灰 → 赤陶 → 深棕紅
 *   - 預售／成屋不用顏色區分，改用實心／空心
 * 地圖底圖（OSM）亮暗主題都一樣是淺色，所以色階不需要分主題。
 */

type RGB = [number, number, number]

/** 色階節點（0 = 低價、1 = 高價） */
export const PRICE_STOPS: [number, RGB][] = [
  [0,    [196, 186, 170]],  // 中性灰褐（低價端刻意不用黃，避免跟黃銅選取色混淆）
  [0.35, [224, 160, 114]],  // 淺赤陶
  [0.7,  [192, 92, 56]],    // 赤陶
  [1,    [110, 34, 20]],    // 深棕紅
]

/** 依數值在 [min, max] 區間中的位置回傳色階顏色；超出範圍會夾在兩端 */
export function priceToColor(value: number, min: number, max: number): string {
  if (max <= min) return 'rgb(192, 92, 56)'

  const t = Math.min(1, Math.max(0, (value - min) / (max - min)))

  let lo = PRICE_STOPS[0]
  let hi = PRICE_STOPS[PRICE_STOPS.length - 1]
  for (let i = 0; i < PRICE_STOPS.length - 1; i++) {
    if (t >= PRICE_STOPS[i][0] && t <= PRICE_STOPS[i + 1][0]) {
      lo = PRICE_STOPS[i]
      hi = PRICE_STOPS[i + 1]
      break
    }
  }

  const span = hi[0] - lo[0]
  const localT = span === 0 ? 0 : (t - lo[0]) / span
  const [r1, g1, b1] = lo[1]
  const [r2, g2, b2] = hi[1]
  const r = Math.round(r1 + (r2 - r1) * localT)
  const g = Math.round(g1 + (g2 - g1) * localT)
  const b = Math.round(b1 + (b2 - b1) * localT)

  return `rgb(${r}, ${g}, ${b})`
}

/** 圖例用的 CSS 漸層，與 priceToColor 同一組節點 */
export function priceGradientCss(direction = 'to right'): string {
  const parts = PRICE_STOPS.map(([t, [r, g, b]]) => `rgb(${r},${g},${b}) ${Math.round(t * 100)}%`)
  return `linear-gradient(${direction}, ${parts.join(', ')})`
}

/**
 * 色階範圍改用 p5–p95：少數極端高價案會把 min–max 撐得很開，
 * 讓絕大多數建案擠在同一個顏色。回傳的範圍外數值由 priceToColor 夾在兩端。
 */
export function percentileRange(values: number[], lo = 0.05, hi = 0.95): [number, number] {
  const v = values.filter(x => x > 0).sort((a, b) => a - b)
  if (!v.length) return [0, 0]
  const pick = (q: number) => v[Math.min(v.length - 1, Math.max(0, Math.round((v.length - 1) * q)))]
  return [pick(lo), pick(hi)]
}

/** 依底色亮度決定上面文字用深色或白色 */
export function textOnColor(color: string): string {
  let r = 0, g = 0, b = 0
  const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3] }
  else if (/^#[0-9a-f]{6}$/i.test(color)) {
    r = parseInt(color.slice(1, 3), 16); g = parseInt(color.slice(3, 5), 16); b = parseInt(color.slice(5, 7), 16)
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1a1206' : '#ffffff'
}

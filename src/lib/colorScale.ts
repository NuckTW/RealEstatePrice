/** 依數值在 [min, max] 區間中的位置，回傳藍(低) → 黃(中) → 紅(高) 的漸層色 */
export function priceToColor(value: number, min: number, max: number): string {
  if (max <= min) return '#cda86a'

  const t = Math.min(1, Math.max(0, (value - min) / (max - min)))

  // 三段漸層：藍 #3b82f6 → 黃 #facc15 → 紅 #ef4444
  const stops: [number, [number, number, number]][] = [
    [0,   [59, 130, 246]],
    [0.5, [250, 204, 21]],
    [1,   [239, 68, 68]],
  ]

  let lo = stops[0]
  let hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i]
      hi = stops[i + 1]
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

/** 框選分析共用常數：選取上限與系列配色（Map 圓點、Panel 圖表/chips 共用同一份） */

export const MAX_SELECT = 15

export const SERIES_COLORS = [
  '#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#a78bfa',
  '#facc15','#38bdf8','#4ade80','#fb923c','#c084fc',
]

/** 依選取順序取得系列顏色 */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

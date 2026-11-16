/**
 * 實價登錄補登期判斷
 *
 * 申報期為權利移轉後 30 日內，加上內政部揭露作業，資料最新的約 2 個月仍在陸續補登，
 * 這段期間的戶數會被低估、均價也可能偏離。圖表上要把這些期間標示出來（斜線底），
 * 避免使用者把「還沒登完」誤讀成「成交量下滑」。
 */

/** 視為補登中的月數（含資料最新月） */
export const BACKFILL_MONTHS = 2

/** 'YYYY-MM-DD' 或 'YYYY-MM' → 補登中的月份清單（'YYYY-MM'，由舊到新） */
export function backfillMonths(lastDataDate: string | null | undefined, n = BACKFILL_MONTHS): string[] {
  if (!lastDataDate || lastDataDate.length < 7) return []
  const y = parseInt(lastDataDate.slice(0, 4))
  const m = parseInt(lastDataDate.slice(5, 7))
  if (!y || !m) return []
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i
    const yy = Math.floor(total / 12)
    const mm = (total % 12) + 1
    out.push(`${yy}-${String(mm).padStart(2, '0')}`)
  }
  return out
}

/**
 * 判斷一個期間是否包含補登月份。支援三種期間格式：
 *   - 月：'YYYY-MM'
 *   - 季：'YYYYQn'
 *   - 年：'YYYY'
 */
export function isIncompletePeriod(period: string, months: string[]): boolean {
  if (!months.length) return false
  if (/^\d{4}-\d{2}$/.test(period)) return months.includes(period)
  const q = period.match(/^(\d{4})Q([1-4])$/)
  if (q) {
    return months.some(ym => ym.slice(0, 4) === q[1] && Math.ceil(parseInt(ym.slice(5, 7)) / 3) === Number(q[2]))
  }
  if (/^\d{4}$/.test(period)) return months.some(ym => ym.slice(0, 4) === period)
  return false
}

/** 'YYYY-MM' → 民國 'YYYMM'（例：'2026-04' → '11504'），對應公會資料的 source_period */
export function isoToRocYm(ym: string): string {
  return `${parseInt(ym.slice(0, 4)) - 1911}${ym.slice(5, 7)}`
}

/**
 * 給 Recharts <ReferenceArea> 用：找出資料尾端「連續的補登期間」的起訖 x 值。
 * 折線圖的 X 軸是點座標（沒有寬度），只有一個點時起訖相同會畫不出來，
 * 所以 widenForLine=true 時起點往前推一格，讓斜線區塊涵蓋「進入補登期」的那段線。
 */
export function incompleteRange(
  periods: string[],
  isIncomplete: (p: string) => boolean,
  widenForLine = false,
): { x1: string; x2: string } | null {
  if (!periods.length) return null
  let start = periods.length
  while (start > 0 && isIncomplete(periods[start - 1])) start--
  if (start === periods.length) return null
  const x2 = periods[periods.length - 1]
  let x1 = periods[start]
  if (widenForLine && x1 === x2 && start > 0) x1 = periods[start - 1]
  return { x1, x2 }
}

/**
 * 全站共用篩選條件（URL 是唯一來源）
 *
 * 改版前只有首頁把篩選寫進網址，其他頁各自用 useState，換頁條件就歸零。
 * 現在所有吃交易資料的頁面（行情地圖、市場、建案）都讀同一組 URL query：
 *   from=114-1  to=115-10  districts=永康區,東區  zones=  types=  rooms=  presale=true  age=all
 * 只寫「與預設不同」的值，所以不帶 from/to 的連結永遠代表「最新期間」。
 * 其他頁面自己的參數（projects、project、q…）一律保留不動。
 */
import type { FilterValues } from '@/components/FilterBar'

/** 篩選條件佔用的 query key（切頁時只帶這些） */
export const FILTER_KEYS = ['from', 'to', 'districts', 'zones', 'types', 'rooms', 'presale', 'age'] as const

/** URL query → FilterValues（缺的欄位用預設值） */
export function paramsToFilters(p: URLSearchParams | { get(k: string): string | null }, defaults: FilterValues): FilterValues {
  const f: FilterValues = { ...defaults }
  const from = p.get('from'), to = p.get('to')
  if (from?.includes('-')) [f.dateFromYear, f.dateFromMonth] = from.split('-')
  if (to?.includes('-'))   [f.dateToYear,   f.dateToMonth]   = to.split('-')
  const csv = (k: string) => (p.get(k) ?? '').split(',').filter(Boolean)
  if (p.get('districts')) f.districts = csv('districts')
  if (p.get('zones'))     f.zones     = csv('zones')
  if (p.get('types'))     f.types     = csv('types')
  if (p.get('rooms'))     f.rooms     = csv('rooms')
  if (p.get('presale'))   f.presale   = p.get('presale')!
  if (p.get('age'))       f.buildingAge = p.get('age')!
  return f
}

/** 把篩選條件寫進既有的 URLSearchParams（只寫非預設值、刪掉預設值，其他 key 不動） */
export function writeFiltersToParams(p: URLSearchParams, f: FilterValues, defaults: FilterValues): URLSearchParams {
  const setOrDel = (k: string, v: string, def: string) => { if (v !== def) p.set(k, v); else p.delete(k) }
  setOrDel('from', `${f.dateFromYear}-${f.dateFromMonth}`, `${defaults.dateFromYear}-${defaults.dateFromMonth}`)
  setOrDel('to',   `${f.dateToYear}-${f.dateToMonth}`,     `${defaults.dateToYear}-${defaults.dateToMonth}`)
  setOrDel('districts', f.districts.join(','), '')
  setOrDel('zones',     f.zones.join(','),     '')
  setOrDel('types',     f.types.join(','),     '')
  setOrDel('rooms',     f.rooms.join(','),     '')
  setOrDel('presale',   f.presale,     defaults.presale)
  setOrDel('age',       f.buildingAge, 'all')
  return p
}

/** 目前網址裡只屬於篩選條件的 query string（導覽切頁時帶過去） */
export function filterOnlyQuery(p: URLSearchParams | { get(k: string): string | null }): string {
  const out = new URLSearchParams()
  for (const k of FILTER_KEYS) {
    const v = p.get(k)
    if (v) out.set(k, v)
  }
  const qs = out.toString()
  return qs ? `?${qs}` : ''
}

/**
 * 篩選條件 → 後端 API 的 query string（/api/charts、/api/map、/api/transactions…）。
 * 同時當作「這份資料對應哪組條件」的識別鍵。
 */
export function buildApiQuery(f: FilterValues): string {
  const p = new URLSearchParams({
    dateFromYear: f.dateFromYear, dateFromMonth: f.dateFromMonth,
    dateToYear:   f.dateToYear,   dateToMonth:   f.dateToMonth,
    presale: f.presale, buildingAge: f.buildingAge,
  })
  if (f.types.length > 0)     p.set('types', f.types.join(','))
  if (f.rooms.length > 0)     p.set('rooms', f.rooms.join(','))
  if (f.districts.length > 0) p.set('districts', f.districts.join(','))
  if (f.zones.length > 0)     p.set('zones', f.zones.join(','))
  return p.toString()
}

/* ── 期間快捷選項 ─────────────────────────────────────────── */

export type PeriodPreset = '12m' | 'default' | '36m' | 'all' | 'custom'

export const PERIOD_PRESETS: { id: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { id: '12m',     label: '近 12 個月' },
  { id: 'default', label: '去年 1 月至今' },
  { id: '36m',     label: '近 3 年' },
  { id: 'all',     label: '110 年至今' },
]

/** 民國年月往前推 n 個月（不早於資料起點 110/1） */
function shiftBack(rocYear: number, month: number, n: number): [number, number] {
  let total = rocYear * 12 + (month - 1) - n
  total = Math.max(total, 110 * 12)
  return [Math.floor(total / 12), (total % 12) + 1]
}

/** 套用期間快捷：迄月固定是資料最新月（defaults 的迄月） */
export function applyPeriodPreset(f: FilterValues, preset: Exclude<PeriodPreset, 'custom'>, defaults: FilterValues): FilterValues {
  const toY = Number(defaults.dateToYear), toM = Number(defaults.dateToMonth)
  let from: [number, number]
  if (preset === 'default') from = [Number(defaults.dateFromYear), Number(defaults.dateFromMonth)]
  else if (preset === 'all') from = [110, 1]
  else from = shiftBack(toY, toM, preset === '12m' ? 11 : 35)
  return {
    ...f,
    dateFromYear: String(from[0]), dateFromMonth: String(from[1]),
    dateToYear: defaults.dateToYear, dateToMonth: defaults.dateToMonth,
  }
}

/** 目前期間對應哪個快捷（都對不上就是自訂） */
export function detectPeriodPreset(f: FilterValues, defaults: FilterValues): PeriodPreset {
  for (const p of PERIOD_PRESETS) {
    const g = applyPeriodPreset(f, p.id, defaults)
    if (g.dateFromYear === f.dateFromYear && g.dateFromMonth === f.dateFromMonth
      && g.dateToYear === f.dateToYear && g.dateToMonth === f.dateToMonth) return p.id
  }
  return 'custom'
}

/** 期間顯示文字：'114/1 – 115/10' */
export function periodText(f: FilterValues): string {
  return `${f.dateFromYear}/${f.dateFromMonth} – ${f.dateToYear}/${f.dateToMonth}`
}

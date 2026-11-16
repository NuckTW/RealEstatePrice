/** 一級導覽（改版後 8 項收成 4 項；AI 問答改成抽屜，不佔導覽） */
export const NAV_ITEMS = [
  { href: '/',                 label: '行情地圖', short: '地圖', icon: '◉' },
  { href: '/market',           label: '市場',     short: '市場', icon: '▤' },
  { href: '/projects',         label: '建案',     short: '建案', icon: '▦' },
  { href: '/potential-buyers', label: '客群',     short: '客群', icon: '◐' },
] as const

/** 這幾頁吃全站交易篩選，頂部顯示篩選列 */
export const FILTER_ROUTES = ['/', '/market', '/projects']

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

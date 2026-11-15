'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { SiteProvider } from './SiteContext'
import AppNav from './AppNav'
import FilterChips, { FilterChipsFallback } from './FilterChips'
import MobileTabBar from './MobileTabBar'
import AiDrawer from './AiDrawer'
import { FILTER_ROUTES } from './navItems'

/**
 * 全站外殼：導覽列、篩選列（只在吃交易資料的頁面）、手機底部 tab bar、AI 抽屜。
 * 由 root layout 包住所有頁面，各頁不必再自己放 <Navbar />。
 */
export default function SiteShell({ lastDate, children }: { lastDate: string | null; children: ReactNode }) {
  const pathname = usePathname()
  const showChips = FILTER_ROUTES.includes(pathname)
  return (
    <SiteProvider lastDate={lastDate}>
      <AppNav />
      {/* FilterChips 用 useSearchParams 讀 URL，靜態頁面預產時需要 Suspense 邊界 */}
      {showChips && (
        <Suspense fallback={<FilterChipsFallback />}>
          <FilterChips />
        </Suspense>
      )}
      <div className="tra-page" data-chips={showChips || undefined}>{children}</div>
      <MobileTabBar />
      <AiDrawer />
    </SiteProvider>
  )
}

'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { buildDefaultFilters, type FilterValues } from '@/components/FilterBar'

/*
 * 全站共用狀態：
 *  - lastDate：資料最新交易日（西元 YYYY-MM-DD），由 root layout 在 server 端查好傳進來，
 *    所有頁面的預設期間都跟著它，不必各頁再打 /api/meta
 *  - defaults：預設篩選條件（迄月 = 資料最新月）
 *  - AI 抽屜開關：導覽列按鈕、手機浮動鈕、各頁都可能打開它
 */
interface SiteState {
  lastDate: string | null
  defaults: FilterValues
  aiOpen: boolean
  setAiOpen: (open: boolean) => void
}

const SiteCtx = createContext<SiteState | null>(null)

export function SiteProvider({ lastDate, children }: { lastDate: string | null; children: ReactNode }) {
  const defaults = useMemo(() => buildDefaultFilters(lastDate), [lastDate])
  const [aiOpen, setAiOpen] = useState(false)
  const value = useMemo(() => ({ lastDate, defaults, aiOpen, setAiOpen }), [lastDate, defaults, aiOpen])
  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>
}

export function useSite(): SiteState {
  const ctx = useContext(SiteCtx)
  if (!ctx) throw new Error('useSite 必須在 <SiteProvider> 裡使用')
  return ctx
}

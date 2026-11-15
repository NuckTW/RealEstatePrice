'use client'

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import type { FilterValues } from '@/components/FilterBar'
import { useSite } from '@/components/shell/SiteContext'
import { paramsToFilters, writeFiltersToParams } from '@/lib/globalFilters'

/**
 * 全站共用篩選條件。
 * URL 是唯一來源：讀取用 useSearchParams，寫入用 history.replaceState
 * （Next.js 會把原生 history API 同步回 useSearchParams，不會觸發整頁導航）。
 * 呼叫此 hook 的元件必須包在 <Suspense> 裡，或以 dynamic({ ssr:false }) 載入。
 */
export function useGlobalFilters() {
  const sp = useSearchParams()
  const { defaults } = useSite()

  const filters = useMemo(() => paramsToFilters(sp, defaults), [sp, defaults])

  const setFilters = useCallback((f: FilterValues) => {
    const p = writeFiltersToParams(new URLSearchParams(window.location.search), f, defaults)
    const qs = p.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
  }, [defaults])

  const resetFilters = useCallback(() => setFilters(defaults), [setFilters, defaults])

  return { filters, setFilters, resetFilters, defaults }
}

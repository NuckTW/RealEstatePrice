import { Suspense } from 'react'
import type { Metadata } from 'next'
import MarketSections from '@/components/market/MarketSections'

export const metadata: Metadata = {
  title: '市場｜台南市不動產分析',
  description: '台南實價登錄市場概況、行政區趨勢比較、住宅價格指數與建照使照供給。',
}

export default function MarketPage() {
  // MarketSections 透過 useSearchParams 讀全站篩選，靜態預產需要 Suspense 邊界
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>載入中…</div>}>
      <MarketSections />
    </Suspense>
  )
}

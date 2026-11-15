'use client'

import dynamic from 'next/dynamic'

/**
 * 首頁工作台的 client-only 殼層：Leaflet 需要 window，篩選條件也要從 URL 讀，
 * 以 ssr:false 只在瀏覽器掛載（ssr:false 不能寫在 Server Component 裡，所以要這一層）。
 */
const MapWorkbench = dynamic(() => import('./MapWorkbench'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: 'calc(100dvh - var(--nav-h) - var(--chips-h) - var(--tabbar-h))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-faint)', fontSize: 'var(--text-sm)', background: 'var(--bg-sunken)',
    }}>
      地圖載入中…
    </div>
  ),
})

export default function HomeClient() {
  return <MapWorkbench />
}

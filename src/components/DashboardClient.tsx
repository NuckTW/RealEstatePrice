'use client'

import dynamic from 'next/dynamic'

/**
 * Dashboard 的 client-only 載入殼層。
 *
 * 為什麼需要這一層：Dashboard 的初始狀態（篩選條件、tab）要從 window.location
 * 與 localStorage 還原。若在 server 端渲染，這些值只能先給預設值，client 端
 * hydration 時再用 effect 補寫回 state —— 那正是 react-hooks/set-state-in-effect
 * 要避免的串聯渲染，而且分享連結（帶 query 參數）進站時 server/client 的
 * 初始 DOM 會不一致，造成 hydration mismatch。
 *
 * 改成 ssr:false 之後，Dashboard 只在 client 掛載一次，state 可以直接用
 * lazy initializer 讀取 URL，不需要還原用的 effect 與 restored 旗標。
 * 代價很小：Dashboard 的資料本來就全部是 client 端 fetch，SSR 產出的
 * 只有空殼；頁面的 Navbar、標題、footer 仍維持 server 渲染。
 *
 * 註：ssr:false 不能寫在 Server Component 裡（Next.js 會直接報錯），
 * 所以必須由這個 'use client' 元件來包。
 */
const Dashboard = dynamic(() => import('./Dashboard'), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-faint)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
    }}>
      載入中…
    </div>
  ),
})

export default function DashboardClient() {
  return <Dashboard />
}

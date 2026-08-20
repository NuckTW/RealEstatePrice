import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import SearchPanel from '@/components/SearchPanel'

export default function SearchPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-default)' }}>
      <Navbar />
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ padding: '24px 20px 8px' }}>
          <h2 style={{
            margin: 0,
            fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
            color: 'var(--text-strong)', fontFamily: 'var(--font-sans)',
          }}>
            建案搜尋
            <span style={{
              fontSize: 'var(--text-sm)', fontWeight: 400,
              color: 'var(--text-muted)', marginLeft: 12,
            }}>輸入建案名稱，查看位置與完整實價登錄</span>
          </h2>
        </div>
        {/* SearchPanel 用 useSearchParams 讀取 ?q=，production build 要求包一層 Suspense */}
        <Suspense fallback={<div style={{ padding: 20, color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>載入中…</div>}>
          <SearchPanel />
        </Suspense>
      </div>
      <footer style={{
        borderTop: '1px solid var(--border-card)',
        marginTop: 48, padding: '20px 0',
        textAlign: 'center', fontSize: 'var(--text-2xs)',
        color: 'var(--text-faint)', fontFamily: 'var(--font-sans)',
      }}>
        資料來源：內政部不動產交易實價查詢服務網 ｜ 僅收錄預售建案，成屋建案搜尋將於第二階段推出
      </footer>
    </main>
  )
}

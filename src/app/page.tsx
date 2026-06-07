import Navbar from '@/components/Navbar'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-default)' }}>
      <Navbar />
      <Dashboard />
      <footer style={{
        borderTop: '1px solid var(--border-card)',
        marginTop: 32,
        padding: '20px 0',
        textAlign: 'center',
        fontSize: 11,
        color: 'var(--text-faint)',
        fontFamily: 'var(--font-sans)',
      }}>
        資料來源：內政部不動產交易實價查詢服務網 ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}

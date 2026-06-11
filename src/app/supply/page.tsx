import Navbar from '@/components/Navbar'
import SupplyPanel from '@/components/SupplyPanel'

export default function SupplyPage() {
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
            市場供給面
            <span style={{
              fontSize: 'var(--text-sm)', fontWeight: 400,
              color: 'var(--text-muted)', marginLeft: 12,
            }}>建照・使照・新建餘屋 供需對照</span>
          </h2>
        </div>
        <SupplyPanel />
      </div>
      <footer style={{
        borderTop: '1px solid var(--border-card)',
        marginTop: 48, padding: '20px 0',
        textAlign: 'center', fontSize: 11,
        color: 'var(--text-faint)', fontFamily: 'var(--font-sans)',
      }}>
        資料來源：台南市不動產開發公會開放資料・內政部不動產交易實價查詢服務網 ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}

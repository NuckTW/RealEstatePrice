import Navbar from '@/components/Navbar'
import PotentialBuyersPanel from '@/components/PotentialBuyersPanel'

export default function PotentialBuyersPage() {
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
            潛在客群
            <span style={{
              fontSize: 'var(--text-sm)', fontWeight: 400,
              color: 'var(--text-muted)', marginLeft: 12,
            }}>村里級首購・換新屋・換二手需求指數（人口結構 × 遷徙 × 所得）</span>
          </h2>
        </div>
        <PotentialBuyersPanel />
      </div>
      <footer style={{
        borderTop: '1px solid var(--border-card)',
        marginTop: 48, padding: '20px 0',
        textAlign: 'center', fontSize: 'var(--text-2xs)',
        color: 'var(--text-faint)', fontFamily: 'var(--font-sans)',
      }}>
        資料來源：內政部戶政司・財政部財政資訊中心・內政部國土測繪中心村里界 ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}

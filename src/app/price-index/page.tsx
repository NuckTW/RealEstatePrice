import Navbar from '@/components/Navbar'
import PriceIndexPanel from '@/components/PriceIndexPanel'

export default function PriceIndexPage() {
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
            住宅價格指數
            <span style={{
              fontSize: 'var(--text-sm)', fontWeight: 400,
              color: 'var(--text-muted)', marginLeft: 12,
            }}>全市／建物型態／行政區指數趨勢（基期 110年1月 = 100）</span>
          </h2>
        </div>
        <PriceIndexPanel />
      </div>
      <footer style={{
        borderTop: '1px solid var(--border-card)',
        marginTop: 48, padding: '20px 0',
        textAlign: 'center', fontSize: 11,
        color: 'var(--text-faint)', fontFamily: 'var(--font-sans)',
      }}>
        資料來源：臺南市實價登錄大數據輔助區段地價平衡之研究（第六期） ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}

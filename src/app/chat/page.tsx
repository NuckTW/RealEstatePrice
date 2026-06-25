import Navbar from '@/components/Navbar'

export default function ChatPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-default)' }}>
      <Navbar />

      <div style={{ maxWidth: 896, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)',
          background: 'var(--surface-card)',
        }}>
          <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 12 }}>◇</div>
          <h2 style={{
            margin: 0,
            fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)',
            color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
          }}>AI 問答功能暫停中</h2>
          <p style={{
            margin: '8px 0 0',
            fontSize: 'var(--text-sm)', color: 'var(--text-faint)',
            fontFamily: 'var(--font-sans)',
          }}>此功能目前暫停服務，敬請期待後續更新</p>
        </div>
      </div>

      <footer style={{
        borderTop: '1px solid var(--border-card)',
        marginTop: 64,
        padding: '24px 0',
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

import Navbar from '@/components/Navbar'
import ChatInterface from '@/components/ChatInterface'

export default function ChatPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-default)' }}>
      <Navbar />
      <div style={{ maxWidth: 896, margin: '0 auto' }}>
        <div style={{ padding: '24px 20px 8px' }}>
          <h2 style={{
            margin: 0,
            fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
            color: 'var(--text-strong)', fontFamily: 'var(--font-sans)',
          }}>
            AI 問答
            <span style={{
              fontSize: 'var(--text-sm)', fontWeight: 400,
              color: 'var(--text-muted)', marginLeft: 12,
            }}>自然語言查詢實價登錄・自動產生圖表</span>
          </h2>
        </div>
        <div style={{ padding: '8px 20px 0' }}>
          <ChatInterface />
        </div>
      </div>
      <footer style={{
        borderTop: '1px solid var(--border-card)',
        marginTop: 48, padding: '20px 0',
        textAlign: 'center', fontSize: 'var(--text-2xs)',
        color: 'var(--text-faint)', fontFamily: 'var(--font-sans)',
      }}>
        資料來源：內政部不動產交易實價查詢服務網 ｜ AI 回答可能有誤，請以原始資料為準 ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}

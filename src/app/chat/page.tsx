import Navbar from '@/components/Navbar'
import ChatInterface from '@/components/ChatInterface'

export default function ChatPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-default)' }}>
      <Navbar />

      <div style={{ maxWidth: 896, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{
            margin: 0,
            fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
            color: 'var(--text-strong)', fontFamily: 'var(--font-sans)',
          }}>
            AI 問答助手
            <span style={{
              fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-regular)',
              color: 'var(--text-muted)', marginLeft: 12,
            }}>用自然語言查詢實價登錄資料</span>
          </h2>
          <p style={{
            margin: '8px 0 0',
            fontSize: 'var(--text-sm)', color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
          }}>
            直接用中文提問，AI 會自動轉換為資料庫查詢並回覆結果
          </p>
        </div>
        <ChatInterface />
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

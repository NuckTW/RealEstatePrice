import Navbar from '@/components/Navbar'
import ChatInterface from '@/components/ChatInterface'

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">
            AI 問答助手
            <span className="text-sm font-normal text-gray-400 ml-3">用自然語言查詢實價登錄資料</span>
          </h2>
          <p className="text-gray-500 text-sm mt-2">
            直接用中文提問，AI 會自動轉換為資料庫查詢並回覆結果
          </p>
        </div>
        <ChatInterface />
      </div>

      <footer className="border-t border-gray-800 mt-16 py-6 text-center text-xs text-gray-600">
        資料來源：內政部不動產交易實價查詢服務網 ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}

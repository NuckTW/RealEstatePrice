import Dashboard from '@/components/Dashboard'
import ChatInterface from '@/components/ChatInterface'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">🏙 台南市實價登錄 AI 分析</h1>
            <p className="text-xs text-gray-400 mt-0.5">資料來源：內政部實價登錄 ｜ 民國 110 年至今</p>
          </div>
          <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-700/50 rounded-full px-3 py-1">
            Powered by Gemini AI
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-12">
        {/* 數據看板 */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            數據看板
            <span className="text-sm font-normal text-gray-400 ml-3">台南市各行政區統計分析</span>
          </h2>
          <Dashboard />
        </section>

        {/* AI 問答 */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-2">
            AI 問答助手
            <span className="text-sm font-normal text-gray-400 ml-3">用自然語言查詢實價登錄資料</span>
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            直接用中文提問，AI 會自動轉換為資料庫查詢並回覆結果
          </p>
          <ChatInterface />
        </section>
      </div>

      <footer className="border-t border-gray-800 mt-16 py-6 text-center text-xs text-gray-600">
        資料來源：內政部不動產交易實價查詢服務網 ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}

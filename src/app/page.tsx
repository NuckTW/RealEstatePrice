import Navbar from '@/components/Navbar'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080d16] text-white">
      <Navbar />
      <Dashboard />
      <footer className="border-t border-white/5 mt-8 py-5 text-center text-[11px] text-gray-700">
        資料來源：內政部不動產交易實價查詢服務網 ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}

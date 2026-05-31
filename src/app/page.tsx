import Navbar from '@/components/Navbar'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      <Dashboard />
      <footer className="border-t border-gray-800 mt-8 py-6 text-center text-xs text-gray-600">
        資料來源：內政部不動產交易實價查詢服務網 ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}

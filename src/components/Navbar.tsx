'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">🏙 台南市實價登錄 AI 分析</h1>
          <p className="text-xs text-gray-400 mt-0.5">資料來源：內政部實價登錄 ｜ 民國 110 年至今</p>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === '/'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            📊 數據看板
          </Link>
          <Link
            href="/chat"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === '/chat'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            🤖 AI 問答
          </Link>
        </nav>
      </div>
    </header>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

function toRocDate(isoDate: string): string {
  // "2026-03-04" → "115年03月"
  const [y, m] = isoDate.split('-')
  const roc = parseInt(y) - 1911
  return `${roc}年${m}月`
}

export default function Navbar() {
  const pathname = usePathname()
  const [lastDate, setLastDate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/meta')
      .then(r => r.json())
      .then(d => { if (d.last_date) setLastDate(toRocDate(d.last_date)) })
      .catch(() => {})
  }, [])

  return (
    <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">🏙 台南市實價登錄 AI 分析</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            資料來源：內政部實價登錄 ｜ 民國 110 年至今
            {lastDate && (
              <span className="ml-2 text-gray-500">｜ 最新資料：{lastDate}</span>
            )}
          </p>
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

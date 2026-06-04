'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

function toRocDate(isoDate: string): string {
  const [y, m] = isoDate.split('-')
  return `${parseInt(y) - 1911}年${m}月`
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
    <header className="sticky top-0 z-[2100] border-b border-white/5 bg-[#080d16]/90 backdrop-blur-xl">
      <div className="px-6 h-14 flex items-center justify-between">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-violet-500/30">
            南
          </div>
          <div>
            <span className="text-sm font-semibold text-white tracking-tight">台南市不動產分析</span>
            <div className="flex items-center gap-1.5 mt-0">
              <span className="text-[10px] text-gray-500">民國 110 年至今</span>
              {lastDate && (
                <>
                  <span className="text-[10px] text-gray-700">·</span>
                  <span className="text-[10px] text-emerald-500/80">最新 {lastDate}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {[
            { href: '/',      label: '數據看板', icon: '▦' },
            { href: '/chat',  label: 'AI 問答',  icon: '◈' },
          ].map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${active
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}
                `}
              >
                <span className="opacity-70">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

      </div>
    </header>
  )
}

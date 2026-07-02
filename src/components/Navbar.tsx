'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import ThemeToggle from './ThemeToggle'

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

  const navItems = [
    { href: '/',            label: '數據看板', icon: '▦' },
    { href: '/analysis',    label: '數據分析', icon: '◈' },
    { href: '/price-index', label: '價格指數', icon: '◉' },
    { href: '/supply',      label: '市場供給', icon: '▤' },
    { href: '/chat',        label: 'AI 問答', icon: '◇', disabled: true },
  ]

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 2100,
      background: 'var(--chrome-bg)',
      backdropFilter: 'saturate(140%) blur(16px)',
      WebkitBackdropFilter: 'saturate(140%) blur(16px)',
      borderBottom: '1px solid var(--border-card)',
      height: 'var(--nav-h)',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '0 20px', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'var(--gradient-brand)',
            boxShadow: 'var(--glow-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--on-accent)',
            fontFamily: 'var(--font-sans)',
          }}>南</div>
          {/* 窄螢幕只留 logo，文字資訊全部隱藏 */}
          <div className="hidden md:block">
            <div style={{
              fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-strong)', letterSpacing: 'var(--tracking-tight)',
              fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            }}>台南市不動產分析</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                民國 110 年至今
              </span>
              {lastDate && (
                <>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>·</span>
                  <span style={{ fontSize: 10, color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}>
                    最新 {lastDate}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: nav + theme toggle（窄螢幕 nav 可橫向捲動，不折行） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <nav className="overflow-x-auto" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {navItems.map(({ href, label, icon, disabled }) => {
              const active = pathname === href

              if (disabled) {
                return (
                  <span
                    key={href}
                    title="功能暫停中"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '0 12px', height: 'var(--control-h-sm)',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                      fontFamily: 'var(--font-sans)',
                      border: '1px solid transparent',
                      color: 'var(--text-faint)',
                      opacity: 0.4,
                      cursor: 'not-allowed',
                      userSelect: 'none',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    <span style={{ opacity: 0.75 }}>{icon}</span>
                    {label}
                  </span>
                )
              }

              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '0 12px', height: 'var(--control-h-sm)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                    fontFamily: 'var(--font-sans)',
                    textDecoration: 'none',
                    border: active ? '1px solid var(--accent-wash-border)' : '1px solid transparent',
                    background: active ? 'var(--accent-wash)' : 'transparent',
                    color: active ? 'var(--accent-tint)' : 'var(--text-muted)',
                    transition: 'var(--transition-base)',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-default)'
                      ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                      ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    }
                  }}
                >
                  <span style={{ opacity: 0.75 }}>{icon}</span>
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'var(--border-card)', margin: '0 4px' }} />

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

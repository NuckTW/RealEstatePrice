'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import FontSizeToggle from '@/components/FontSizeToggle'
import { filterOnlyQuery } from '@/lib/globalFilters'
import { useSite } from './SiteContext'
import { NAV_ITEMS, isActive } from './navItems'

function toRocMonth(isoDate: string): string {
  const [y, m] = isoDate.split('-')
  return `${parseInt(y) - 1911}年${parseInt(m)}月`
}

/**
 * 切頁時把目前的篩選條件帶過去（只帶篩選相關的 key），
 * 在點擊當下讀 location.search，就不必為了 useSearchParams 包 Suspense。
 */
export function useFilterAwareNav() {
  const router = useRouter()
  return (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return  // 讓「新分頁開啟」維持瀏覽器預設
    const q = filterOnlyQuery(new URLSearchParams(window.location.search))
    if (!q) return
    e.preventDefault()
    router.push(`${href}${q}`)
  }
}

/** 設定選單：字級、明暗（原本佔掉導覽列右側一大塊，收進齒輪） */
function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: globalThis.MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" aria-label="顯示設定" aria-expanded={open} onClick={() => setOpen(o => !o)} className="tra-iconbtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-label="顯示設定" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 9999,
          background: 'var(--surface-overlay)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-pop)', padding: 12,
          display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>字級</span><FontSizeToggle />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>主題</span><ThemeToggle />
          </div>
        </div>
      )}
    </div>
  )
}

export default function AppNav() {
  const pathname = usePathname()
  const { lastDate, setAiOpen } = useSite()
  const navTo = useFilterAwareNav()

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 2100, height: 'var(--nav-h)',
      background: 'var(--chrome-bg)', backdropFilter: 'saturate(140%) blur(16px)',
      WebkitBackdropFilter: 'saturate(140%) blur(16px)', borderBottom: '1px solid var(--border-card)',
    }}>
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', gap: 20,
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
      }}>
        {/* 品牌 */}
        <Link href="/" onClick={navTo('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8, background: 'var(--gradient-brand)', boxShadow: 'var(--glow-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--on-accent)',
          }}>南</span>
          <span className="hidden lg:flex" style={{ flexDirection: 'column', lineHeight: 1.25 }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>台南市不動產分析</span>
            {lastDate && (
              <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                實價登錄至 {toRocMonth(lastDate)}
              </span>
            )}
          </span>
        </Link>

        {/* 一級導覽（手機改由底部 tab bar 負責） */}
        <nav aria-label="主要頁面" className="hidden md:flex" style={{ alignItems: 'center', gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(pathname, item.href)
            return (
              <Link key={item.href} href={item.href} onClick={navTo(item.href)} aria-current={active ? 'page' : undefined}
                className="tra-navlink" data-active={active || undefined}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* AI 問答：抽屜，需要密碼所以標示「內部」 */}
        <button type="button" onClick={() => setAiOpen(true)} className="tra-aibtn" title="AI 問答（需要密碼）">
          <span aria-hidden>◇</span>
          <span className="hidden sm:inline">AI 問答</span>
          <span className="tra-badge">內部</span>
        </button>
        <SettingsMenu />
      </div>

      <style>{`
        .tra-navlink { display:inline-flex; align-items:center; height:32px; padding:0 14px; border-radius:999px;
          font-size:var(--text-sm); font-weight:var(--weight-medium); color:var(--text-muted); text-decoration:none;
          transition:var(--transition-base); white-space:nowrap; }
        .tra-navlink:hover { color:var(--text-default); background:var(--surface-hover); }
        .tra-navlink[data-active] { color:var(--accent-tint); background:var(--accent-wash); font-weight:var(--weight-semibold); }
        .tra-aibtn { display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px; border-radius:999px;
          border:1px solid var(--border-control); background:var(--surface-card); color:var(--text-default);
          font-size:var(--text-xs); font-family:var(--font-sans); cursor:pointer; white-space:nowrap; }
        .tra-aibtn:hover { border-color:var(--accent-wash-border); }
        .tra-badge { font-size:var(--text-3xs); padding:0 6px; border-radius:999px; border:1px solid var(--border-control);
          color:var(--text-faint); line-height:1.6; }
        .tra-iconbtn { width:32px; height:32px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center;
          border:1px solid var(--border-control); background:var(--surface-card); color:var(--text-muted); cursor:pointer; }
        .tra-iconbtn:hover { color:var(--text-default); }
        .tra-navlink:focus-visible, .tra-aibtn:focus-visible, .tra-iconbtn:focus-visible { outline:2px solid var(--focus-ring); outline-offset:2px; }
      `}</style>
    </header>
  )
}

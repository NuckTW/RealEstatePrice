'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActive } from './navItems'
import { useFilterAwareNav } from './AppNav'

/** 手機版底部 tab bar（<768px）：取代原本要橫向捲動的 8 項導覽 */
export default function MobileTabBar() {
  const pathname = usePathname()
  const navTo = useFilterAwareNav()
  return (
    <nav aria-label="主要頁面" className="md:hidden" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2200,
      height: 'var(--tabbar-h)', background: 'var(--chrome-bg)',
      backdropFilter: 'saturate(140%) blur(16px)', WebkitBackdropFilter: 'saturate(140%) blur(16px)',
      borderTop: '1px solid var(--border-card)',
      display: 'grid', gridTemplateColumns: `repeat(${NAV_ITEMS.length}, 1fr)`,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)',
    }}>
      {NAV_ITEMS.map(item => {
        const active = isActive(pathname, item.href)
        return (
          <Link key={item.href} href={item.href} onClick={navTo(item.href)} aria-current={active ? 'page' : undefined} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            textDecoration: 'none', fontSize: 'var(--text-3xs)', fontFamily: 'var(--font-sans)',
            color: active ? 'var(--accent-tint)' : 'var(--text-muted)',
            fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
          }}>
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
            {item.short}
          </Link>
        )
      })}
    </nav>
  )
}

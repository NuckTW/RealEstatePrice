'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'tra-theme'

function getStoredTheme(): 'dark' | 'light' {
  if (typeof localStorage === 'undefined') return 'dark'
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
  else document.documentElement.removeAttribute('data-theme')
  try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    // 與 FontSizeToggle 同一模式：SSR 階段沒有 localStorage，state 先用預設值 'dark'
    // render 一次以避免 hydration mismatch，掛載後才讀真正的值同步 React state。
    // 實際頁面主題已由 layout.tsx 的 blocking script 提前套用（不會閃爍），
    // 這裡只是同步按鈕自身的高亮狀態，此處刻意保留、不改用 useSyncExternalStore。
    const t = getStoredTheme()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(t)
    applyTheme(t)
  }, [])

  const pick = (next: 'dark' | 'light') => {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div
      role="group"
      aria-label="主題切換"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        padding: 3, borderRadius: 'var(--radius-full)',
        background: 'var(--surface-control)',
        border: '1px solid var(--border-control)',
      }}
    >
      {(['light', 'dark'] as const).map(id => {
        const active = theme === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => pick(id)}
            aria-pressed={active}
            title={id === 'light' ? '明亮模式' : '暗色模式'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              // 高度沿用 --control-h-sm 换算（減去外層 padding），字級切到「大」時按鈕文字本身也會放大，
              // 固定 22px 會被撐破，改成跟著 --font-scale 一起長高（與 FontSizeToggle 一致）
              height: 'calc(var(--control-h-sm) - 6px)', padding: '0 8px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-full)',
              background: active ? 'var(--accent-wash)' : 'transparent',
              color: active ? 'var(--accent-tint)' : 'var(--text-muted)',
              boxShadow: active ? 'inset 0 0 0 1px var(--accent-wash-border)' : 'none',
              font: `var(--weight-semibold) var(--text-3xs) var(--font-sans)`,
              fontFamily: 'var(--font-sans)',
              transition: 'var(--transition-base)',
            }}
          >
            <span style={{ fontSize: 'var(--text-2xs)' }}>{id === 'light' ? '☀' : '☾'}</span>
            <span>{id === 'light' ? '明' : '暗'}</span>
          </button>
        )
      })}
    </div>
  )
}

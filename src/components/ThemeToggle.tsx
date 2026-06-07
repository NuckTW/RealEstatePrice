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
    const t = getStoredTheme()
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
              height: 22, padding: '0 8px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-full)',
              background: active ? 'var(--accent-wash)' : 'transparent',
              color: active ? 'var(--accent-tint)' : 'var(--text-muted)',
              boxShadow: active ? 'inset 0 0 0 1px var(--accent-wash-border)' : 'none',
              font: `var(--weight-semibold) var(--text-3xs) var(--font-sans)`,
              fontSize: 10, fontFamily: 'var(--font-sans)',
              transition: 'var(--transition-base)',
            }}
          >
            <span style={{ fontSize: 11 }}>{id === 'light' ? '☀' : '☾'}</span>
            <span>{id === 'light' ? '明' : '暗'}</span>
          </button>
        )
      })}
    </div>
  )
}

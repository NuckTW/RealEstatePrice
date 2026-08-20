'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'tra-fontsize'

type FontSize = 'small' | 'medium' | 'large'

const OPTIONS: { id: FontSize; label: string; title: string }[] = [
  { id: 'small',  label: '小', title: '小字級' },
  { id: 'medium', label: '中', title: '中字級' },
  { id: 'large',  label: '大', title: '大字級（簡報投影）' },
]

function getStoredFontSize(): FontSize {
  if (typeof localStorage === 'undefined') return 'small'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'medium' || v === 'large' ? v : 'small'
}

function applyFontSize(size: FontSize) {
  if (typeof document === 'undefined') return
  // small 是預設值，直接移除屬性即可（對應 globals.css 的 :root 預設 --font-scale: 1）
  if (size === 'small') document.documentElement.removeAttribute('data-fontsize')
  else document.documentElement.setAttribute('data-fontsize', size)
  try { localStorage.setItem(STORAGE_KEY, size) } catch {}
}

export default function FontSizeToggle() {
  const [fontSize, setFontSize] = useState<FontSize>('small')

  useEffect(() => {
    // 與 ThemeToggle 同一模式：SSR 階段沒有 localStorage，state 先用預設值 'small'
    // render 一次以避免 hydration mismatch，掛載後才讀真正的值同步 React state。
    // 這是 SSR-safe 外部狀態同步的標準寫法，此處刻意保留、不改用 useSyncExternalStore。
    const s = getStoredFontSize()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFontSize(s)
    applyFontSize(s)
  }, [])

  const pick = (next: FontSize) => {
    setFontSize(next)
    applyFontSize(next)
  }

  return (
    <div
      role="group"
      aria-label="字級切換"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        padding: 3, borderRadius: 'var(--radius-full)',
        background: 'var(--surface-control)',
        border: '1px solid var(--border-control)',
      }}
    >
      {OPTIONS.map(({ id, label, title }) => {
        const active = fontSize === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => pick(id)}
            aria-pressed={active}
            title={title}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              // 高度沿用 --control-h-sm 换算（減去外層 padding），字級切到「大」時按鈕文字本身也會放大，
              // 固定 22px 會被撐破，改成跟著 --font-scale 一起長高
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
            {label}
          </button>
        )
      })}
    </div>
  )
}

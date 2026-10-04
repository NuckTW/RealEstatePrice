'use client'

/**
 * 村里面量圖共用：五分位色階、切點計算、圖例
 * 使用者：PotentialBuyersPanel（村里指數）、DataCatalogSection（資料總覽）、CustomIndexSection（自訂指數預覽）
 */

/**
 * 單一色相（brass）五分位色階，以 CSS 變數 --pb-ramp-0..4 定義（0 = 最低）
 * 亮色主題：淺 → 深；暗色主題翻轉為 深 → 亮，高分在深底圖上才會突出
 */
export const RAMP = [0, 1, 2, 3, 4].map(i => `var(--pb-ramp-${i})`)
export const RAMP_CSS = `
  :root { --pb-ramp-0: #6a4312; --pb-ramp-1: #8f5a16; --pb-ramp-2: #b9761d; --pb-ramp-3: #e8ad3f; --pb-ramp-4: #f7dca2; }
  :root[data-theme="light"] { --pb-ramp-0: #f7dca2; --pb-ramp-1: #f0c86e; --pb-ramp-2: #d9912a; --pb-ramp-3: #a8661a; --pb-ramp-4: #6a4312; }
`
export const RAMP_LABEL = ['後 20%', '20–40%', '40–60%', '60–80%', '前 20%']

/** 五分位切點（20/40/60/80%） */
export function quintileBreaks(values: number[]): number[] {
  const s = [...values].sort((a, b) => a - b)
  return [0.2, 0.4, 0.6, 0.8].map(q => s[Math.floor(q * (s.length - 1))])
}
export function classOf(v: number, breaks: number[]): number {
  let i = 0
  while (i < breaks.length && v > breaks[i]) i++
  return i
}

function fmt(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/* ── 圖例 ─────────────────────────────────────────────────────── */
export function Legend({ breaks, title, digits = 1 }: { breaks: number[]; title: string; digits?: number }) {
  const ranges = RAMP.map((_, i) => {
    const lo = i === 0 ? null : breaks[i - 1]
    const hi = i === RAMP.length - 1 ? null : breaks[i]
    return lo == null ? `≤ ${fmt(hi, digits)}` : hi == null ? `> ${fmt(lo, digits)}` : `${fmt(lo, digits)}–${fmt(hi, digits)}`
  })
  return (
    <div style={{
      position: 'absolute', left: 10, bottom: 24, zIndex: 1000,
      background: 'var(--surface-overlay)', border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-md)', padding: '8px 10px', boxShadow: 'var(--shadow-pop)',
      fontSize: 'var(--text-2xs)', color: 'var(--text-default)', maxWidth: 'calc(100% - 20px)',
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>{title}（全市五分位）</div>
      {[...RAMP].reverse().map((c, ri) => {
        const i = RAMP.length - 1 - ri
        return (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.7 }}>
            <span style={{ width: 14, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />
            <span style={{ minWidth: 48 }}>{RAMP_LABEL[i]}</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ranges[i]}</span>
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: 'var(--text-muted)' }}>
        <span style={{ width: 14, height: 10, borderRadius: 2, border: '1px dashed var(--text-muted)', display: 'inline-block' }} />
        人口未滿 1,000（淡色，僅供參考）
      </div>
    </div>
  )
}


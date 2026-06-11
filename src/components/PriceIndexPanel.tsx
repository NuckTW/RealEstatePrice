'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { SERIES_COLORS } from './AnalysisChart'

const PriceIndexChart = dynamic(() => import('./PriceIndexChart'), {
  ssr: false,
  loading: () => <div style={centerStyle(420)}>圖表載入中…</div>,
})

/* ── Types ──────────────────────────────────────────────── */
interface Point { ym: string; label: string; value: number; mom: number | null; yoy: number | null }
interface Series { name: string; points: Point[] }
interface Summary {
  name: string; latest_ym: string; label: string; value: number
  mom: number | null; yoy: number | null
  peak: { ym: string; label: string; value: number }
  drawdown: number | null
}
interface ApiData { available: string[]; series: Series[]; summary: Summary | null }

type Mode = 'index' | 'yoy'

/* ── Style helpers ───────────────────────────────────────── */
function centerStyle(h: number): React.CSSProperties {
  return { height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-sans)' }
}

function cardStyle(): React.CSSProperties {
  return {
    background: 'var(--surface-card)', border: '1px solid var(--border-card)',
    borderRadius: 'var(--radius-lg)', padding: 16,
  }
}

function chipStyle(active: boolean, color?: string): React.CSSProperties {
  return {
    height: 28, padding: '0 12px', borderRadius: 'var(--radius-full)',
    fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: active ? 600 : 400,
    background: active ? 'var(--accent-wash)' : 'var(--surface-control)',
    color: active ? (color ?? 'var(--accent-tint)') : 'var(--text-muted)',
    border: active ? `1px solid ${color ?? 'var(--accent-wash-border)'}` : '1px solid var(--border-control)',
    cursor: 'pointer', transition: 'var(--transition-base)',
  }
}

function pctColor(v: number | null): string {
  if (v == null) return 'var(--text-muted)'
  return v > 0 ? 'var(--positive)' : v < 0 ? 'var(--negative)' : 'var(--text-muted)'
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

/* ── Component ───────────────────────────────────────────── */
export default function PriceIndexPanel() {
  const [selected, setSelected] = useState<string[]>(['全市'])
  const [mode, setMode] = useState<Mode>('index')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({ series: selected.join(',') })
    fetch(`/api/price-index?${p}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selected])

  function toggleSeries(name: string) {
    setSelected(prev => {
      if (prev.includes(name)) {
        return prev.length > 1 ? prev.filter(s => s !== name) : prev
      }
      return [...prev, name]
    })
  }

  // recharts rows：[{ period:'110/01', 全市: 100.0, ... }]
  const chartRows = useMemo(() => {
    if (!data) return []
    const byLabel = new Map<string, Record<string, unknown>>()
    for (const s of data.series) {
      for (const pt of s.points) {
        if (!byLabel.has(pt.label)) byLabel.set(pt.label, { period: pt.label })
        byLabel.get(pt.label)![s.name] = mode === 'index' ? pt.value : pt.yoy
      }
    }
    return Array.from(byLabel.values())
  }, [data, mode])

  const summary = data?.summary ?? null

  return (
    <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-sans)' }}>

      {/* 摘要卡片 */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div style={cardStyle()}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>最新指數（{summary.name}・{summary.label}）</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              {summary.value.toFixed(2)}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>月增率 MoM</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: pctColor(summary.mom), fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              {fmtPct(summary.mom)}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>年增率 YoY</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: pctColor(summary.yoy), fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              {fmtPct(summary.yoy)}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>距歷史高點（{summary.peak.label}・{summary.peak.value.toFixed(2)}）</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: pctColor(summary.drawdown), fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              {fmtPct(summary.drawdown)}
            </div>
          </div>
        </div>
      )}

      {/* 控制列 */}
      <div style={{ ...cardStyle(), display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-faint)', marginRight: 4 }}>數列</span>
          {(data?.available ?? ['全市']).map(name => {
            const idx = selected.indexOf(name)
            const color = idx >= 0 ? SERIES_COLORS[idx % SERIES_COLORS.length] : undefined
            return (
              <button key={name} style={chipStyle(idx >= 0, color)} onClick={() => toggleSeries(name)}>
                {name}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-faint)', marginRight: 4 }}>顯示</span>
          <button style={chipStyle(mode === 'index')} onClick={() => setMode('index')}>指數值</button>
          <button style={chipStyle(mode === 'yoy')} onClick={() => setMode('yoy')}>年增率 YoY%</button>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>
            基期：民國 110 年 1 月 = 100
          </span>
        </div>
      </div>

      {/* 趨勢圖 */}
      <div style={cardStyle()}>
        {loading && !data
          ? <div style={centerStyle(420)}>載入中…</div>
          : <PriceIndexChart
              chartRows={chartRows}
              names={selected}
              unit={mode === 'index' ? '' : '%'}
              baseline={mode === 'yoy' ? 0 : undefined}
            />}
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'

const SouthParkChart = dynamic(() => import('./SouthParkChart'), {
  ssr: false,
  loading: () => <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>圖表載入中…</div>,
})

export interface IndustryRow { year: number; industry: string; employees: number }

export interface SouthParkRow {
  ym: string         // 民國年月 '11508'
  subPark: string    // '合計' = 園區總數
  total: number
  phd: number | null
  master: number | null
}

/** '11508' → '115/08' */
const ymLabel = (ym: string) => `${ym.slice(0, -2)}/${ym.slice(-2)}`
/** 往前推 n 個月（民國年月） */
function shiftYm(ym: string, n: number): string {
  const y = Number(ym.slice(0, -2)), m = Number(ym.slice(-2))
  const t = y * 12 + (m - 1) - n
  return `${Math.floor(t / 12)}${String((t % 12) + 1).padStart(2, '0')}`
}

export default function SouthParkSection({ rows, industry = [] }: { rows: SouthParkRow[]; industry?: IndustryRow[] }) {
  const { series, latest, yoy, subParks, eduShare } = useMemo(() => {
    const parkTotal = rows.filter(r => r.subPark === '合計')
    const byYm = new Map(parkTotal.map(r => [r.ym, r]))
    const last = parkTotal.at(-1) ?? null
    const prev = last ? byYm.get(shiftYm(last.ym, 12)) ?? null : null
    // 子園區只取最新一期（開放資料逐月累積，歷史從匯入當月開始）
    const subYm = rows.filter(r => r.subPark !== '合計').at(-1)?.ym
    return {
      series: parkTotal.map(r => ({ label: ymLabel(r.ym), total: r.total })),
      latest: last,
      yoy: last && prev ? { diff: last.total - prev.total, pct: (last.total / prev.total - 1) * 100 } : null,
      subParks: subYm
        ? rows.filter(r => r.ym === subYm && r.subPark !== '合計' && r.total > 0).sort((a, b) => b.total - a.total)
        : [],
      eduShare: last && last.phd != null && last.master != null ? (last.phd + last.master) / last.total * 100 : null,
    }
  }, [rows])

  // 產業別：最新年度 vs 最早年度（開放資料目前 107～113 年）
  const ind = useMemo(() => {
    const years = [...new Set(industry.map(r => r.year))].sort((a, b) => a - b)
    if (!years.length) return null
    const y0 = years[0], y1 = years.at(-1)!
    const get = (y: number, name: string) => industry.find(r => r.year === y && r.industry === name)?.employees ?? null
    const names = [...new Set(industry.filter(r => r.industry !== '合計').map(r => r.industry))]
    const list = names.map(n => ({ name: n, now: get(y1, n), then: get(y0, n) }))
      .sort((a, b) => (b.now ?? 0) - (a.now ?? 0))
    return { y0, y1, list, total: get(y1, '合計'), totalThen: get(y0, '合計') }
  }, [industry])

  if (!latest) {
    return <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>南科資料尚未匯入</div>
  }

  const subTotal = subParks.reduce((s, r) => s + r.total, 0)
  const stat = (label: string, value: string, sub?: string, tone?: 'pos' | 'neg') => (
    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-2xs)', color: tone === 'pos' ? 'var(--positive)' : tone === 'neg' ? 'var(--negative)' : 'var(--text-faint)' }}>{sub}</div>}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, marginBottom: 12 }}>
        {stat(`南科從業員工（${ymLabel(latest.ym)}）`, latest.total.toLocaleString(), '含臺南、高雄等子園區')}
        {yoy && stat('年增', `${yoy.diff >= 0 ? '+' : ''}${yoy.diff.toLocaleString()}`,
          `${yoy.pct >= 0 ? '▲' : '▼'} ${Math.abs(yoy.pct).toFixed(1)}%（vs ${ymLabel(shiftYm(latest.ym, 12))}）`, yoy.diff >= 0 ? 'pos' : 'neg')}
        {eduShare != null && stat('碩博士占比', `${eduShare.toFixed(1)}%`, '高學歷 ≈ 高所得購屋族群')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ gridColumn: 'span 2', minWidth: 0 }} className="sp-chart">
          <SouthParkChart rows={series} />
        </div>
        {subParks.length > 0 && (
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 8 }}>
              子園區（{ymLabel(subParks[0].ym)}）
            </div>
            {subParks.map(r => (
              <div key={r.subPark} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-default)' }}>{r.subPark}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {r.total.toLocaleString()}（{(r.total / subTotal * 100).toFixed(0)}%）
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)' }}>
                  <div style={{ width: `${r.total / subParks[0].total * 100}%`, height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--accent)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {ind && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 8 }}>
            產業別（{ind.y1} 年，與 {ind.y0} 年比較）
            <span style={{ fontWeight: 400, color: 'var(--text-faint)', marginLeft: 6, fontSize: 'var(--text-2xs)' }}>
              合計 {ind.total?.toLocaleString() ?? '—'} 人
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', columnGap: 24 }}>
            {ind.list.map(r => {
              const chg = r.now != null && r.then ? (r.now / r.then - 1) * 100 : null
              const max = ind.list[0].now ?? 1
              return (
                <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 64px 52px', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border-card)', fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: 'var(--text-default)' }}>{r.name}</span>
                  <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)' }}>
                    <div style={{ width: `${(r.now ?? 0) / max * 100}%`, height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--accent)' }} />
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{r.now?.toLocaleString() ?? '—'}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: chg == null ? 'var(--text-faint)' : chg >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                    {chg == null ? '—' : `${chg >= 0 ? '+' : ''}${chg.toFixed(0)}%`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        產業別為南科管理局年資料（開放資料目前只有 {ind ? `${ind.y0}～${ind.y1}` : '107～113'} 年）。
        資料來源：國科會科學園區從業員工數統計（含園區事業、育成中心、研究機構，不含營建承攬商）。
        園區級資料自 105 年 11 月起；子園區明細來自開放資料，只提供最新一期，自匯入起逐月累積。
      </div>
      <style>{`@media (max-width: 760px) { .sp-chart { grid-column: auto !important; } }`}</style>
    </div>
  )
}

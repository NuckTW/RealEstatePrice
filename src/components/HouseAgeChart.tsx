'use client'

import { useMemo } from 'react'

export interface HouseAgeRow {
  district: string
  n: number                  // 房屋稅籍住宅數（宅）
  avgAge: number | null      // 住宅平均屋齡（歲）
  pctLt10: number
  pct10_20: number
  pct20_30: number
  pct30_40: number
  pctGe40: number
}


/**
 * 屋齡五級，依序由新到舊；顏色沿用潛在客群頁的 brass 色階 --pb-ramp-0..4（由 PotentialBuyersPanel 定義）
 * 越舊顏色越強 → 與「老屋換屋需求越高」同方向
 */
const BANDS: { key: keyof HouseAgeRow; label: string }[] = [
  { key: 'pctLt10',  label: '未滿 10 年' },
  { key: 'pct10_20', label: '10–20 年' },
  { key: 'pct20_30', label: '20–30 年' },
  { key: 'pct30_40', label: '30–40 年' },
  { key: 'pctGe40',  label: '40 年以上' },
]

export default function HouseAgeChart({ rows, period, cityAvgAge, highlightDistrict }: {
  rows: HouseAgeRow[]; period: string | null; cityAvgAge: number | null; highlightDistrict?: string
}) {
  const view = useMemo(() => rows
    .filter(r => r.n > 0)
    .map(r => ({ ...r, old: r.pct30_40 + r.pctGe40 }))
    .sort((a, b) => b.old - a.old), [rows])

  return (
    <div>
      {/* 圖例 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 'var(--text-2xs)', color: 'var(--text-default)' }}>
        {BANDS.map((b, i) => (
          <span key={b.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 10, borderRadius: 2, background: `var(--pb-ramp-${i})`, display: 'inline-block' }} />
            {b.label}
          </span>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 64px 64px 56px', gap: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 600, padding: '0 0 6px', borderBottom: '1px solid var(--border-card)' }}>
            <span>行政區</span><span>屋齡分布（住宅宅數占比）</span>
            <span style={{ textAlign: 'right' }}>30 年以上</span><span style={{ textAlign: 'right' }}>平均屋齡</span><span style={{ textAlign: 'right' }}>宅數</span>
          </div>
          {view.map(r => (
            <div key={r.district} style={{
              display: 'grid', gridTemplateColumns: '64px 1fr 64px 64px 56px', gap: 8, alignItems: 'center',
              padding: '5px 0', borderBottom: '1px solid var(--border-card)',
              background: r.district === highlightDistrict ? 'var(--accent-wash)' : undefined,
              fontSize: 'var(--text-xs)',
            }}>
              <span style={{ color: 'var(--text-default)' }}>{r.district}</span>
              {/* 100% 堆疊條：段與段之間留 2px 表面色間隙 */}
              <div style={{ display: 'flex', gap: 2, height: 12 }}>
                {BANDS.map((b, i) => {
                  const v = r[b.key] as number
                  return v > 0 ? (
                    <div key={b.key} title={`${r.district}・${b.label}：${v.toFixed(1)}%`}
                      style={{ width: `${v}%`, background: `var(--pb-ramp-${i})`, borderRadius: 2, minWidth: 2 }} />
                  ) : null
                })}
              </div>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-strong)', fontWeight: 600 }}>{r.old.toFixed(0)}%</span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-default)' }}>{r.avgAge != null ? `${r.avgAge.toFixed(1)} 年` : '—'}</span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>{r.n.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        依 30 年以上占比排序；老屋比例越高，換屋需求的潛力越大。
        資料：內政部不動產資訊平台「房屋稅籍住宅類數量依屋齡區分」{period ? `（${period}）` : ''}，為全部住宅存量；
        全市平均屋齡 {cityAvgAge != null ? `${cityAvgAge.toFixed(1)} 年` : '—'}。
      </div>
    </div>
  )
}

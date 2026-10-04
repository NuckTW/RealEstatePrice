'use client'

import { useMemo, useState } from 'react'
import type { TransfersData } from './MarketSection'

export interface SupplyData {
  stats: { indicator: string; level: string; area: string; period: string; value: number }[]
  unsoldPeriod: string | null
  unsold: { district: string; units: number }[]
}

type SortKey = 'startNow' | 'startPerK' | 'permitAvg' | 'delivered' | 'unsold'

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 'var(--radius-lg)', padding: 16,
}
const fmt = (v: number | null | undefined, d = 0) =>
  v == null || Number.isNaN(v) ? '—' : v.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d })

/**
 * 住宅供給動能：開工 → 使照 → 新屋交屋 → 待售新成屋，依行政區並列
 * 開工戶數為未來 2–4 年的潛在完工量；待售新成屋代表已完工但未賣出的去化壓力
 */
export default function SupplyPipelineSection({ data, transfers, householdsByDistrict, highlightDistrict }: {
  data: SupplyData
  transfers: TransfersData
  /** 各區戶數（村里加總），算「每千戶開工戶數」用 */
  householdsByDistrict: Map<string, number>
  highlightDistrict?: string
}) {
  const [sort, setSort] = useState<SortKey>('startNow')

  const view = useMemo(() => {
    const series = (ind: string) => data.stats.filter(s => s.indicator === ind)
    const startYears = [...new Set(series('construction_start_units').map(s => s.period))].sort()
    const permitYears = [...new Set(series('usage_permit_units').map(s => s.period))].sort()
    const y1 = startYears.at(-1) ?? null
    // 使照取最近 5 個完整年度平均（官方逐案資料停在 112 年 4 月）
    const permitWindow = permitYears.slice(-5)
    const get = (ind: string, area: string, period: string) =>
      data.stats.find(s => s.indicator === ind && s.area === area && s.period === period)?.value ?? null
    const avg = (ind: string, area: string, periods: string[]) => {
      const vs = periods.map(p => get(ind, area, p)).filter((v): v is number => v != null)
      return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
    }
    const districts = [...new Set(data.stats.filter(s => s.level === 'district').map(s => s.area))]
    const rows = districts.map(area => {
      const startNow = y1 ? get('construction_start_units', area, y1) : null
      const hh = householdsByDistrict.get(area) ?? null
      return {
        area, startNow,
        startAvg: avg('construction_start_units', area, startYears),
        startPerK: startNow != null && hh ? startNow / hh * 1000 : null,
        permitAvg: avg('usage_permit_units', area, permitWindow),
        delivered: transfers.rows.find(t => t.district === area)?.first12m ?? null,
        unsold: data.unsold.find(u => u.district === area)?.units ?? null,
      }
    }).sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1))
    return {
      rows, y1, startYears, permitWindow,
      cityStart: y1 ? get('construction_start_units', '臺南市', y1) : null,
      cityStartPrev: startYears.length > 1 ? get('construction_start_units', '臺南市', startYears.at(-2)!) : null,
    }
  }, [data, transfers, householdsByDistrict, sort])

  if (!view.rows.length) return null
  const th = (key: SortKey | null, label: string, title?: string) => (
    <th onClick={key ? () => setSort(key) : undefined} title={title} style={{
      padding: '6px 8px', fontWeight: 600, fontSize: 'var(--text-2xs)', textAlign: 'right', whiteSpace: 'nowrap',
      borderBottom: '1px solid var(--border-card)', cursor: key ? 'pointer' : 'default',
      color: key && sort === key ? 'var(--accent-tint)' : 'var(--text-muted)',
    }}>{label}{key && sort === key ? ' ▼' : ''}</th>
  )
  const td: React.CSSProperties = { padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }
  const maxStart = Math.max(...view.rows.map(r => r.startNow ?? 0), 1)
  const yoy = view.cityStart != null && view.cityStartPrev ? (view.cityStart / view.cityStartPrev - 1) * 100 : null
  const pw = view.permitWindow

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>住宅供給動能（行政區）</span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
          開工 → 使照 → 新屋交屋 → 待售新成屋；開工多代表未來 2–4 年完工量大；不計入村里指數
        </span>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)', marginBottom: 10 }}>
        全市 {view.y1} 年住宅開工 <b style={{ color: 'var(--text-strong)' }}>{fmt(view.cityStart)}</b> 戶
        {yoy != null && <span style={{ color: yoy >= 0 ? 'var(--negative)' : 'var(--positive)' }}>（較前一年 {yoy >= 0 ? '+' : ''}{yoy.toFixed(0)}%）</span>}
        {data.unsoldPeriod && <>；{data.unsoldPeriod} 待售新成屋 {fmt(data.unsold.reduce((s, u) => s + u.units, 0))} 宅</>}
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 520 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-card)' }}>
            <tr>
              <th style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'left', borderBottom: '1px solid var(--border-card)' }}>行政區</th>
              {th('startNow', `${view.y1 ?? ''} 開工戶數`)}
              {th(null, `${view.startYears[0] ?? ''}–${view.y1 ?? ''} 年均`)}
              {th('startPerK', '每千戶開工', '開工戶數 ÷ 區內現有戶數 × 1000，越高代表新供給相對既有規模越大')}
              {th('permitAvg', `使照戶數（${pw[0] ?? ''}–${pw.at(-1) ?? ''} 年均）`)}
              {th('delivered', '近 12 月新屋交屋')}
              {th('unsold', `待售新成屋（${data.unsoldPeriod ?? ''}）`)}
            </tr>
          </thead>
          <tbody>
            {view.rows.map(r => (
              <tr key={r.area} style={{ borderBottom: '1px solid var(--border-card)', background: r.area === highlightDistrict ? 'var(--accent-wash)' : undefined }}>
                <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>{r.area}</td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <div style={{ width: 56, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)' }}>
                      <div style={{ width: `${(r.startNow ?? 0) / maxStart * 100}%`, height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--accent)' }} />
                    </div>
                    <span style={{ minWidth: 44, color: 'var(--text-strong)', fontWeight: 600 }}>{fmt(r.startNow)}</span>
                  </div>
                </td>
                <td style={td}>{fmt(r.startAvg)}</td>
                <td style={td}>{fmt(r.startPerK, 1)}</td>
                <td style={td}>{fmt(r.permitAvg)}</td>
                <td style={td}>{fmt(r.delivered)}</td>
                <td style={td}>{fmt(r.unsold)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        點欄位標題可排序。開工戶數：臺南市工務局「建築物開工依用途別統計」住宅 H-2 類（行政區資料 112 年起）；
        使照戶數：工務局「使用執照資料」逐案彙整住宅類（官方資料停在 112 年 4 月，取最近 5 個完整年度平均）；
        新屋交屋：建物第一次移轉；待售新成屋：公會新建餘屋統計。建造執照只有全市資料，無行政區。
      </div>
    </div>
  )
}

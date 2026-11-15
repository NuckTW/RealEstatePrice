'use client'

// 由 Dashboard 透過 dynamic({ ssr: false }) 載入，可直接 import recharts
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea,
} from 'recharts'
import { useCssPx } from '@/hooks/useCssPx'
import { backfillMonths, incompleteRange } from '@/lib/backfill'

export interface TrendRow {
  period: string                 // 'YYYY-MM'
  count: number
  median_unit_price: number | null
}

/** 'YYYY-MM' → '115/04' */
function rocLabel(ym: string): string {
  return `${parseInt(ym.slice(0, 4)) - 1911}/${ym.slice(5, 7)}`
}

/**
 * 首頁 KPI 下方的月度量價走勢：柱＝成交筆數、線＝中位單價。
 * 資料最新的 2 個月仍在補登，用斜線底標示，避免被誤讀成量縮。
 */
export default function KpiTrend({ rows, lastDataDate }: { rows: TrendRow[]; lastDataDate: string | null }) {
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = { fontSize: axisFontSize, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }

  if (rows.length < 2) return null

  const months = backfillMonths(lastDataDate)
  const range = incompleteRange(rows.map(r => r.period), p => months.includes(p))

  return (
    <div style={{
      borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)',
      background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', padding: '10px 12px 4px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 2 }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>量價走勢（月）</span>
        <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', display: 'inline-flex', gap: 12, flexWrap: 'wrap' }}>
          <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--border-strong)', marginRight: 4 }} />成交筆數</span>
          <span><i style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--clay-500)', verticalAlign: 'middle', marginRight: 4 }} />中位單價（萬/坪）</span>
          {range && <span><i className="tra-hatch-swatch" />斜線＝補登中，數字會再增加</span>}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <pattern id="tra-backfill-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2.5" height="6" fill="var(--text-faint)" fillOpacity="0.35" />
            </pattern>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
          <XAxis dataKey="period" tickFormatter={rocLabel} tick={axisStyle} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis yAxisId="count" hide />
          <YAxis yAxisId="price" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} width={40} domain={['auto', 'auto']} />
          <Tooltip
            labelFormatter={l => rocLabel(String(l)) + (months.includes(String(l)) ? '（補登中）' : '')}
            formatter={(v, name) => name === 'count' ? [`${Number(v).toLocaleString()} 筆`, '成交'] : [`${v} 萬/坪`, '中位單價']}
            contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-default)' }}
          />
          {range && (
            <ReferenceArea yAxisId="count" x1={range.x1} x2={range.x2} fill="url(#tra-backfill-hatch)" fillOpacity={1} ifOverflow="extendDomain" />
          )}
          <Bar yAxisId="count" dataKey="count" fill="var(--border-strong)" radius={[2, 2, 0, 0]} maxBarSize={18} />
          <Line yAxisId="price" type="monotone" dataKey="median_unit_price" stroke="var(--clay-500)" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <style>{`.tra-hatch-swatch{display:inline-block;width:10px;height:8px;margin-right:4px;vertical-align:-1px;background:repeating-linear-gradient(45deg,var(--text-faint) 0 2px,transparent 2px 4px);opacity:.7}`}</style>
    </div>
  )
}

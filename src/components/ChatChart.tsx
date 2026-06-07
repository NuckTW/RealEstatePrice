'use client'

// 父元件 ChatInterface 用 dynamic({ ssr: false }) 載入此元件，
// 所以這裡可以安全地直接 import recharts（不會在 server 執行）
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { ChartConfig } from '@/app/api/chat/route'

// Brass & Clay 系列色
const SERIES_COLORS = [
  '#d9912a', // brass-500
  '#4ca8e0', // sky
  '#2bb3a3', // teal
  '#c0613d', // clay-500
  '#cda86a', // brass-300
  '#e0573f', // negative
]

const FRIENDLY: Record<string, string> = {
  avg_unit_price:    '平均單價(萬/坪)',
  unit_price:        '單價(萬/坪)',
  avg_total_price:   '平均總價(萬)',
  total_price:       '總價(萬)',
  transaction_count: '交易筆數',
  count:             '筆數',
  avg_price:         '均價',
  total_sales:       '總銷(億)',
}

const axisStyle = {
  fontSize: 10,
  fill: 'var(--text-muted)',
  fontFamily: 'var(--font-sans)',
}

const tooltipContentStyle = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-card)',
  borderRadius: 8,
  fontSize: 11,
  color: 'var(--text-default)',
}

// 格式化 X 軸 label（日期/月份清理）
function fmtXLabel(val: unknown): string {
  const s = String(val ?? '')
  // ISO datetime → YYYY-MM
  const isoMatch = s.match(/^(\d{4})-(\d{2})-\d{2}/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`
  // YYYY-MM-DD → YYYY-MM
  const dateMatch = s.match(/^(\d{4}-\d{2})/)
  if (dateMatch) return dateMatch[1]
  return s
}

interface Props {
  rows: Record<string, unknown>[]
  chart: ChartConfig
}

export default function ChatChart({ rows, chart }: Props) {
  const { type, xKey, yKeys } = chart

  const data = rows.map(r => {
    const entry: Record<string, unknown> = { [xKey]: fmtXLabel(r[xKey]) }
    for (const k of yKeys) entry[k] = Number(r[k]) || 0
    return entry
  })

  const chartHeight = Math.min(220, Math.max(160, rows.length * 22))

  const commonProps = {
    data,
    margin: { top: 8, right: 8, left: 0, bottom: 4 },
  }

  return (
    <div style={{
      marginTop: 12,
      background: 'var(--bg-sunken)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-card)',
      padding: '12px 8px 8px',
      width: '100%',
    }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        {type === 'bar' ? (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
            <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={52} />
            <Tooltip contentStyle={tooltipContentStyle} />
            {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
            {yKeys.map((k, i) => (
              <Bar
                key={k} dataKey={k}
                name={FRIENDLY[k] ?? k}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                radius={[3, 3, 0, 0]} maxBarSize={40}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
            <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={52} />
            <Tooltip contentStyle={tooltipContentStyle} />
            {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
            {yKeys.map((k, i) => (
              <Line
                key={k} type="monotone" dataKey={k}
                name={FRIENDLY[k] ?? k}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

'use client'

// 由 PriceIndexPanel / SupplyPanel 透過 dynamic({ ssr: false }) 載入
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { SERIES_COLORS } from './AnalysisChart'

interface Props {
  chartRows: Record<string, unknown>[]
  names: string[]
  unit?: string
  baseline?: number  // YoY 模式畫 0 線
  height?: number
}

export default function PriceIndexChart({ chartRows, names, unit = '', baseline, height = 420 }: Props) {
  const axisStyle = { fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={56}
          domain={['auto', 'auto']} tickFormatter={(v: number) => `${v}${unit}`} />
        <Tooltip
          contentStyle={{
            background: 'var(--surface-card)', border: '1px solid var(--border-card)',
            borderRadius: 8, fontSize: 11, color: 'var(--text-default)',
          }}
          formatter={(value) => (value == null ? '—' : `${value}${unit}`)}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {baseline != null && <ReferenceLine y={baseline} stroke="var(--text-faint)" strokeDasharray="4 4" />}
        {names.map((n, i) => (
          <Line key={n} type="monotone" dataKey={n}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={true}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

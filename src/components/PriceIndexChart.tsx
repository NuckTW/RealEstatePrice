'use client'

// 由 PriceIndexPanel / SupplyPanel 透過 dynamic({ ssr: false }) 載入
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { SERIES_COLORS } from './AnalysisChart'
import { useCssPx } from '@/hooks/useCssPx'

interface Props {
  chartRows: Record<string, unknown>[]
  names: string[]
  unit?: string
  baseline?: number  // YoY 模式畫 0 線
  height?: number
}

export default function PriceIndexChart({ chartRows, names, unit = '', baseline, height = 420 }: Props) {
  // tick 畫在 SVG 座標系裡，Recharts 內部用 canvas 量測文字寬度，吃不了 CSS var()，
  // 必須傳真正的數字 px；用 useCssPx 讀取換算後的實際值，字級切換時會自動重讀。
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = { fontSize: axisFontSize, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }

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
            borderRadius: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-default)',
          }}
          formatter={(value) => (value == null ? '—' : `${value}${unit}`)}
        />
        <Legend wrapperStyle={{ fontSize: 'var(--text-2xs)' }} />
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

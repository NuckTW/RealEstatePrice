'use client'

// 此檔案由 AnalysisPanel 透過 dynamic({ ssr: false }) 載入
// 因此可以安全地直接 import recharts
import {
  ResponsiveContainer, LineChart, BarChart,
  Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

export const SERIES_COLORS = [
  '#d9912a', '#4ca8e0', '#2bb3a3', '#c0613d',
  '#cda86a', '#a084d8', '#e0573f', '#5bb87a',
]

interface Props {
  chartRows: Record<string, unknown>[]
  districts: string[]
  chartType: 'line' | 'bar' | 'scatter'
  yDomain: [number | string, number | string]
  metricLabel: string
  height?: number
  compact?: boolean
}

export default function AnalysisChart({
  chartRows, districts, chartType, yDomain, metricLabel, height = 380, compact = false,
}: Props) {
  const axisStyle = {
    fontSize: compact ? 9 : 10,
    fill: 'var(--text-muted)',
    fontFamily: 'var(--font-sans)',
  }
  const tooltipStyle = {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 8,
    fontSize: 11,
    color: 'var(--text-default)',
  }

  const commonProps = {
    data: chartRows,
    margin: { top: 8, right: 16, left: 0, bottom: 4 },
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {chartType === 'bar' ? (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
          <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={compact ? 44 : 56} domain={yDomain} />
          <Tooltip contentStyle={tooltipStyle}
            formatter={(v) => [`${v} ${metricLabel}`, '']} />
          {!compact && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {districts.map((d, i) => (
            <Bar key={d} dataKey={d}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              radius={[3, 3, 0, 0]} maxBarSize={compact ? 16 : 24}
            />
          ))}
        </BarChart>
      ) : (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
          <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={compact ? 44 : 56} domain={yDomain} />
          <Tooltip contentStyle={tooltipStyle}
            formatter={(v) => [`${v} ${metricLabel}`, '']} />
          {!compact && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {districts.map((d, i) => (
            <Line key={d} type="monotone" dataKey={d}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={chartType === 'scatter' ? 0 : (compact ? 1.5 : 2)}
              dot={chartType === 'scatter'
                ? { r: compact ? 3 : 4, fill: SERIES_COLORS[i % SERIES_COLORS.length] }
                : { r: compact ? 0 : 2 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}

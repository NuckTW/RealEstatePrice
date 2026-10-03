'use client'

// 由 SouthParkSection 透過 dynamic({ ssr: false }) 載入
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useCssPx } from '@/hooks/useCssPx'

const tooltipStyle = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-default)',
}

export interface ParkPoint { label: string; total: number }

/** 南科從業員工數月趨勢（單一數列，標題已命名，不需圖例） */
export default function SouthParkChart({ rows, height = 260 }: { rows: ParkPoint[]; height?: number }) {
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = { fontSize: axisFontSize, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis
          tick={axisStyle} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']}
          tickFormatter={(v: number) => `${(v / 10000).toFixed(1)}萬`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [`${Number(v).toLocaleString()} 人`, '南科從業員工']}
        />
        <Line type="monotone" dataKey="total" stroke="#d9912a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

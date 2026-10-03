'use client'

// 由 MarketSection 透過 dynamic({ ssr: false }) 載入
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useCssPx } from '@/hooks/useCssPx'

const tooltipStyle = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-default)',
}

/** 分類色依固定順序指派：series-1 = 臺南市／新屋交屋，series-7 = 全國／買賣移轉 */
const C1 = '#d9912a'
const C2 = '#6e8ab0'

export interface TwoSeriesPoint { label: string; a: number | null; b: number | null }

/** 兩條同單位折線（同一軸），附圖例；用於「臺南市 vs 全國」與「新屋交屋 vs 買賣移轉」 */
export function TwoLineChart({ rows, nameA, nameB, unit, height = 200, digits = 2 }: {
  rows: TwoSeriesPoint[]; nameA: string; nameB: string; unit: string; height?: number; digits?: number
}) {
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = { fontSize: axisFontSize, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }
  const fmt = (v: unknown) => v == null ? '—' : `${Number(v).toLocaleString('zh-TW', { maximumFractionDigits: digits })}${unit}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} domain={['auto', 'auto']} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [fmt(v), name]} />
        <Legend wrapperStyle={{ fontSize: 'var(--text-2xs)' }} iconType="plainline" />
        <Line type="monotone" dataKey="a" name={nameA} stroke={C1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
        <Line type="monotone" dataKey="b" name={nameB} stroke={C2} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

export interface OnePoint { label: string; v: number | null }

/** 單一數列折線（標題已命名，不需圖例） */
export function OneLineChart({ rows, name, unit, height = 200, digits = 0, tickFormatter }: {
  rows: OnePoint[]; name: string; unit: string; height?: number; digits?: number
  tickFormatter?: (v: number) => string
}) {
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = { fontSize: axisFontSize, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} tickFormatter={tickFormatter} />
        <Tooltip contentStyle={tooltipStyle}
          formatter={(v) => [`${Number(v).toLocaleString('zh-TW', { maximumFractionDigits: digits })}${unit}`, name]} />
        <Line type="monotone" dataKey="v" name={name} stroke={C1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

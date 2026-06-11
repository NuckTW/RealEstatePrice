'use client'

// 由 SupplyPanel 透過 dynamic({ ssr: false }) 載入
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart,
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const axisStyle = { fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }
const tooltipStyle = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 8, fontSize: 11, color: 'var(--text-default)',
}

/** 建照/使照件數 + 實價登錄成交量疊圖（供需對照） */
export function PermitTxChart({ rows, height = 380 }: { rows: Record<string, unknown>[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis yAxisId="permit" tick={axisStyle} axisLine={false} tickLine={false} width={48} />
        <YAxis yAxisId="tx" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="permit" dataKey="building" name="建照核發（件）" fill="#d9912a" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar yAxisId="permit" dataKey="usage" name="使照核發（件）" fill="#4ca8e0" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Line yAxisId="tx" type="monotone" dataKey="txCount" name="實價登錄成交量（件）"
          stroke="#2bb3a3" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** 最新一季各行政區待售新成屋 */
export function UnsoldDistrictChart({ rows, height = 380 }: { rows: Record<string, unknown>[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="district" tick={{ ...axisStyle, fontSize: 9 }} axisLine={false} tickLine={false}
          interval={0} angle={-45} textAnchor="end" height={56} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="units" name="待售宅數" fill="#c0613d" radius={[3, 3, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** 全市待售新成屋季趨勢 */
export function UnsoldTrendChart({ rows, height = 380 }: { rows: Record<string, unknown>[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="quarter" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={56} domain={['auto', 'auto']} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="total" name="全市待售宅數"
          stroke="#a084d8" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

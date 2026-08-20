'use client'

// 由 SupplyPanel 透過 dynamic({ ssr: false }) 載入
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart,
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useCssPx } from '@/hooks/useCssPx'

// tooltip 是 Recharts 內建 contentStyle，套用在 HTML div 上，可以直接吃 CSS var()
const tooltipStyle = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-default)',
}

/** 建照/使照件數 + 實價登錄成交量疊圖（供需對照） */
export function PermitTxChart({ rows, height = 380 }: { rows: Record<string, unknown>[]; height?: number }) {
  // tick 畫在 SVG 座標系裡，Recharts 內部用 canvas 量測文字寬度，吃不了 CSS var()，
  // 必須傳真正的數字 px；用 useCssPx 讀取換算後的實際值，字級切換時會自動重讀。
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = { fontSize: axisFontSize, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis yAxisId="permit" tick={axisStyle} axisLine={false} tickLine={false} width={48} />
        <YAxis yAxisId="tx" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 'var(--text-2xs)' }} />
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
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = { fontSize: axisFontSize, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
        <XAxis dataKey="district" tick={axisStyle} axisLine={false} tickLine={false}
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
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = { fontSize: axisFontSize, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }
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

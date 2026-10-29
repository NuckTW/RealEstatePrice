'use client'

// 父元件 ChatInterface 用 dynamic({ ssr: false }) 載入此元件，
// 所以這裡可以安全地直接 import recharts（不會在 server 執行）
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { buildChartData, friendlyLabel, type ChartConfig } from '@/lib/chatData'
import { useCssPx } from '@/hooks/useCssPx'

// Brass & Clay 系列色
const SERIES_COLORS = [
  '#d9912a', // brass-500
  '#4ca8e0', // sky
  '#2bb3a3', // teal
  '#c0613d', // clay-500
  '#cda86a', // brass-300
  '#e0573f', // negative
]

// tooltip 是 Recharts 內建 contentStyle，套用在 HTML div 上，可以直接吃 CSS var()
const tooltipContentStyle = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-card)',
  borderRadius: 8,
  fontSize: 'var(--text-2xs)',
  color: 'var(--text-default)',
}

// y 軸刻度：1600000 → 160萬，避免長數字擠爆軸寬
const compactFmt = new Intl.NumberFormat('zh-TW', { notation: 'compact', maximumFractionDigits: 1 })
const fmtY = (v: number) => compactFmt.format(v)
const fmtTooltip = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('zh-TW') : String(v ?? '—'))

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
  const { type, xKey, yKeys, seriesKey } = chart

  // tick 是畫在 SVG 座標系裡，Recharts 內部用 canvas 量測文字寬度，吃不了 CSS var()，
  // 必須傳真正的數字 px；用 useCssPx 讀取換算後的實際值，字級切換時會自動重讀。
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = {
    fontSize: axisFontSize,
    fill: 'var(--text-muted)',
    fontFamily: 'var(--font-sans)',
  }

  // 有 seriesKey 時會長轉寬（例：每月 × 行政區 → 每區一條線）
  const { data, series } = buildChartData(rows, chart, fmtXLabel)

  // 圖上方的指標說明：只有一條時沒有 legend，要靠這行說明畫的是什麼
  const caption = seriesKey
    ? `${friendlyLabel(yKeys[0])}・依${friendlyLabel(seriesKey)}`
    : yKeys.map(friendlyLabel).join('、')

  const chartHeight = Math.min(220, Math.max(160, data.length * 22))

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
      <div style={{
        fontSize: 'var(--text-3xs)', color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)', padding: '0 4px 6px',
      }}>{caption}</div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        {type === 'bar' ? (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
            <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={52} tickFormatter={fmtY} />
            <Tooltip contentStyle={tooltipContentStyle} formatter={fmtTooltip} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 'var(--text-3xs)' }} />}
            {series.map((s, i) => (
              <Bar
                key={s.key} dataKey={s.key}
                name={s.label}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                radius={[3, 3, 0, 0]} maxBarSize={40}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
            <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={52} tickFormatter={fmtY} />
            <Tooltip contentStyle={tooltipContentStyle} formatter={fmtTooltip} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 'var(--text-3xs)' }} />}
            {series.map((s, i) => (
              <Line
                key={s.key} type="monotone" dataKey={s.key}
                name={s.label}
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

'use client'

// 此檔案由 AnalysisPanel 透過 dynamic({ ssr: false }) 載入
// 因此可以安全地直接 import recharts
import { useId } from 'react'
import {
  ResponsiveContainer, LineChart, BarChart,
  Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea,
} from 'recharts'
import { useCssPx } from '@/hooks/useCssPx'
import { useLastDataDate } from '@/hooks/useLastDataDate'
import { backfillMonths, incompleteRange, isIncompletePeriod } from '@/lib/backfill'

export const SERIES_COLORS = [
  '#d9912a', '#4ca8e0', '#2bb3a3', '#c0613d',
  '#cda86a', '#a084d8', '#e0573f', '#5bb87a',
]

interface RecordInfo {
  project_name: string | null
  address: string | null
  transaction_date: string | null
  is_presale: boolean | null
}

interface Props {
  chartRows: Record<string, unknown>[]
  districts: string[]
  chartType: 'line' | 'bar' | 'scatter'
  yDomain: [number | string, number | string]
  metricLabel: string
  height?: number
  compact?: boolean
  showRecord?: boolean
}

interface TooltipPayloadItem {
  dataKey?: string | number
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

export default function AnalysisChart({
  chartRows, districts, chartType, yDomain, metricLabel, height = 380, compact = false, showRecord = false,
}: Props) {
  // Recharts 的 tick 是畫在 SVG 座標系裡，內部量測文字用 canvas，吃不了 CSS var()，
  // 必須傳真正的數字 px；用 useCssPx 讀取換算後的實際值，字級切換時會自動重讀。
  // 註：compact 原本用 9px / 10px 做極細微區分，換算成 token 後兩者最近的都是 --text-3xs，
  // 這個 1px 差異就內含在同一個 token 裡了。
  const axisFontSize = useCssPx('--text-3xs', 10)
  const axisStyle = {
    fontSize: axisFontSize,
    fill: 'var(--text-muted)',
    fontFamily: 'var(--font-sans)',
  }
  // tooltip 是自訂 HTML div（非 SVG），可以直接吃 CSS var()
  const tooltipStyle = {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 8,
    fontSize: 'var(--text-2xs)',
    color: 'var(--text-default)',
  }

  const commonProps = {
    data: chartRows,
    margin: { top: 8, right: 16, left: 0, bottom: 4 },
  }

  // 補登期：資料最新 2 個月（或包含它們的季／年）還在補登，尾端畫斜線底提醒「數字還會變」
  const lastDataDate = useLastDataDate()
  const months = backfillMonths(lastDataDate)
  const backfill = incompleteRange(
    chartRows.map(r => String(r.period)),
    p => isIncompletePeriod(p, months),
    chartType !== 'bar',  // 折線圖 X 軸是點座標，單一點要往前延伸一格才畫得出區塊
  )
  const hatchId = `tra-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const backfillDefs = (
    <defs>
      <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="2.5" height="6" fill="var(--text-faint)" fillOpacity="0.3" />
      </pattern>
    </defs>
  )
  const backfillArea = backfill && (
    <ReferenceArea
      x1={backfill.x1} x2={backfill.x2}
      fill={`url(#${hatchId})`} fillOpacity={1} ifOverflow="extendDomain"
      label={compact ? undefined : { value: '補登中', position: 'insideTopRight', fill: 'var(--text-faint)', fontSize: axisFontSize }}
    />
  )

  function renderTooltip(props: { active?: boolean; payload?: readonly unknown[]; label?: string | number }) {
    const { active, label } = props
    const payload = (props.payload ?? []) as unknown as TooltipPayloadItem[]
    if (!active || !payload.length) return null
    return (
      <div style={{ ...tooltipStyle, padding: '8px 10px' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((item, i) => {
          const key = String(item.dataKey ?? '')
          const rec = showRecord ? (item.payload?.[`${key}__rec`] as RecordInfo | null | undefined) : null
          return (
            <div key={i} style={{ marginBottom: rec ? 6 : 2 }}>
              <span style={{ color: item.color }}>● {key}</span>
              <span>：{item.value} {metricLabel}</span>
              {rec && (
                <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', marginLeft: 14, marginTop: 2 }}>
                  {rec.project_name || rec.address || '（無建案資訊）'}
                  {rec.transaction_date ? ` · ${rec.transaction_date}` : ''}
                  {rec.is_presale != null ? ` · ${rec.is_presale ? '預售屋' : '成屋'}` : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {chartType === 'bar' ? (
        <BarChart {...commonProps}>
          {backfillDefs}
          {backfillArea}
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
          <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={compact ? 44 : 56} domain={yDomain} />
          <Tooltip content={renderTooltip} />
          {!compact && <Legend wrapperStyle={{ fontSize: 'var(--text-2xs)' }} />}
          {districts.map((d, i) => (
            <Bar key={d} dataKey={d}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              radius={[3, 3, 0, 0]} maxBarSize={compact ? 16 : 24}
            />
          ))}
        </BarChart>
      ) : (
        <LineChart {...commonProps}>
          {backfillDefs}
          {backfillArea}
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
          <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={compact ? 44 : 56} domain={yDomain} />
          <Tooltip content={renderTooltip} />
          {!compact && <Legend wrapperStyle={{ fontSize: 'var(--text-2xs)' }} />}
          {districts.map((d, i) => (
            <Line key={d} type="monotone" dataKey={d}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={chartType === 'scatter' ? 0 : (compact ? 1.5 : 2)}
              dot={chartType === 'scatter'
                ? { r: compact ? 3 : 4, fill: SERIES_COLORS[i % SERIES_COLORS.length] }
                : { r: compact ? 0 : 2 }}
              activeDot={{ r: 5 }}
              connectNulls={true}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}

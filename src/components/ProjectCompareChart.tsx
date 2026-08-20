'use client'

// 由 ProjectComparePanel 透過 dynamic({ ssr: false }) 載入
import {
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Label, Cell,
} from 'recharts'
import type { ProjectPoint } from './ProjectComparePanel'
import { useCssPx } from '@/hooks/useCssPx'

interface Props {
  points: ProjectPoint[]
  isoLines: number[]      // 總價等值線（萬）
  height?: number
}

const UNRELIABLE = 'var(--text-faint)'
const RELIABLE = '#4ca8e0'

/** 等值線本身不畫點，只在最後一點渲染金額標籤
 *  刻意例外（不跟隨字級縮放）：這是畫在散佈圖資料座標系裡的等值線標籤，
 *  字級縮放是版面/排版需求，這裡的文字大小要跟著圖形座標系走，放大會跟曲線位置脫節、破圖。 */
function isoShape(props: { cx?: number; cy?: number; payload?: { isoLabel?: string } }) {
  const { cx, cy, payload } = props
  if (!payload?.isoLabel || cx == null || cy == null) return <g />
  return (
    <text x={cx - 4} y={cy - 5} textAnchor="end"
      style={{ fontSize: 9, fill: 'var(--text-faint)' }}>{payload.isoLabel}</text>
  )
}

interface TipProps { active?: boolean; payload?: { payload: ProjectPoint }[] }

function Tip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={{
      background: 'var(--surface-card)', border: '1px solid var(--border-card)',
      borderRadius: 8, padding: '8px 10px', fontSize: 'var(--text-2xs)',
      color: 'var(--text-default)', fontFamily: 'var(--font-sans)', lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
      <div style={{ color: 'var(--text-muted)' }}>{p.district}｜{p.buildingType}</div>
      <div>{p.priceMedian} 萬/坪 × {p.areaMedian} 坪 = {p.totalMedian} 萬</div>
      {p.priceP25 != null && <div>P25–P75：{p.priceP25}–{p.priceP75} 萬</div>}
      <div>{p.txCount} 筆｜{p.firstTx}～{p.lastTx}</div>
      {!p.reliable && (
        <div style={{ color: 'var(--negative)', marginTop: 2 }}>樣本不足，僅供參考</div>
      )}
    </div>
  )
}

export default function ProjectCompareChart({ points, isoLines, height = 460 }: Props) {
  // tick / <Label> 畫在 SVG 座標系裡，Recharts 內部用 canvas 量測文字寬度，吃不了 CSS var()，
  // 必須傳真正的數字 px；用 useCssPx 讀取換算後的實際值，字級切換時會自動重讀。
  const axisFontSize = useCssPx('--text-3xs', 10)
  const labelFontSize = useCssPx('--text-2xs', 11)
  const axisStyle = { fontSize: axisFontSize, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }

  const xs = points.map(p => p.areaMedian)
  const ys = points.map(p => p.priceMedian)
  const xMin = Math.max(0, Math.min(...xs) * 0.85)
  const xMax = Math.max(...xs) * 1.15
  const yMin = Math.max(0, Math.min(...ys) * 0.85)
  const yMax = Math.max(...ys) * 1.15

  // 總價 = 單價 × 坪數，故等值線為 y = T / x
  const isoData = isoLines.map(t => {
    const pts: { x: number; y: number; isoLabel?: string }[] = []
    for (let x = xMin; x <= xMax; x += (xMax - xMin) / 60) {
      const y = t / x
      if (y >= yMin && y <= yMax) pts.push({ x, y })
    }
    // 曲線最後一點掛上金額，供 shape 渲染成文字標籤
    if (pts.length) pts[pts.length - 1] = { ...pts[pts.length - 1], isoLabel: `${t}萬` }
    return { total: t, pts }
  }).filter(l => l.pts.length > 1)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 24, left: 4, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" />
        <XAxis type="number" dataKey="x" domain={[xMin, xMax]} tick={axisStyle}
          axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v)}`}>
          <Label value="中位坪數" position="insideBottom" offset={-12}
            style={{ fontSize: labelFontSize, fill: 'var(--text-muted)' }} />
        </XAxis>
        <YAxis type="number" dataKey="y" domain={[yMin, yMax]} tick={axisStyle}
          axisLine={false} tickLine={false} width={56}
          tickFormatter={(v: number) => `${Math.round(v)}萬`}>
          <Label value="中位單價（萬/坪）" angle={-90} position="insideLeft"
            style={{ fontSize: labelFontSize, fill: 'var(--text-muted)', textAnchor: 'middle' }} />
        </YAxis>
        <ZAxis type="number" dataKey="z" range={[60, 900]} />

        {/* 總價等值線是曲線（y = T/x），ReferenceLine 的 segment 只吃兩個端點畫不出來，
            改用隱形點的 Scatter 搭配 line 連成曲線 */}
        {isoData.map(l => (
          <Scatter key={l.total} data={l.pts} legendType="none" isAnimationActive={false}
            line={{ stroke: 'var(--text-faint)', strokeWidth: 1, strokeDasharray: '4 4' }}
            shape={isoShape} tooltipType="none" />
        ))}

        <Tooltip content={<Tip />} cursor={{ strokeDasharray: '3 3' }} />
        <Scatter
          data={points.map(p => ({ ...p, x: p.areaMedian, y: p.priceMedian, z: p.txCount }))}
          fillOpacity={0.55}
        >
          {points.map(p => (
            <Cell key={p.key}
              fill={p.reliable ? RELIABLE : UNRELIABLE}
              stroke={p.reliable ? RELIABLE : UNRELIABLE} strokeWidth={2} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}

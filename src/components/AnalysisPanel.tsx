'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
// 此元件由 page.tsx 透過 dynamic({ ssr: false }) 載入，所以可以直接 import recharts
import {
  ResponsiveContainer, LineChart, BarChart,
  Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

/* ── Constants ──────────────────────────────────────────── */
const SERIES_COLORS = [
  '#d9912a', '#4ca8e0', '#2bb3a3', '#c0613d',
  '#cda86a', '#a084d8', '#e0573f', '#5bb87a',
]

const ALL_DISTRICTS = [
  '東區','西區','南區','北區','中西區','安平區','安南區',
  '永康區','歸仁區','新化區','左鎮區','玉井區','楠西區','南化區',
  '仁德區','關廟區','龍崎區','官田區','麻豆區','佳里區','西港區',
  '七股區','將軍區','學甲區','北門區','新營區','後壁區','白河區',
  '東山區','六甲區','下營區','柳營區','鹽水區','善化區','大內區',
  '山上區','新市區','安定區',
]

const METRICS = [
  { key: 'unit_price',  label: '單價(萬/坪)' },
  { key: 'total_price', label: '均總價(萬)'  },
  { key: 'area',        label: '坪數'        },
  { key: 'parking',     label: '車位(萬)'    },
  { key: 'count',       label: '交易量(筆)'  },
  { key: 'sales',       label: '總銷(億)'    },
]

const GRANULARITIES = [
  { key: 'month',   label: '月' },
  { key: 'quarter', label: '季' },
  { key: 'year',    label: '年' },
]

const CHART_TYPES = [
  { key: 'line',    label: '〜 折線' },
  { key: 'bar',     label: '▦ 長條' },
  { key: 'scatter', label: '· 點圖' },
]

/* ── Types ──────────────────────────────────────────────── */
interface SeriesData {
  district: string
  data: { period: string; value: number | null }[]
}

interface AnalysisData {
  periods: string[]
  series: SeriesData[]
  districts: string[]
}

/* ── Helpers ─────────────────────────────────────────────── */
function pill(active: boolean, onClick: () => void, label: string, color?: string) {
  return (
    <button
      key={label}
      onClick={onClick}
      style={{
        height: 28, padding: '0 12px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)', fontWeight: active ? 600 : 400,
        fontFamily: 'var(--font-sans)',
        background: active ? (color ?? 'var(--accent-wash)') : 'transparent',
        color: active ? (color ? '#fff' : 'var(--accent-tint)') : 'var(--text-muted)',
        border: active ? `1px solid ${color ?? 'var(--accent-wash-border)'}` : '1px solid var(--border-control)',
        cursor: 'pointer', transition: 'var(--transition-base)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function sectionLabel(text: string) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--text-faint)',
      fontFamily: 'var(--font-sans)', marginBottom: 6,
    }}>
      {text}
    </div>
  )
}

/* ── Save chart as PNG ──────────────────────────────────── */
async function saveChartAsPng(chartDivRef: React.RefObject<HTMLDivElement | null>, filename: string) {
  const div = chartDivRef.current
  if (!div) return
  const svg = div.querySelector('svg')
  if (!svg) return

  const svgClone = svg.cloneNode(true) as SVGSVGElement
  // inject background
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('width', '100%')
  rect.setAttribute('height', '100%')
  rect.setAttribute('fill', '#faf6ee')
  svgClone.insertBefore(rect, svgClone.firstChild)

  const w = svg.clientWidth  || 800
  const h = svg.clientHeight || 400
  svgClone.setAttribute('width', String(w))
  svgClone.setAttribute('height', String(h))

  const svgStr = new XMLSerializer().serializeToString(svgClone)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width  = w * 2  // retina
    canvas.height = h * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    canvas.toBlob(b => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = filename + '.png'
      a.click()
    }, 'image/png')
  }
  img.src = url
}

/* ── Main Component ─────────────────────────────────────── */
export default function AnalysisPanel() {
  // filters
  const [metric,      setMetric]      = useState('unit_price')
  const [granularity, setGranularity] = useState('quarter')
  const [chartType,   setChartType]   = useState('line')
  const [presale,     setPresale]     = useState('all')
  const [yearFrom,    setYearFrom]    = useState(110)  // 民國
  const [yearTo,      setYearTo]      = useState(115)
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([])

  // Y axis manual range
  const [yMin, setYMin] = useState('')
  const [yMax, setYMax] = useState('')

  // data
  const [data,    setData]    = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved,   setSaved]   = useState<{ label: string; data: AnalysisData; metric: string }[]>([])

  // refs
  const chartDivRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (overrideDistricts?: string[]) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({
        metric,
        granularity,
        presale,
        yearFrom: String(yearFrom),
        yearTo:   String(yearTo),
      })
      const districts = overrideDistricts ?? selectedDistricts
      if (districts.length > 0) p.set('districts', districts.join(','))

      const res  = await fetch(`/api/analysis?${p}`)
      const json = await res.json()
      setData(json)
      // 初次載入時，同步 selectedDistricts 為 API 回的前5大
      if (!selectedDistricts.length && json.districts?.length) {
        setSelectedDistricts(json.districts)
      }
    } finally {
      setLoading(false)
    }
  }, [metric, granularity, presale, yearFrom, yearTo, selectedDistricts])

  useEffect(() => { fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDistrict = (d: string) => {
    setSelectedDistricts(prev => {
      if (prev.includes(d)) return prev.filter(x => x !== d)
      if (prev.length >= 8) return prev  // 最多8條線
      return [...prev, d]
    })
  }

  const handleApply = () => fetchData()

  const handleSave = () => {
    if (!data) return
    const metricLabel = METRICS.find(m => m.key === metric)?.label ?? metric
    const label = `${metricLabel} · ${GRANULARITIES.find(g => g.key === granularity)?.label} · ${yearFrom}～${yearTo}`
    setSaved(prev => [{ label, data, metric }, ...prev.slice(0, 4)])
  }

  const handleExportPng = () => {
    const metricLabel = METRICS.find(m => m.key === metric)?.label ?? metric
    saveChartAsPng(chartDivRef, `台南不動產_${metricLabel}_${new Date().toISOString().slice(0, 10)}`)
  }

  /* ── Build chart data ── */
  const chartRows = (data?.periods ?? []).map(period => {
    const row: Record<string, unknown> = { period }
    data?.series.forEach(s => { row[s.district] = s.data.find(d => d.period === period)?.value ?? null })
    return row
  })

  const yDomain: [number | string, number | string] = [
    yMin !== '' ? Number(yMin) : 'auto',
    yMax !== '' ? Number(yMax) : 'auto',
  ]

  const metricLabel = METRICS.find(m => m.key === metric)?.label ?? ''
  const axisStyle = { fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }
  const tooltipStyle = {
    background: 'var(--surface-card)', border: '1px solid var(--border-card)',
    borderRadius: 8, fontSize: 11, color: 'var(--text-default)',
  }

  const commonChartProps = {
    data: chartRows,
    margin: { top: 8, right: 16, left: 0, bottom: 4 },
  }

  const districts = data?.series.map(s => s.district) ?? []

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── 控制列 ── */}
      <div style={{
        background: 'var(--surface-card)', border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-xl)', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: 'var(--shadow-card)',
      }}>

        {/* Row 1: 指標 + 時間粒度 + 圖表類型 */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* 指標 */}
          <div>
            {sectionLabel('指標')}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {METRICS.map(m => pill(metric === m.key, () => setMetric(m.key), m.label))}
            </div>
          </div>

          {/* 粒度 */}
          <div>
            {sectionLabel('時間粒度')}
            <div style={{ display: 'flex', gap: 6 }}>
              {GRANULARITIES.map(g => pill(granularity === g.key, () => setGranularity(g.key), g.label))}
            </div>
          </div>

          {/* 圖表類型 */}
          <div>
            {sectionLabel('圖表類型')}
            <div style={{ display: 'flex', gap: 6 }}>
              {CHART_TYPES.map(c => pill(chartType === c.key, () => setChartType(c.key), c.label))}
            </div>
          </div>

          {/* 預售/成屋 */}
          <div>
            {sectionLabel('類型')}
            <div style={{ display: 'flex', gap: 6 }}>
              {[['all','全部'],['true','預售'],['false','成屋']].map(([v, l]) =>
                pill(presale === v, () => setPresale(v), l)
              )}
            </div>
          </div>
        </div>

        {/* Row 2: 時間範圍 + Y軸調整 */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {/* 時間範圍 */}
          <div>
            {sectionLabel('時間範圍（民國）')}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" value={yearFrom} onChange={e => setYearFrom(Number(e.target.value))}
                min={100} max={yearTo} style={inputStyle()} />
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>～</span>
              <input type="number" value={yearTo} onChange={e => setYearTo(Number(e.target.value))}
                min={yearFrom} max={120} style={inputStyle()} />
              <span style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-sans)' }}>年</span>
            </div>
          </div>

          {/* Y軸範圍 */}
          <div>
            {sectionLabel('Y 軸範圍（留空=自動）')}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input placeholder="最小" value={yMin} onChange={e => setYMin(e.target.value)}
                style={inputStyle(80)} />
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>～</span>
              <input placeholder="最大" value={yMax} onChange={e => setYMax(e.target.value)}
                style={inputStyle(80)} />
            </div>
          </div>

          {/* Apply */}
          <button onClick={handleApply} disabled={loading} style={{
            height: 32, padding: '0 20px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)', fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            background: 'var(--gradient-accent)', color: 'var(--on-accent)',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, boxShadow: 'var(--glow-accent)',
          }}>
            {loading ? '載入中…' : '套用'}
          </button>
        </div>

        {/* Row 3: 行政區多選 */}
        <div>
          {sectionLabel(`行政區（最多8區，已選 ${selectedDistricts.length}）`)}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_DISTRICTS.map((d, i) => {
              const idx = selectedDistricts.indexOf(d)
              const isSelected = idx >= 0
              const color = isSelected ? SERIES_COLORS[idx % SERIES_COLORS.length] : undefined
              return pill(isSelected, () => toggleDistrict(d), d, color)
            })}
          </div>
        </div>
      </div>

      {/* ── 圖表區 ── */}
      <div style={{
        background: 'var(--surface-card)', border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-xl)', padding: '16px 20px',
        boxShadow: 'var(--shadow-card)',
      }}>

        {/* 圖表 header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-strong)', fontFamily: 'var(--font-sans)' }}>
            {metricLabel}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              {districts.join(' · ')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} style={ghostBtn()}>◎ 記錄</button>
            <button onClick={handleExportPng} style={ghostBtn()}>↓ 儲存 PNG</button>
          </div>
        </div>

        {/* Chart */}
        <div ref={chartDivRef} style={{ width: '100%', height: 380 }}>
          {loading ? (
            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              載入中…
            </div>
          ) : chartRows.length === 0 ? (
            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              無資料，請調整篩選條件
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              {chartType === 'bar' ? (
                <BarChart {...commonChartProps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
                  <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={56} domain={yDomain} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ${metricLabel}`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {districts.map((d, i) => (
                    <Bar key={d} dataKey={d} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[3,3,0,0]} maxBarSize={24} />
                  ))}
                </BarChart>
              ) : (
                <LineChart {...commonChartProps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
                  <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={56} domain={yDomain} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ${metricLabel}`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {districts.map((d, i) => (
                    <Line
                      key={d} type="monotone" dataKey={d}
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      strokeWidth={chartType === 'scatter' ? 0 : 2}
                      dot={chartType === 'scatter' ? { r: 4, fill: SERIES_COLORS[i % SERIES_COLORS.length] } : { r: 2 }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── 記錄的圖 ── */}
      {saved.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            已記錄的圖（{saved.length}）
          </div>
          {saved.map((s, si) => (
            <SavedChart key={si} saved={s} onRemove={() => setSaved(prev => prev.filter((_, i) => i !== si))} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Saved Chart ─────────────────────────────────────────── */
function SavedChart({
  saved, onRemove,
}: {
  saved: { label: string; data: AnalysisData; metric: string }
  onRemove: () => void
}) {
  const chartDivRef = useRef<HTMLDivElement>(null)
  const { data, label, metric } = saved
  const metricLabel = METRICS.find(m => m.key === metric)?.label ?? metric

  const chartRows = (data.periods ?? []).map(period => {
    const row: Record<string, unknown> = { period }
    data.series.forEach(s => { row[s.district] = s.data.find(d => d.period === period)?.value ?? null })
    return row
  })
  const districts = data.series.map(s => s.district)

  const axisStyle = { fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }
  const tooltipStyle = { background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 8, fontSize: 11 }

  return (
    <div style={{
      background: 'var(--surface-card)', border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-xl)', padding: '14px 18px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{label}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => saveChartAsPng(chartDivRef, `記錄_${label}`)} style={ghostBtn()}>↓ PNG</button>
          <button onClick={onRemove} style={{ ...ghostBtn(), color: 'var(--negative)' }}>✕</button>
        </div>
      </div>
      <div ref={chartDivRef} style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
            <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ${metricLabel}`, '']} />
            {districts.map((d, i) => (
              <Line key={d} type="monotone" dataKey={d} stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={1.5} dot={false} connectNulls={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ── Style helpers ───────────────────────────────────────── */
function inputStyle(width = 64): React.CSSProperties {
  return {
    width, height: 32, padding: '0 10px',
    background: 'var(--surface-control)',
    color: 'var(--text-default)',
    border: '1px solid var(--border-control)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  }
}

function ghostBtn(): React.CSSProperties {
  return {
    height: 26, padding: '0 10px',
    borderRadius: 'var(--radius-md)',
    fontSize: 11, fontFamily: 'var(--font-sans)',
    background: 'var(--surface-control)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-control)',
    cursor: 'pointer',
  }
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { SERIES_COLORS } from './AnalysisChart'

const AnalysisChart = dynamic(() => import('./AnalysisChart'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
      圖表載入中…
    </div>
  ),
})

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

interface SeriesData {
  district: string
  data: { period: string; value: number | null }[]
}
interface AnalysisData {
  periods: string[]
  series: SeriesData[]
  districts: string[]
}
type ChartType = 'line' | 'bar' | 'scatter'

function pill(active: boolean, onClick: () => void, label: string, color?: string) {
  return (
    <button key={label} onClick={onClick} style={{
      height: 28, padding: '0 12px', borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)', fontWeight: active ? 600 : 400, fontFamily: 'var(--font-sans)',
      background: active ? (color ?? 'var(--accent-wash)') : 'transparent',
      color: active ? (color ? '#fff' : 'var(--accent-tint)') : 'var(--text-muted)',
      border: active ? `1px solid ${color ?? 'var(--accent-wash-border)'}` : '1px solid var(--border-control)',
      cursor: 'pointer', transition: 'var(--transition-base)', whiteSpace: 'nowrap' as const,
    }}>{label}</button>
  )
}

function sectionLabel(text: string) {
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>{text}</div>
}

function numInput(value: number | string, onChange: (v: string) => void, extra?: Partial<React.InputHTMLAttributes<HTMLInputElement>>, width = 64): React.ReactElement {
  return <input value={value} onChange={e => onChange(e.target.value)} style={{ width, height: 32, padding: '0 10px', background: 'var(--surface-control)', color: 'var(--text-default)', border: '1px solid var(--border-control)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none' }} {...extra} />
}

function ghostBtn(): React.CSSProperties {
  return { height: 26, padding: '0 10px', borderRadius: 'var(--radius-md)', fontSize: 11, fontFamily: 'var(--font-sans)', background: 'var(--surface-control)', color: 'var(--text-muted)', border: '1px solid var(--border-control)', cursor: 'pointer' }
}

async function saveChartAsPng(ref: React.RefObject<HTMLDivElement | null>, filename: string) {
  const svg = ref.current?.querySelector('svg')
  if (!svg) return
  const clone = svg.cloneNode(true) as SVGSVGElement
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%'); rect.setAttribute('fill', '#faf6ee')
  clone.insertBefore(rect, clone.firstChild)
  const w = svg.clientWidth || 800, h = svg.clientHeight || 400
  clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h))
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w * 2; canvas.height = h * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2); ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url)
    canvas.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename + '.png'; a.click() }, 'image/png')
  }
  img.src = url
}

export default function AnalysisPanel() {
  const [metric,            setMetric]            = useState('unit_price')
  const [granularity,       setGranularity]       = useState('quarter')
  const [chartType,         setChartType]         = useState<ChartType>('line')
  const [presale,           setPresale]           = useState('all')
  const [yearFrom,          setYearFrom]          = useState(110)
  const [yearTo,            setYearTo]            = useState(115)
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([])
  const [yMin,  setYMin]  = useState('')
  const [yMax,  setYMax]  = useState('')
  const [data,    setData]    = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved,   setSaved]   = useState<{ label: string; data: AnalysisData; metric: string }[]>([])
  const chartDivRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (overrideDistricts?: string[]) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ metric, granularity, presale, yearFrom: String(yearFrom), yearTo: String(yearTo) })
      const dists = overrideDistricts ?? selectedDistricts
      if (dists.length > 0) p.set('districts', dists.join(','))
      const json = await fetch(`/api/analysis?${p}`).then(r => r.json())
      setData(json)
      if (!selectedDistricts.length && json.districts?.length) setSelectedDistricts(json.districts)
    } finally { setLoading(false) }
  }, [metric, granularity, presale, yearFrom, yearTo, selectedDistricts])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const toggleDistrict = (d: string) => setSelectedDistricts(prev => {
    if (prev.includes(d)) return prev.filter(x => x !== d)
    if (prev.length >= 8) return prev
    return [...prev, d]
  })

  const handleSave = () => {
    if (!data) return
    const ml = METRICS.find(m => m.key === metric)?.label ?? metric
    const gl = GRANULARITIES.find(g => g.key === granularity)?.label
    setSaved(prev => [{ label: `${ml} · ${gl} · ${yearFrom}～${yearTo}`, data, metric }, ...prev.slice(0, 4)])
  }

  const chartRows = (data?.periods ?? []).map(period => {
    const row: Record<string, unknown> = { period }
    data?.series.forEach(s => { row[s.district] = s.data.find(d => d.period === period)?.value ?? null })
    return row
  })
  const yDomain: [number | string, number | string] = [yMin !== '' ? Number(yMin) : 'auto', yMax !== '' ? Number(yMax) : 'auto']
  const metricLabel = METRICS.find(m => m.key === metric)?.label ?? ''
  const districts = data?.series.map(s => s.district) ?? []

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* 控制列 */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--shadow-card)' }}>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>{sectionLabel('指標')}<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{METRICS.map(m => pill(metric === m.key, () => setMetric(m.key), m.label))}</div></div>
          <div>{sectionLabel('時間粒度')}<div style={{ display: 'flex', gap: 6 }}>{GRANULARITIES.map(g => pill(granularity === g.key, () => setGranularity(g.key), g.label))}</div></div>
          <div>{sectionLabel('圖表類型')}<div style={{ display: 'flex', gap: 6 }}>{CHART_TYPES.map(c => pill(chartType === c.key, () => setChartType(c.key as ChartType), c.label))}</div></div>
          <div>{sectionLabel('類型')}<div style={{ display: 'flex', gap: 6 }}>{([['all','全部'],['true','預售'],['false','成屋']] as [string,string][]).map(([v,l]) => pill(presale === v, () => setPresale(v), l))}</div></div>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            {sectionLabel('時間範圍（民國）')}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {numInput(yearFrom, v => setYearFrom(Number(v)), { type: 'number', min: 100, max: yearTo })}
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>～</span>
              {numInput(yearTo, v => setYearTo(Number(v)), { type: 'number', min: yearFrom, max: 120 })}
              <span style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-sans)' }}>年</span>
            </div>
          </div>
          <div>
            {sectionLabel('Y 軸範圍（留空=自動）')}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {numInput(yMin, setYMin, { placeholder: '最小' }, 80)}
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>～</span>
              {numInput(yMax, setYMax, { placeholder: '最大' }, 80)}
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading} style={{ height: 32, padding: '0 20px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-sans)', background: 'var(--gradient-accent)', color: 'var(--on-accent)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, boxShadow: 'var(--glow-accent)' }}>
            {loading ? '載入中…' : '套用'}
          </button>
        </div>

        <div>
          {sectionLabel(`行政區（最多 8 區，已選 ${selectedDistricts.length}）`)}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_DISTRICTS.map(d => {
              const idx = selectedDistricts.indexOf(d)
              return pill(idx >= 0, () => toggleDistrict(d), d, idx >= 0 ? SERIES_COLORS[idx % SERIES_COLORS.length] : undefined)
            })}
          </div>
        </div>
      </div>

      {/* 圖表 */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: '16px 20px', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-strong)', fontFamily: 'var(--font-sans)' }}>
            {metricLabel}<span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>{districts.join(' · ')}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} style={ghostBtn()}>◎ 記錄</button>
            <button onClick={() => saveChartAsPng(chartDivRef, `台南不動產_${metricLabel}_${new Date().toISOString().slice(0,10)}`)} style={ghostBtn()}>↓ 儲存 PNG</button>
          </div>
        </div>
        <div ref={chartDivRef} style={{ width: '100%', height: 380 }}>
          {loading ? (
            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>載入中…</div>
          ) : chartRows.length === 0 ? (
            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>無資料，請調整篩選條件後按「套用」</div>
          ) : (
            <AnalysisChart chartRows={chartRows} districts={districts} chartType={chartType} yDomain={yDomain} metricLabel={metricLabel} height={380} />
          )}
        </div>
      </div>

      {/* 已記錄 */}
      {saved.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>已記錄的圖（{saved.length}）</div>
          {saved.map((s, si) => <SavedChart key={si} saved={s} onRemove={() => setSaved(prev => prev.filter((_, i) => i !== si))} />)}
        </div>
      )}
    </div>
  )
}

function SavedChart({ saved, onRemove }: { saved: { label: string; data: AnalysisData; metric: string }; onRemove: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const ml  = METRICS.find(m => m.key === saved.metric)?.label ?? saved.metric
  const chartRows = (saved.data.periods ?? []).map(period => {
    const row: Record<string, unknown> = { period }
    saved.data.series.forEach(s => { row[s.district] = s.data.find(d => d.period === period)?.value ?? null })
    return row
  })
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: '14px 18px', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{saved.label}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => saveChartAsPng(ref, `記錄_${saved.label}`)} style={ghostBtn()}>↓ PNG</button>
          <button onClick={onRemove} style={{ ...ghostBtn(), color: 'var(--negative)' }}>✕</button>
        </div>
      </div>
      <div ref={ref} style={{ width: '100%', height: 200 }}>
        <AnalysisChart chartRows={chartRows} districts={saved.data.series.map(s => s.district)} chartType="line" yDomain={['auto','auto']} metricLabel={ml} height={200} compact />
      </div>
    </div>
  )
}

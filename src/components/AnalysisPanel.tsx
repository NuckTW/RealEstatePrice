'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { SERIES_COLORS } from './AnalysisChart'

const AnalysisChart = dynamic(() => import('./AnalysisChart'), {
  ssr: false,
  loading: () => <div style={centerStyle(380)}>圖表載入中…</div>,
})

/* ── Constants ──────────────────────────────────────────── */
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

const BUILDING_TYPES = [
  { key: '', label: '全部類型' },
  { key: '住宅大樓(11層含以上有電梯)', label: '住宅大樓' },
  { key: '華廈(10層含以下有電梯)',     label: '華廈'    },
  { key: '透天厝',                     label: '透天厝'  },
  { key: '公寓(5樓含以下無電梯)',       label: '公寓'    },
  { key: '店面(店鋪)',                 label: '店面'    },
]

const ROOM_TYPES = [
  { key: '',   label: '全部房型' },
  { key: '1',  label: '1房' },
  { key: '2',  label: '2房' },
  { key: '3',  label: '3房' },
  { key: '4',  label: '4房' },
  { key: '5+', label: '5房以上' },
]

// 支援「最高 / 最低」統計的指標（需有單筆交易數值可比較）
const STAT_SUPPORTED = new Set(['unit_price', 'total_price', 'area', 'parking'])

const STATS = [
  { key: 'avg', label: '平均' },
  { key: 'max', label: '最高' },
  { key: 'min', label: '最低' },
]

const CHART_TYPES = [
  { key: 'line',    label: '〜 折線' },
  { key: 'bar',     label: '▦ 長條' },
  { key: 'scatter', label: '· 點圖' },
]

const YEARS  = Array.from({ length: 21 }, (_, i) => 100 + i) // 民國100~120
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/* ── Types ──────────────────────────────────────────────── */
interface RecordInfo {
  project_name: string | null
  address: string | null
  transaction_date: string | null
  is_presale: boolean | null
}
interface SeriesData { district: string; data: { period: string; value: number | null; record?: RecordInfo | null }[] }
interface AnalysisData { periods: string[]; series: SeriesData[]; districts: string[]; stat?: 'avg' | 'max' | 'min' }
type ChartType = 'line' | 'bar' | 'scatter'

/* ── Style Helpers ───────────────────────────────────────── */
function centerStyle(h: number): React.CSSProperties {
  return { height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-sans)' }
}

function selectStyle(): React.CSSProperties {
  return {
    height: 32, padding: '0 10px', paddingRight: 28,
    background: 'var(--surface-control)', color: 'var(--text-default)',
    border: '1px solid var(--border-control)', borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
    outline: 'none', cursor: 'pointer',
    appearance: 'none' as const, WebkitAppearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  }
}

function ghostBtn(): React.CSSProperties {
  return { height: 26, padding: '0 10px', borderRadius: 'var(--radius-md)', fontSize: 11, fontFamily: 'var(--font-sans)', background: 'var(--surface-control)', color: 'var(--text-muted)', border: '1px solid var(--border-control)', cursor: 'pointer' }
}

function label(text: string) {
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', marginBottom: 5 }}>{text}</div>
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

/* ── District Dropdown ───────────────────────────────────── */
function DistrictDropdown({ selected, onChange }: { selected: string[]; onChange: (d: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (d: string) => {
    if (selected.includes(d)) onChange(selected.filter(x => x !== d))
    else if (selected.length < 8) onChange([...selected, d])
  }

  const btnLabel = selected.length === 0 ? '選擇行政區（最多8區）'
    : selected.length <= 3 ? selected.join('、')
    : `${selected.slice(0, 3).join('、')} 等 ${selected.length} 區`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        height: 32, padding: '0 28px 0 10px', minWidth: 200,
        background: 'var(--surface-control)', color: selected.length ? 'var(--text-default)' : 'var(--text-faint)',
        border: `1px solid ${open ? 'var(--accent)' : 'var(--border-control)'}`,
        borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-sans)', cursor: 'pointer', textAlign: 'left' as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
      }}>
        {btnLabel}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
          background: 'var(--surface-card)', border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)',
          padding: 8, width: 320, maxHeight: 320, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 8px', borderBottom: '1px solid var(--border-card)', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>已選 {selected.length} / 8 區</span>
            <button onClick={() => onChange([])} style={{ ...ghostBtn(), height: 22, fontSize: 10 }}>清除全部</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALL_DISTRICTS.map(d => {
              const idx = selected.indexOf(d)
              const isSelected = idx >= 0
              const color = isSelected ? SERIES_COLORS[idx % SERIES_COLORS.length] : undefined
              return (
                <button key={d} onClick={() => toggle(d)} style={{
                  height: 26, padding: '0 10px', borderRadius: 'var(--radius-full)',
                  fontSize: 11, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  background: isSelected ? (color ?? 'var(--accent)') : 'transparent',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  border: isSelected ? `1px solid ${color ?? 'var(--accent)'}` : '1px solid var(--border-control)',
                  opacity: !isSelected && selected.length >= 8 ? 0.4 : 1,
                }}>
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Metric Dropdown ─────────────────────────────────────── */
function MetricSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle()}>
      {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>
  )
}

/* ── Chart Type Pills ────────────────────────────────────── */
function ChartTypePills({ value, onChange }: { value: ChartType; onChange: (v: ChartType) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {CHART_TYPES.map(c => (
        <button key={c.key} onClick={() => onChange(c.key as ChartType)} style={{
          height: 28, padding: '0 10px', borderRadius: 'var(--radius-full)',
          fontSize: 11, fontFamily: 'var(--font-sans)', cursor: 'pointer',
          background: value === c.key ? 'var(--accent-wash)' : 'transparent',
          color: value === c.key ? 'var(--accent-tint)' : 'var(--text-muted)',
          border: value === c.key ? '1px solid var(--accent-wash-border)' : '1px solid var(--border-control)',
        }}>{c.label}</button>
      ))}
    </div>
  )
}

/* ── Year-Month Range ────────────────────────────────────── */
function YearMonthRange({
  yearFrom, monthFrom, yearTo, monthTo,
  onYearFrom, onMonthFrom, onYearTo, onMonthTo,
}: {
  yearFrom: number; monthFrom: number; yearTo: number; monthTo: number
  onYearFrom: (v: number) => void; onMonthFrom: (v: number) => void
  onYearTo: (v: number) => void; onMonthTo: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select value={yearFrom} onChange={e => onYearFrom(Number(e.target.value))} style={{ ...selectStyle(), width: 80 }}>
        {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
      </select>
      <select value={monthFrom} onChange={e => onMonthFrom(Number(e.target.value))} style={{ ...selectStyle(), width: 64 }}>
        {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
      </select>
      <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>～</span>
      <select value={yearTo} onChange={e => onYearTo(Number(e.target.value))} style={{ ...selectStyle(), width: 80 }}>
        {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
      </select>
      <select value={monthTo} onChange={e => onMonthTo(Number(e.target.value))} style={{ ...selectStyle(), width: 64 }}>
        {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
      </select>
    </div>
  )
}

/* ── Main ────────────────────────────────────────────────── */
export default function AnalysisPanel() {
  const [metric,      setMetric]      = useState('unit_price')
  const [stat,        setStat]        = useState<'avg' | 'max' | 'min'>('avg')
  const [granularity, setGranularity] = useState('quarter')
  const [chartType,   setChartType]   = useState<ChartType>('line')
  const [mode, setMode] = useState('all')  // 'all' | 'presale' | 'existing'
  const [buildingType, setBuildingType] = useState('')
  const [roomType,     setRoomType]     = useState('')
  const [yearFrom,    setYearFrom]    = useState(110)
  const [monthFrom,   setMonthFrom]   = useState(1)
  const [yearTo,      setYearTo]      = useState(115)
  const [monthTo,     setMonthTo]     = useState(12)
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([])
  const [yMin, setYMin] = useState('')
  const [yMax, setYMax] = useState('')
  const [data,    setData]    = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved,   setSaved]   = useState<{ label: string; data: AnalysisData; metric: string }[]>([])
  const chartDivRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (overrideDistricts?: string[]) => {
    setLoading(true)
    try {
      const dists = overrideDistricts ?? selectedDistricts
      const p = new URLSearchParams({
        metric, granularity, mode,
        stat: STAT_SUPPORTED.has(metric) ? stat : 'avg',
        buildingType, roomType,
        yearFrom: String(yearFrom), monthFrom: String(monthFrom),
        yearTo:   String(yearTo),   monthTo:   String(monthTo),
      })
      if (dists.length > 0) p.set('districts', dists.join(','))
      const json = await fetch(`/api/analysis?${p}`).then(r => r.json())
      setData(json)
      if (!selectedDistricts.length && json.districts?.length) setSelectedDistricts(json.districts)
    } finally { setLoading(false) }
  }, [metric, stat, granularity, mode, buildingType, roomType, yearFrom, monthFrom, yearTo, monthTo, selectedDistricts])

  // 指標切換到不支援最高/最低統計時，自動回到「平均」
  useEffect(() => {
    if (!STAT_SUPPORTED.has(metric) && stat !== 'avg') setStat('avg')
  }, [metric, stat])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const handleSave = () => {
    if (!data) return
    const ml = METRICS.find(m => m.key === metric)?.label ?? metric
    const gl = granularity === 'month' ? '月' : granularity === 'quarter' ? '季' : '年'
    const range = `${yearFrom}年${monthFrom}月～${yearTo}年${monthTo}月`
    setSaved(prev => [{ label: `${ml} · ${gl} · ${range}`, data, metric }, ...prev.slice(0, 4)])
  }

  const showRecord = data?.stat === 'max' || data?.stat === 'min'
  const chartRows = (data?.periods ?? []).map(period => {
    const row: Record<string, unknown> = { period }
    data?.series.forEach(s => {
      const found = s.data.find(d => d.period === period)
      row[s.district] = found?.value ?? null
      if (showRecord) row[`${s.district}__rec`] = found?.record ?? null
    })
    return row
  })
  const yDomain: [number | string, number | string] = [yMin !== '' ? Number(yMin) : 'auto', yMax !== '' ? Number(yMax) : 'auto']
  const statLabel = STATS.find(s => s.key === (data?.stat ?? 'avg'))?.label ?? ''
  const metricLabel = METRICS.find(m => m.key === metric)?.label ?? ''
  const districts = data?.series.map(s => s.district) ?? []

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── 控制列 ── */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-card)' }}>

        {/* Row 1: 指標 + 時間粒度 + 圖表類型 */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            {label('指標')}
            <MetricSelect value={metric} onChange={setMetric} />
          </div>
          {STAT_SUPPORTED.has(metric) && (
            <div>
              {label('統計方式')}
              <select value={stat} onChange={e => setStat(e.target.value as 'avg' | 'max' | 'min')} style={selectStyle()}>
                {STATS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          )}
          <div>
            {label('時間粒度')}
            <select value={granularity} onChange={e => setGranularity(e.target.value)} style={selectStyle()}>
              <option value="month">月</option>
              <option value="quarter">季</option>
              <option value="year">年</option>
            </select>
          </div>
          <div>
            {label('圖表類型')}
            <ChartTypePills value={chartType} onChange={setChartType} />
          </div>
          <div>
            {label('類型')}
            <select value={mode} onChange={e => setMode(e.target.value)} style={selectStyle()}>
              <option value="all">合計</option>
              <option value="presale">預售屋</option>
              <option value="existing">成屋</option>
            </select>
          </div>
          <div>
            {label('建物型態')}
            <select value={buildingType} onChange={e => setBuildingType(e.target.value)} style={selectStyle()}>
              {BUILDING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            {label('房型')}
            <select value={roomType} onChange={e => setRoomType(e.target.value)} style={selectStyle()}>
              {ROOM_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: 行政區 + 時間範圍 */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            {label('行政區')}
            <DistrictDropdown selected={selectedDistricts} onChange={setSelectedDistricts} />
          </div>
          <div>
            {label('時間範圍（民國）')}
            <YearMonthRange
              yearFrom={yearFrom} monthFrom={monthFrom}
              yearTo={yearTo}     monthTo={monthTo}
              onYearFrom={setYearFrom} onMonthFrom={setMonthFrom}
              onYearTo={setYearTo}     onMonthTo={setMonthTo}
            />
          </div>
          <div>
            {label('Y 軸（留空=自動）')}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input placeholder="最小" value={yMin} onChange={e => setYMin(e.target.value)}
                style={{ ...selectStyle(), width: 72, padding: '0 8px', backgroundImage: 'none', appearance: 'none' }} />
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>～</span>
              <input placeholder="最大" value={yMax} onChange={e => setYMax(e.target.value)}
                style={{ ...selectStyle(), width: 72, padding: '0 8px', backgroundImage: 'none', appearance: 'none' }} />
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading} style={{
            height: 32, padding: '0 24px', borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-sans)',
            background: 'var(--gradient-accent)', color: 'var(--on-accent)',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, boxShadow: 'var(--glow-accent)',
          }}>{loading ? '載入中…' : '套用'}</button>
        </div>
      </div>

      {/* ── 圖表 ── */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: '16px 20px', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-strong)', fontFamily: 'var(--font-sans)' }}>
            {metricLabel}
            {showRecord && (
              <span style={{
                fontSize: 10, fontWeight: 600, marginLeft: 8, padding: '2px 8px',
                borderRadius: 'var(--radius-full)', background: 'var(--accent-wash)',
                color: 'var(--accent-tint)', border: '1px solid var(--accent-wash-border)',
              }}>{statLabel}</span>
            )}
            {selectedDistricts.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                {selectedDistricts.join(' · ')}
                {mode !== 'all' && ` · ${mode === 'presale' ? '預售屋' : '成屋'}`}
                {buildingType && ` · ${BUILDING_TYPES.find(t => t.key === buildingType)?.label}`}
                {roomType && ` · ${ROOM_TYPES.find(t => t.key === roomType)?.label}`}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} style={ghostBtn()}>◎ 記錄</button>
            <button onClick={() => saveChartAsPng(chartDivRef, `台南不動產_${metricLabel}`)} style={ghostBtn()}>↓ PNG</button>
          </div>
        </div>
        <div ref={chartDivRef} style={{ width: '100%', height: 400 }}>
          {loading ? (
            <div style={centerStyle(400)}>載入中…</div>
          ) : chartRows.length === 0 ? (
            <div style={centerStyle(400)}>無資料，請選擇行政區後按「套用」</div>
          ) : (
            <AnalysisChart chartRows={chartRows} districts={districts} chartType={chartType} yDomain={yDomain} metricLabel={metricLabel} height={400} showRecord={showRecord} />
          )}
        </div>
      </div>

      {/* ── 已記錄 ── */}
      {saved.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>已記錄（{saved.length}）</div>
          {saved.map((s, si) => <SavedChart key={si} saved={s} onRemove={() => setSaved(prev => prev.filter((_, i) => i !== si))} />)}
        </div>
      )}
    </div>
  )
}

/* ── Saved Chart ─────────────────────────────────────────── */
function SavedChart({ saved, onRemove }: { saved: { label: string; data: AnalysisData; metric: string }; onRemove: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const ml = METRICS.find(m => m.key === saved.metric)?.label ?? saved.metric
  const showRecord = saved.data.stat === 'max' || saved.data.stat === 'min'
  const chartRows = (saved.data.periods ?? []).map(period => {
    const row: Record<string, unknown> = { period }
    saved.data.series.forEach(s => {
      const found = s.data.find(d => d.period === period)
      row[s.district] = found?.value ?? null
      if (showRecord) row[`${s.district}__rec`] = found?.record ?? null
    })
    return row
  })
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: '14px 18px', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{saved.label}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => saveChartAsPng(ref, saved.label)} style={ghostBtn()}>↓ PNG</button>
          <button onClick={onRemove} style={{ ...ghostBtn(), color: 'var(--negative)' }}>✕</button>
        </div>
      </div>
      <div ref={ref} style={{ width: '100%', height: 200 }}>
        <AnalysisChart chartRows={chartRows} districts={saved.data.series.map(s => s.district)} chartType="line" yDomain={['auto','auto']} metricLabel={ml} height={200} compact showRecord={showRecord} />
      </div>
    </div>
  )
}

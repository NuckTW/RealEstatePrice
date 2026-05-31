'use client'

import { useState, useRef, useEffect } from 'react'

const TAINAN_DISTRICTS = [
  '中西區','東區','南區','北區','安平區','安南區',
  '永康區','歸仁區','新化區','左鎮區','玉井區','楠西區',
  '南化區','仁德區','關廟區','龍崎區','官田區','麻豆區',
  '佳里區','西港區','七股區','將軍區','學甲區','北門區',
  '新營區','後壁區','白河區','東山區','六甲區','下營區',
  '柳營區','鹽水區','善化區','大內區','山上區','新市區','安定區',
]

const MONTHS_OPTIONS = [
  { label: '1個月', value: '1' },
  { label: '3個月', value: '3' },
  { label: '6個月', value: '6' },
  { label: '1年',   value: '12' },
  { label: '全部',  value: '0' },
]
const TYPE_OPTIONS = [
  { label: '全部',   value: 'all' },
  { label: '住宅大樓', value: '住宅大樓' },
  { label: '透天厝', value: '透天厝' },
  { label: '公寓',   value: '公寓' },
  { label: '華廈',   value: '華廈' },
  { label: '套房',   value: '套房' },
  { label: '辦公商業', value: '辦公' },
]
const ROOMS_OPTIONS = [
  { label: '全部',  value: 'all' },
  { label: '0房',   value: '0' },
  { label: '1房',   value: '1' },
  { label: '2房',   value: '2' },
  { label: '3房',   value: '3' },
  { label: '4房',   value: '4' },
  { label: '5房以上', value: '5+' },
]
const PRESALE_OPTIONS = [
  { label: '全部',  value: 'all' },
  { label: '成屋',  value: 'false' },
  { label: '預售屋', value: 'true' },
]

export interface FilterValues {
  months: string
  districts: string[]
  type: string
  rooms: string
  presale: string
}

export const DEFAULT_FILTERS: FilterValues = {
  months: '12', districts: [], type: 'all', rooms: 'all', presale: 'all',
}

/* ── Simple single-select ──────────────────────────────────── */
function SimpleSelect({
  label, options, value, onChange,
}: {
  label: string
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] text-gray-400 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

/* ── Multi-select dropdown ─────────────────────────────────── */
function MultiSelect({
  label, options, selected, onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (d: string) =>
    onChange(selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d])

  const displayText =
    selected.length === 0 || selected.length === options.length
      ? '全部'
      : `已選 ${selected.length} 區`

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      <span className="text-[11px] text-gray-400 whitespace-nowrap">{label}</span>
      <button
        onClick={() => setOpen(!open)}
        className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1.5 text-sm flex items-center justify-between gap-2 min-w-[120px] focus:outline-none focus:border-blue-500"
      >
        <span>{displayText}</span>
        <span className="text-gray-400 text-xs">▼</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-52 max-h-72 overflow-y-auto">
          <div className="flex gap-3 px-3 py-2 border-b border-gray-700 sticky top-0 bg-gray-800">
            <button onClick={() => onChange(options)} className="text-xs text-blue-400 hover:text-blue-300">全選</button>
            <button onClick={() => onChange([])} className="text-xs text-gray-400 hover:text-gray-300">清除</button>
          </div>
          {options.map(d => (
            <label key={d} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700 cursor-pointer text-sm text-white">
              <input
                type="checkbox"
                checked={selected.includes(d)}
                onChange={() => toggle(d)}
                className="accent-blue-500"
              />
              {d}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── FilterBar ─────────────────────────────────────────────── */
interface FilterBarProps {
  onApply: (f: FilterValues) => void
  loading?: boolean
}

export default function FilterBar({ onApply, loading }: FilterBarProps) {
  const [f, setF] = useState<FilterValues>(DEFAULT_FILTERS)

  const set = <K extends keyof FilterValues>(key: K, val: FilterValues[K]) =>
    setF(prev => ({ ...prev, [key]: val }))

  const handleClear = () => {
    setF(DEFAULT_FILTERS)
    onApply(DEFAULT_FILTERS)
  }

  return (
    <div className="sticky top-14 z-20 bg-[#0d1117]/95 backdrop-blur border-b border-gray-800 px-6 py-3">
      <div className="flex items-end gap-3 flex-wrap">
        <SimpleSelect label="日期區間" options={MONTHS_OPTIONS} value={f.months} onChange={v => set('months', v)} />
        <MultiSelect  label="行政區（可多選）" options={TAINAN_DISTRICTS} selected={f.districts} onChange={v => set('districts', v)} />
        <SimpleSelect label="類型" options={TYPE_OPTIONS} value={f.type} onChange={v => set('type', v)} />
        <SimpleSelect label="房型" options={ROOMS_OPTIONS} value={f.rooms} onChange={v => set('rooms', v)} />
        <SimpleSelect label="成／預售" options={PRESALE_OPTIONS} value={f.presale} onChange={v => set('presale', v)} />

        <div className="flex gap-2 pb-0.5 mt-auto">
          <button
            onClick={() => onApply(f)}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded px-5 py-1.5 text-sm font-medium transition-colors"
          >
            {loading ? '載入中…' : '套用'}
          </button>
          <button
            onClick={handleClear}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded px-4 py-1.5 text-sm transition-colors"
          >
            清除
          </button>
        </div>
      </div>
    </div>
  )
}

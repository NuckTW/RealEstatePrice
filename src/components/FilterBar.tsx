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

const TYPE_OPTIONS = [
  { label: '住宅大樓', value: '住宅大樓' },
  { label: '透天厝',   value: '透天厝' },
  { label: '公寓',     value: '公寓' },
  { label: '華廈',     value: '華廈' },
  { label: '套房',     value: '套房' },
  { label: '辦公商業', value: '辦公' },
]

const ROOMS_OPTIONS = [
  { label: '0房',     value: '0' },
  { label: '1房',     value: '1' },
  { label: '2房',     value: '2' },
  { label: '3房',     value: '3' },
  { label: '4房',     value: '4' },
  { label: '5房以上', value: '5+' },
]

const ROC_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const y = 110 + i
  return { label: `${y}年`, value: String(y) }
})
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1}月`, value: String(i + 1),
}))
const PRESALE_OPTIONS = [
  { label: '成屋 + 預售', value: 'all' },
  { label: '成屋',        value: 'false' },
  { label: '預售屋',      value: 'true' },
]
const BUILDING_AGE_OPTIONS = [
  { label: '不限屋齡', value: 'all' },
  { label: '5年以內',  value: '5' },
  { label: '10年以內', value: '10' },
  { label: '20年以內', value: '20' },
  { label: '30年以內', value: '30' },
  { label: '30年以上', value: '30+' },
]

export interface FilterValues {
  dateFromYear: string
  dateFromMonth: string
  dateToYear: string
  dateToMonth: string
  districts: string[]
  types: string[]
  rooms: string[]
  presale: string
  buildingAge: string
}

export const DEFAULT_FILTERS: FilterValues = {
  dateFromYear: '114', dateFromMonth: '1',
  dateToYear:   '115', dateToMonth:   '6',
  districts: [], types: [], rooms: [], presale: 'all', buildingAge: 'all',
}

/* ── Styled select ─────────────────────────────────────────── */
function StyledSelect({
  label, options, value, onChange,
}: {
  label?: string
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      {label && <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</span>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-[#111827] border border-white/8 text-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-violet-500/50 cursor-pointer appearance-none pr-7 transition-colors hover:border-white/15"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

/* ── Generic multi-select dropdown ────────────────────────── */
function MultiSelect({
  label, options, selected, onChange, placeholder,
}: {
  label: string
  options: { label: string; value: string }[]
  selected: string[]
  onChange: (v: string[]) => void
  placeholder: string
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

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
      : `已選 ${selected.length} 項`

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      <button
        onClick={() => setOpen(!open)}
        className={`
          bg-[#111827] border text-gray-200 rounded-lg
          px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 min-w-[110px]
          focus:outline-none cursor-pointer transition-all
          ${open ? 'border-violet-500/50' : 'border-white/8 hover:border-white/15'}
          ${selected.length > 0 ? 'text-violet-300' : ''}
        `}
      >
        <span className="truncate">{displayText}</span>
        <svg className={`w-2.5 h-2.5 flex-shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-[#111827] border border-white/10 rounded-xl shadow-2xl shadow-black/50 w-44">
          <div className="flex gap-3 px-3 py-2 border-b border-white/5 sticky top-0 bg-[#111827]">
            <button onClick={() => onChange(options.map(o => o.value))} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">全選</button>
            <button onClick={() => onChange([])} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">清除</button>
          </div>
          <div className="p-1 max-h-56 overflow-y-auto">
            {options.map(o => (
              <label key={o.value} className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer text-xs text-gray-300 transition-colors">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="accent-violet-500 w-3 h-3"
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── District multi-select ──────────────────────────────────── */
function DistrictSelect({
  selected, onChange,
}: {
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
    selected.length === 0 ? '全部行政區' :
    selected.length === 1 ? selected[0] :
    `${selected.length} 個行政區`

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">行政區</span>
      <button
        onClick={() => setOpen(!open)}
        className={`
          bg-[#111827] border text-gray-200 rounded-lg
          px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 min-w-[120px]
          focus:outline-none cursor-pointer transition-all
          ${open ? 'border-violet-500/50' : 'border-white/8 hover:border-white/15'}
          ${selected.length > 0 ? 'text-violet-300' : ''}
        `}
      >
        <span>{displayText}</span>
        <svg className={`w-2.5 h-2.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-[#111827] border border-white/10 rounded-xl shadow-2xl shadow-black/50 w-56 max-h-72 overflow-y-auto">
          <div className="flex gap-3 px-3 py-2 border-b border-white/5 sticky top-0 bg-[#111827]">
            <button onClick={() => onChange(TAINAN_DISTRICTS)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">全選</button>
            <button onClick={() => onChange([])} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">清除</button>
          </div>
          <div className="p-1">
            {TAINAN_DISTRICTS.map(d => (
              <label key={d} className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer text-xs text-gray-300 transition-colors">
                <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} className="accent-violet-500 w-3 h-3" />
                {d}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Active filter tags ─────────────────────────────────────── */
export function ActiveFilterTags({
  filters,
  onRemove,
}: {
  filters: FilterValues
  onRemove: (updated: FilterValues) => void
}) {
  const tags: { label: string; onRemove: () => void }[] = []

  // Districts
  filters.districts.forEach(d => {
    tags.push({ label: d, onRemove: () => onRemove({ ...filters, districts: filters.districts.filter(x => x !== d) }) })
  })

  // Types
  filters.types.forEach(t => {
    const label = TYPE_OPTIONS.find(o => o.value === t)?.label ?? t
    tags.push({ label, onRemove: () => onRemove({ ...filters, types: filters.types.filter(x => x !== t) }) })
  })

  // Rooms
  filters.rooms.forEach(r => {
    const label = ROOMS_OPTIONS.find(o => o.value === r)?.label ?? r
    tags.push({ label, onRemove: () => onRemove({ ...filters, rooms: filters.rooms.filter(x => x !== r) }) })
  })

  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag, i) => (
        <button
          key={i}
          onClick={tag.onRemove}
          className="
            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
            bg-violet-500/10 text-violet-300 border border-violet-500/20
            hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/25
            transition-all group
          "
        >
          {tag.label}
          <span className="opacity-50 group-hover:opacity-100 transition-opacity">×</span>
        </button>
      ))}
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

  const handleClear = () => { setF(DEFAULT_FILTERS); onApply(DEFAULT_FILTERS) }

  return (
    <div className="sticky top-14 z-20 bg-[#080d16]/95 backdrop-blur-xl border-b border-white/5 px-5 py-3">
      <div className="flex items-end gap-2.5 flex-wrap">

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">起始</span>
          <div className="flex items-center gap-1">
            <StyledSelect options={ROC_YEAR_OPTIONS} value={f.dateFromYear} onChange={v => set('dateFromYear', v)} />
            <StyledSelect options={MONTH_OPTIONS}    value={f.dateFromMonth} onChange={v => set('dateFromMonth', v)} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">結束</span>
          <div className="flex items-center gap-1">
            <StyledSelect options={ROC_YEAR_OPTIONS} value={f.dateToYear} onChange={v => set('dateToYear', v)} />
            <StyledSelect options={MONTH_OPTIONS}    value={f.dateToMonth} onChange={v => set('dateToMonth', v)} />
          </div>
        </div>

        <div className="h-8 w-px bg-white/5 self-end mb-0.5 hidden sm:block" />

        <DistrictSelect selected={f.districts} onChange={v => set('districts', v)} />

        <MultiSelect
          label="類型"
          options={TYPE_OPTIONS}
          selected={f.types}
          onChange={v => set('types', v)}
          placeholder="全部類型"
        />

        <MultiSelect
          label="房型"
          options={ROOMS_OPTIONS}
          selected={f.rooms}
          onChange={v => set('rooms', v)}
          placeholder="全部房型"
        />

        <StyledSelect
          label="成／預售"
          options={PRESALE_OPTIONS}
          value={f.presale}
          onChange={v => {
            // 只在切到「純預售屋」時才重置屋齡
            const reset = v === 'true' ? { presale: v, buildingAge: 'all' } : { presale: v }
            setF(prev => ({ ...prev, ...reset }))
          }}
        />

        {f.presale !== 'true' && (
          <StyledSelect label="屋齡" options={BUILDING_AGE_OPTIONS} value={f.buildingAge} onChange={v => set('buildingAge', v)} />
        )}

        <div className="h-8 w-px bg-white/5 self-end mb-0.5 hidden sm:block" />

        <div className="flex gap-2 self-end">
          <button
            onClick={() => onApply(f)}
            disabled={loading}
            className="relative overflow-hidden px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white transition-all shadow-lg shadow-violet-500/20"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                載入中
              </span>
            ) : '套用篩選'}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
          >
            清除
          </button>
        </div>
      </div>
    </div>
  )
}

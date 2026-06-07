'use client'

import { useState, useRef, useEffect, CSSProperties } from 'react'

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
  { label: '0房', value: '0' }, { label: '1房', value: '1' },
  { label: '2房', value: '2' }, { label: '3房', value: '3' },
  { label: '4房', value: '4' }, { label: '5房以上', value: '5+' },
]
const ROC_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const y = 110 + i; return { label: `${y}年`, value: String(y) }
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
  dateFromYear: string; dateFromMonth: string
  dateToYear: string;   dateToMonth: string
  districts: string[]; types: string[]; rooms: string[]
  presale: string; buildingAge: string
}

export const DEFAULT_FILTERS: FilterValues = {
  dateFromYear: '114', dateFromMonth: '1',
  dateToYear:   '115', dateToMonth:   '6',
  districts: [], types: [], rooms: [], presale: 'all', buildingAge: 'all',
}

/* ── Shared select style ──────────────────────────────────────── */
const selectStyle: CSSProperties = {
  appearance: 'none',
  background: 'var(--surface-control)',
  border: '1px solid var(--border-control)',
  color: 'var(--text-default)',
  borderRadius: 'var(--radius-md)',
  height: 'var(--control-h-sm)',
  padding: '0 26px 0 10px',
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  transition: 'var(--transition-base)',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238a7a68' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
}

function StyledSelect({ label, options, value, onChange }: {
  label?: string
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {label && (
        <span style={{
          fontSize: 'var(--text-3xs)', color: 'var(--text-faint)',
          textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
          fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)',
        }}>{label}</span>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={selectStyle}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.outline = 'none' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-control)' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

/* ── Multi-select dropdown ────────────────────────────────────── */
function MultiSelect({ label, options, selected, onChange, placeholder }: {
  label: string; options: { label: string; value: string }[]
  selected: string[]; onChange: (v: string[]) => void; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  const displayText = selected.length === 0 ? placeholder
    : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
    : `已選 ${selected.length} 項`

  const hasActive = selected.length > 0

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 'var(--text-3xs)', color: 'var(--text-faint)',
        textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
        fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)',
      }}>{label}</span>

      <button
        onClick={() => setOpen(!open)}
        style={{
          ...selectStyle,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 6, minWidth: 110, padding: '0 8px 0 10px',
          color: hasActive ? 'var(--accent-tint)' : 'var(--text-default)',
          borderColor: open ? 'var(--accent)' : hasActive ? 'var(--accent-wash-border)' : 'var(--border-control)',
          background: hasActive ? 'var(--accent-wash)' : 'var(--surface-control)',
          backgroundImage: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
        <svg style={{ width: 10, height: 6, flexShrink: 0, color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'var(--transition-base)' }} fill="none" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', marginTop: 4, left: 0, zIndex: 9999,
          background: 'var(--surface-overlay)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-pop)', width: 176,
        }}>
          <div style={{ display: 'flex', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border-card)' }}>
            <button onClick={() => onChange(options.map(o => o.value))} style={{ fontSize: 11, color: 'var(--accent-tint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}>全選</button>
            <button onClick={() => onChange([])} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}>清除</button>
          </div>
          <div style={{ padding: 4, maxHeight: 224, overflowY: 'auto' }}>
            {options.map(o => (
              <label key={o.value} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 10px', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontSize: 'var(--text-xs)',
                color: 'var(--text-default)', fontFamily: 'var(--font-sans)',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)}
                  style={{ accentColor: 'var(--accent)', width: 12, height: 12, flexShrink: 0, cursor: 'pointer' }} />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── District multi-select ────────────────────────────────────── */
function DistrictSelect({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggle = (d: string) =>
    onChange(selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d])

  const displayText = selected.length === 0 ? '全部行政區'
    : selected.length === 1 ? selected[0]
    : `${selected.length} 個行政區`

  const hasActive = selected.length > 0

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 'var(--text-3xs)', color: 'var(--text-faint)',
        textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
        fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)',
      }}>行政區</span>

      <button
        onClick={() => setOpen(!open)}
        style={{
          ...selectStyle, minWidth: 120,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 6, padding: '0 8px 0 10px', backgroundImage: 'none',
          color: hasActive ? 'var(--accent-tint)' : 'var(--text-default)',
          borderColor: open ? 'var(--accent)' : hasActive ? 'var(--accent-wash-border)' : 'var(--border-control)',
          background: hasActive ? 'var(--accent-wash)' : 'var(--surface-control)',
        }}
      >
        <span>{displayText}</span>
        <svg style={{ width: 10, height: 6, flexShrink: 0, color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'var(--transition-base)' }} fill="none" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', marginTop: 4, left: 0, zIndex: 9999,
          background: 'var(--surface-overlay)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-pop)',
          width: 224, maxHeight: 288, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border-card)', position: 'sticky', top: 0, background: 'var(--surface-overlay)' }}>
            <button onClick={() => onChange(TAINAN_DISTRICTS)} style={{ fontSize: 11, color: 'var(--accent-tint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}>全選</button>
            <button onClick={() => onChange([])} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}>清除</button>
          </div>
          <div style={{ padding: 4 }}>
            {TAINAN_DISTRICTS.map(d => (
              <label key={d} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 10px', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontSize: 'var(--text-xs)',
                color: 'var(--text-default)', fontFamily: 'var(--font-sans)',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)}
                  style={{ accentColor: 'var(--accent)', width: 12, height: 12, flexShrink: 0, cursor: 'pointer' }} />
                {d}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Active filter tags ───────────────────────────────────────── */
export function ActiveFilterTags({ filters, onRemove }: {
  filters: FilterValues; onRemove: (updated: FilterValues) => void
}) {
  const tags: { label: string; onRemove: () => void }[] = []

  filters.districts.forEach(d =>
    tags.push({ label: d, onRemove: () => onRemove({ ...filters, districts: filters.districts.filter(x => x !== d) }) }))
  filters.types.forEach(t => {
    const label = TYPE_OPTIONS.find(o => o.value === t)?.label ?? t
    tags.push({ label, onRemove: () => onRemove({ ...filters, types: filters.types.filter(x => x !== t) }) })
  })
  filters.rooms.forEach(r => {
    const label = ROOMS_OPTIONS.find(o => o.value === r)?.label ?? r
    tags.push({ label, onRemove: () => onRemove({ ...filters, rooms: filters.rooms.filter(x => x !== r) }) })
  })

  if (tags.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tags.map((tag, i) => (
        <button
          key={i}
          onClick={tag.onRemove}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 'var(--radius-full)',
            fontSize: 11, fontWeight: 'var(--weight-medium)',
            fontFamily: 'var(--font-sans)',
            background: 'var(--accent-wash)',
            color: 'var(--accent-tint)',
            border: '1px solid var(--accent-wash-border)',
            cursor: 'pointer', transition: 'var(--transition-base)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(224,87,63,0.14)'
            el.style.color = 'var(--negative)'
            el.style.borderColor = 'rgba(224,87,63,0.28)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'var(--accent-wash)'
            el.style.color = 'var(--accent-tint)'
            el.style.borderColor = 'var(--accent-wash-border)'
          }}
        >
          {tag.label}
          <span style={{ opacity: 0.6, fontSize: 10 }}>×</span>
        </button>
      ))}
    </div>
  )
}

/* ── FilterBar ─────────────────────────────────────────────────── */
export default function FilterBar({ onApply, loading }: { onApply: (f: FilterValues) => void; loading?: boolean }) {
  const [f, setF] = useState<FilterValues>(DEFAULT_FILTERS)
  const set = <K extends keyof FilterValues>(key: K, val: FilterValues[K]) =>
    setF(prev => ({ ...prev, [key]: val }))

  const handleClear = () => { setF(DEFAULT_FILTERS); onApply(DEFAULT_FILTERS) }

  return (
    <div style={{
      position: 'sticky', top: 'var(--nav-h)', zIndex: 2000,
      background: 'var(--chrome-bg)',
      backdropFilter: 'saturate(140%) blur(16px)',
      WebkitBackdropFilter: 'saturate(140%) blur(16px)',
      borderBottom: '1px solid var(--border-card)',
      padding: '10px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>

        {/* Date range */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)' }}>起始</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <StyledSelect options={ROC_YEAR_OPTIONS}  value={f.dateFromYear}  onChange={v => set('dateFromYear', v)} />
            <StyledSelect options={MONTH_OPTIONS}     value={f.dateFromMonth} onChange={v => set('dateFromMonth', v)} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)' }}>結束</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <StyledSelect options={ROC_YEAR_OPTIONS} value={f.dateToYear}  onChange={v => set('dateToYear', v)} />
            <StyledSelect options={MONTH_OPTIONS}    value={f.dateToMonth} onChange={v => set('dateToMonth', v)} />
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: 'var(--border-card)', alignSelf: 'flex-end' }} />

        <DistrictSelect selected={f.districts} onChange={v => set('districts', v)} />
        <MultiSelect label="類型" options={TYPE_OPTIONS} selected={f.types} onChange={v => set('types', v)} placeholder="全部類型" />
        <MultiSelect label="房型" options={ROOMS_OPTIONS} selected={f.rooms} onChange={v => set('rooms', v)} placeholder="全部房型" />

        <StyledSelect
          label="成／預售"
          options={PRESALE_OPTIONS}
          value={f.presale}
          onChange={v => {
            const reset = v === 'true' ? { presale: v, buildingAge: 'all' } : { presale: v }
            setF(prev => ({ ...prev, ...reset }))
          }}
        />

        {f.presale !== 'true' && (
          <StyledSelect label="屋齡" options={BUILDING_AGE_OPTIONS} value={f.buildingAge} onChange={v => set('buildingAge', v)} />
        )}

        <div style={{ width: 1, height: 28, background: 'var(--border-card)', alignSelf: 'flex-end' }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
          <button
            onClick={() => onApply(f)}
            disabled={loading}
            style={{
              height: 'var(--control-h-sm)', padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
              fontFamily: 'var(--font-sans)',
              background: loading ? 'var(--surface-control)' : 'var(--gradient-accent)',
              color: loading ? 'var(--text-muted)' : 'var(--on-accent)',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : 'var(--glow-accent)',
              opacity: loading ? 0.7 : 1,
              transition: 'var(--transition-base)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {loading ? (
              <>
                <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.3)', borderTopColor: 'currentColor', animation: 'tra-spin .6s linear infinite', display: 'inline-block' }} />
                載入中
              </>
            ) : '套用篩選'}
          </button>

          <button
            onClick={handleClear}
            style={{
              height: 'var(--control-h-sm)', padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)',
              fontFamily: 'var(--font-sans)',
              background: 'var(--surface-control)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-control)',
              cursor: 'pointer', transition: 'var(--transition-base)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = 'var(--text-default)'
              el.style.borderColor = 'var(--border-strong)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = 'var(--text-muted)'
              el.style.borderColor = 'var(--border-control)'
            }}
          >清除</button>
        </div>
      </div>
      <style>{`@keyframes tra-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  TAINAN_DISTRICTS, TYPE_OPTIONS, ROOMS_OPTIONS, BUILDING_AGE_OPTIONS, MONTH_OPTIONS,
  rocYearOptions, StyledSelect, type FilterValues,
} from '@/components/FilterBar'
import { ZONES, findZone, zoneLabel } from '@/lib/zones'
import { useGlobalFilters } from '@/hooks/useGlobalFilters'
import {
  PERIOD_PRESETS, applyPeriodPreset, detectPeriodPreset, periodText,
} from '@/lib/globalFilters'

/*
 * 全站篩選列（行情地圖、市場、建案三頁共用）
 *  - 桌機：一排 chips，核心四項（期間、區域、預售／成屋、類型）＋「更多篩選」（房型、屋齡）
 *  - 手機：收成一顆摘要按鈕，點開是全螢幕 sheet
 * 所有改動即時寫回 URL（useGlobalFilters），各頁自己負責重新抓資料。
 */

const PRESALE_SEG = [
  { v: 'true',  l: '預售' },
  { v: 'false', l: '成屋' },
  { v: 'all',   l: '全部' },
] as const

/* ── 共用小元件 ─────────────────────────────────────────── */

const chipBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 30, padding: '0 12px', borderRadius: 'var(--radius-full)',
  border: '1px solid var(--border-control)', background: 'var(--surface-card)',
  color: 'var(--text-default)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'var(--transition-base)',
}
const chipActive: CSSProperties = {
  borderColor: 'var(--accent-wash-border)', background: 'var(--accent-wash)',
  color: 'var(--accent-tint)', fontWeight: 'var(--weight-semibold)',
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden
      style={{ color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'var(--transition-base)' }}>
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** chip ＋ 下拉面板（點外面關閉；面板超出右緣時自動往左推） */
function ChipPopover({ label, active, width = 260, children }: {
  label: ReactNode; active: boolean; width?: number; children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])

  const toggle = () => {
    if (!open && ref.current) {
      const left = ref.current.getBoundingClientRect().left
      setShift(Math.min(0, window.innerWidth - 16 - width - left))
    }
    setOpen(o => !o)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={toggle} aria-expanded={open}
        style={{ ...chipBase, ...(active ? chipActive : {}), ...(open ? { borderColor: 'var(--accent)' } : {}) }}>
        {label}<Caret open={open} />
      </button>
      {open && (
        <div role="dialog" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: shift, zIndex: 9999, width,
          background: 'var(--surface-overlay)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-pop)', padding: 12,
          maxHeight: 'min(420px, 70vh)', overflowY: 'auto',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

/** 勾選清單 */
function CheckList({ options, selected, onChange, columns = 1 }: {
  options: { label: ReactNode; value: string; hint?: string }[]
  selected: string[]; onChange: (v: string[]) => void; columns?: number
}) {
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 2 }}>
      {options.map(o => (
        <label key={o.value} title={o.hint} className="tra-check" style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 8px',
          borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-xs)',
          color: 'var(--text-default)', fontFamily: 'var(--font-sans)', minWidth: 0,
        }}>
          <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)}
            style={{ accentColor: 'var(--accent)', width: 13, height: 13, marginTop: 2, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '2px 0 6px' }}>
      <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', letterSpacing: 'var(--tracking-caps)', fontWeight: 'var(--weight-medium)' }}>{children}</span>
      {action}
    </div>
  )
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
      fontSize: 'var(--text-2xs)', color: 'var(--accent-tint)', fontFamily: 'var(--font-sans)',
    }}>{children}</button>
  )
}

function Segmented({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="成屋或預售" style={{
      display: 'inline-flex', padding: 2, gap: 2, borderRadius: 'var(--radius-full)',
      background: 'var(--surface-control)', border: '1px solid var(--border-control)',
    }}>
      {PRESALE_SEG.map(o => {
        const on = value === o.v
        return (
          <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.v)} style={{
            height: 24, padding: '0 12px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
            fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
            background: on ? 'var(--surface-card)' : 'transparent',
            color: on ? 'var(--text-strong)' : 'var(--text-muted)',
            fontWeight: on ? 'var(--weight-semibold)' : 'var(--weight-medium)',
            boxShadow: on ? 'var(--shadow-card)' : 'none',
          }}>{o.l}</button>
        )
      })}
    </div>
  )
}

/* ── 各區塊內容（桌機面板與手機 sheet 共用） ─────────────────── */

function PeriodBody({ f, defaults, set }: { f: FilterValues; defaults: FilterValues; set: (f: FilterValues) => void }) {
  const preset = detectPeriodPreset(f, defaults)
  const years = rocYearOptions(Number(defaults.dateToYear))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {PERIOD_PRESETS.map(p => (
          <button key={p.id} type="button" onClick={() => set(applyPeriodPreset(f, p.id, defaults))}
            style={{ ...chipBase, ...(preset === p.id ? chipActive : {}) }}>{p.label}</button>
        ))}
      </div>
      <div>
        <SectionLabel>自訂期間（民國年月）</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <StyledSelect options={years} value={f.dateFromYear} onChange={v => set({ ...f, dateFromYear: v })} />
          <StyledSelect options={MONTH_OPTIONS} value={f.dateFromMonth} onChange={v => set({ ...f, dateFromMonth: v })} />
          <span style={{ color: 'var(--text-faint)' }}>–</span>
          <StyledSelect options={years} value={f.dateToYear} onChange={v => set({ ...f, dateToYear: v })} />
          <StyledSelect options={MONTH_OPTIONS} value={f.dateToMonth} onChange={v => set({ ...f, dateToMonth: v })} />
        </div>
      </div>
    </div>
  )
}

function AreaBody({ f, set, columns = 3 }: { f: FilterValues; set: (f: FilterValues) => void; columns?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <SectionLabel action={f.districts.length > 0 && <LinkButton onClick={() => set({ ...f, districts: [] })}>清除</LinkButton>}>
          行政區（不選＝全市）
        </SectionLabel>
        <CheckList columns={columns} selected={f.districts} onChange={v => set({ ...f, districts: v })}
          options={TAINAN_DISTRICTS.map(d => ({ label: d.replace(/區$/, ''), value: d }))} />
      </div>
      <div>
        <SectionLabel action={f.zones.length > 0 && <LinkButton onClick={() => set({ ...f, zones: [] })}>清除</LinkButton>}>
          重劃區／生活圈（依路名歸區）
        </SectionLabel>
        <CheckList selected={f.zones} onChange={v => set({ ...f, zones: v })}
          options={ZONES.map(z => ({
            value: z.id, hint: z.note,
            label: <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span>{zoneLabel(z)}</span>
              <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', lineHeight: 1.4 }}>{z.summary}</span>
            </span>,
          }))} />
      </div>
    </div>
  )
}

function MoreBody({ f, set }: { f: FilterValues; set: (f: FilterValues) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <SectionLabel>房型</SectionLabel>
        <CheckList columns={3} selected={f.rooms} onChange={v => set({ ...f, rooms: v })} options={ROOMS_OPTIONS} />
      </div>
      {f.presale !== 'true' && (
        <div>
          <SectionLabel>屋齡（成屋）</SectionLabel>
          <StyledSelect options={BUILDING_AGE_OPTIONS} value={f.buildingAge} onChange={v => set({ ...f, buildingAge: v })} />
        </div>
      )}
    </div>
  )
}

/** 區域 chip 的顯示文字 */
function areaText(f: FilterValues): string {
  const names = [...f.districts, ...f.zones.map(id => findZone(id)?.name ?? id)]
  if (!names.length) return '全市'
  return names.length === 1 ? names[0] : `${names[0]} 等 ${names.length} 區`
}
function typeText(f: FilterValues): string {
  if (!f.types.length) return '全部類型'
  const first = TYPE_OPTIONS.find(o => o.value === f.types[0])?.label ?? f.types[0]
  return f.types.length === 1 ? first : `${first} 等 ${f.types.length} 類`
}
function presaleText(v: string): string {
  return v === 'true' ? '預售' : v === 'false' ? '成屋' : '成屋＋預售'
}

/** 預售模式不適用屋齡：切到預售時順便把屋齡歸零 */
function withPresale(f: FilterValues, v: string): FilterValues {
  return { ...f, presale: v, ...(v === 'true' ? { buildingAge: 'all' } : {}) }
}

/* ── 主元件 ─────────────────────────────────────────────── */

export default function FilterChips() {
  const { filters: f, setFilters: set, resetFilters, defaults } = useGlobalFilters()
  const [sheetOpen, setSheetOpen] = useState(false)

  const preset = detectPeriodPreset(f, defaults)
  const periodLabel = preset === 'custom' ? periodText(f) : PERIOD_PRESETS.find(p => p.id === preset)!.label
  const moreCount = f.rooms.length + (f.buildingAge !== 'all' ? 1 : 0)
  const isDefault = JSON.stringify(f) === JSON.stringify(defaults)

  // 手機 sheet 開啟時鎖住背景捲動
  useEffect(() => {
    if (!sheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [sheetOpen])

  return (
    <div className="tra-chips" style={{
      position: 'sticky', top: 'var(--nav-h)', zIndex: 2000, height: 'var(--chips-h)',
      background: 'var(--chrome-bg)', backdropFilter: 'saturate(140%) blur(16px)',
      WebkitBackdropFilter: 'saturate(140%) blur(16px)', borderBottom: '1px solid var(--border-card)',
      display: 'flex', alignItems: 'center', gap: 8,
      paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
    }}>
      {/* 桌機：chips */}
      <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <ChipPopover label={<><span style={{ color: 'var(--text-faint)' }}>期間</span>{periodLabel}</>} active={preset !== 'default'} width={360}>
          <PeriodBody f={f} defaults={defaults} set={set} />
        </ChipPopover>
        <ChipPopover label={<><span style={{ color: 'var(--text-faint)' }}>區域</span>{areaText(f)}</>} active={f.districts.length + f.zones.length > 0} width={400}>
          <AreaBody f={f} set={set} />
        </ChipPopover>
        <Segmented value={f.presale} onChange={v => set(withPresale(f, v))} />
        <ChipPopover label={typeText(f)} active={f.types.length > 0} width={200}>
          <CheckList selected={f.types} onChange={v => set({ ...f, types: v })} options={TYPE_OPTIONS} />
        </ChipPopover>
        <ChipPopover label={<>更多篩選{moreCount > 0 && <span className="tra-count">{moreCount}</span>}</>} active={moreCount > 0} width={280}>
          <MoreBody f={f} set={set} />
        </ChipPopover>
        <div style={{ flex: 1 }} />
        {!isDefault && (
          <button type="button" onClick={resetFilters} style={{ ...chipBase, border: '1px solid transparent', background: 'transparent', color: 'var(--text-muted)' }}>
            清除篩選
          </button>
        )}
      </div>

      {/* 手機：一顆摘要按鈕 */}
      <button type="button" className="flex md:hidden" onClick={() => setSheetOpen(true)} style={{
        ...chipBase, flex: 1, minWidth: 0, justifyContent: 'space-between', height: 34,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {areaText(f)}・{presaleText(f.presale)}・{periodLabel}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ color: 'var(--accent-tint)', fontWeight: 'var(--weight-semibold)' }}>篩選</span>
          <Caret open={false} />
        </span>
      </button>

      {sheetOpen && (
        <div role="dialog" aria-modal="true" aria-label="篩選條件" style={{
          position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-app)',
          display: 'flex', flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-card)' }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>篩選條件</span>
            <LinkButton onClick={resetFilters}>全部清除</LinkButton>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div><SectionLabel>成屋／預售</SectionLabel><Segmented value={f.presale} onChange={v => set(withPresale(f, v))} /></div>
            <div><SectionLabel>期間</SectionLabel><PeriodBody f={f} defaults={defaults} set={set} /></div>
            <AreaBody f={f} set={set} columns={3} />
            <div><SectionLabel>類型</SectionLabel><CheckList columns={2} selected={f.types} onChange={v => set({ ...f, types: v })} options={TYPE_OPTIONS} /></div>
            <MoreBody f={f} set={set} />
          </div>
          <div style={{ padding: 12, borderTop: '1px solid var(--border-card)' }}>
            <button type="button" onClick={() => setSheetOpen(false)} style={{
              width: '100%', height: 44, borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
            }}>完成</button>
          </div>
        </div>
      )}

      <style>{`
        .tra-check:hover { background: var(--surface-hover); }
        .tra-count { display:inline-flex; align-items:center; justify-content:center; min-width:16px; height:16px; padding:0 4px;
          border-radius:999px; background:var(--accent); color:var(--on-accent); font-size:10px; font-weight:700; }
      `}</style>
    </div>
  )
}

/** Suspense 等待期間的佔位（同高度，避免版面跳動） */
export function FilterChipsFallback() {
  return <div style={{ height: 'var(--chips-h)', borderBottom: '1px solid var(--border-card)', background: 'var(--chrome-bg)' }} />
}

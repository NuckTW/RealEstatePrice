'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import FilterBar, { FilterValues, DEFAULT_FILTERS, ActiveFilterTags } from './FilterBar'
import KpiBar from './KpiBar'
import DataTable, { ColDef } from './DataTable'
import CaseDetailPanel from './CaseDetailPanel'

// 動態 import 避免 SSR（Leaflet 需要 window）
const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => (
  <div className="w-full rounded-2xl bg-[#0d1420] border border-white/6 flex items-center justify-center" style={{height: 'calc(100vh - 140px)'}}>
    <span className="text-gray-600 text-sm">地圖載入中…</span>
  </div>
) })

/* ── Column definitions ────────────────────────────────────── */
// Brass & Clay series colours
const S1='#d9912a', S2='#c0613d', S3='#4ca8e0', S6='#2bb3a3', S8='#cda86a'
const NEG='#e0573f', INFO='#4ca8e0'

const DIST_COLS: ColDef[] = [
  { key: 'district',   label: '行政區',      align: 'left' },
  { key: 'count',      label: '戶數',        barColor: S1,  minWidth: 72 },
  { key: 'unit_price', label: '單價(萬/坪)', barColor: S3,  minWidth: 72 },
  { key: 'area',       label: '坪數',        barColor: S6,  minWidth: 64 },
  { key: 'avg_total',  label: '均總價(萬)',  barColor: S2,  minWidth: 80 },
  { key: 'sales',      label: '總銷(億)',    barColor: S8,  minWidth: 64 },
  { key: 'pct',        label: '佔比',        barColor: INFO, format: v => `${v}%`, minWidth: 52 },
]

const TYPE_COLS: ColDef[] = [
  { key: 'type',  label: '類型', align: 'left',
    format: v => {
      const s = String(v ?? '')
      if (s.startsWith('住宅大樓')) return '住宅大樓'
      if (s.startsWith('透天厝'))  return '透天厝'
      if (s.startsWith('公寓'))    return '公寓'
      if (s.startsWith('華廈'))    return '華廈'
      if (s.startsWith('套房'))    return '套房'
      if (s.startsWith('辦公'))    return '辦公商業'
      return s.slice(0, 10)
    }
  },
  { key: 'count', label: '戶數',     barColor: S1, minWidth: 72 },
  { key: 'sales', label: '總銷(億)', barColor: S8, minWidth: 64 },
  { key: 'pct',   label: '佔比',     barColor: INFO, format: v => `${v}%`, minWidth: 52 },
]

const ROOMS_COLS: ColDef[] = [
  { key: 'rooms',      label: '房型',        align: 'left',
    format: v => v === 0 || v === '0' ? '0房' : `${v}房` },
  { key: 'count',      label: '戶數',        barColor: S1,  minWidth: 72 },
  { key: 'unit_price', label: '單價(萬/坪)', barColor: S3,  minWidth: 72 },
  { key: 'area',       label: '坪數',        barColor: S6,  minWidth: 64 },
  { key: 'avg_total',  label: '均總價(萬)',  barColor: S2,  minWidth: 80 },
  { key: 'sales',      label: '總銷(億)',    barColor: S8,  minWidth: 64 },
  { key: 'pct',        label: '佔比',        barColor: INFO, format: v => `${v}%`, minWidth: 52 },
  { key: 'min_price',  label: '最低(萬)',    barColor: S3,  minWidth: 72 },
  { key: 'max_price',  label: '最高(萬)',    barColor: NEG, minWidth: 72 },
]

function getCasesCols(presale: string): ColDef[] {
  const showType = presale === 'all'
  const cols: ColDef[] = [
    ...(showType ? [{
      key: 'case_type', label: '類型', align: 'left' as const,
      valueColors: {
        '預售': 'bg-sky-500/20 text-sky-300',
        '成屋': 'bg-teal-500/20 text-teal-300',
      }
    }] : []),
    { key: 'district',    label: '行政區',      align: 'left' },
    { key: 'name',        label: showType ? '建案／地址' : (presale === 'true' ? '建案名稱' : '地址'), align: 'left' },
    { key: 'total_count', label: '總戶數',      align: 'right',
      format: v => (v == null || v === '') ? 'x' : Number(v).toLocaleString() },
    { key: 'count',       label: '銷售戶數',    barColor: S1, minWidth: 72 },
    { key: 'sales_ratio', label: '銷售成數',    barColor: S3,
      format: v => (v == null || v === '') ? 'x' : `${v}%`, minWidth: 72 },
    { key: 'common_ratio', label: '公設比', align: 'right',
      format: v => (v == null || v === '') ? '—' : `${v}%` },
    { key: 'unit_price',  label: '單價(萬/坪)', barColor: S3, minWidth: 72 },
    { key: 'area',        label: '坪數',        barColor: S6, minWidth: 64 },
    { key: 'avg_total',   label: '均總價(萬)',  barColor: S2, minWidth: 80 },
    { key: 'sales',       label: '總銷(億)',    barColor: S8, minWidth: 64 },
    { key: 'min_price',   label: '最低(萬)',    barColor: INFO, minWidth: 72 },
    { key: 'max_price',   label: '最高(萬)',    barColor: NEG, minWidth: 72 },
  ]
  return cols
}

/* ── Types ─────────────────────────────────────────────────── */
interface ChartData {
  kpi: {
    total?: number
    avg_unit_price?: number
    avg_area?: number
    avg_total?: number
    total_sales?: number
  }
  districts: Record<string, unknown>[]
  types:     Record<string, unknown>[]
  rooms:     Record<string, unknown>[]
  cases:     Record<string, unknown>[]
}

/* ── Skeleton ──────────────────────────────────────────────── */
function Skeleton() {
  const card = { borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-card)', background: 'var(--surface-card)', opacity: 0.5 }
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, animation: 'pulse 2s ease-in-out infinite' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ ...card, height: 80 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.6fr', gap: 16 }}>
        <div style={{ ...card, height: 256 }} />
        <div style={{ ...card, height: 256 }} />
      </div>
      <div style={{ ...card, height: 192 }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:.8} }`}</style>
    </div>
  )
}

/* ── Dashboard ─────────────────────────────────────────────── */
export default function Dashboard() {
  const [data, setData]       = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS)
  const [activeTab, setActiveTab] = useState<'data' | 'map'>('data')

  // Case detail panel state
  const [panelOpen, setPanelOpen]         = useState(false)
  const [panelCase, setPanelCase]         = useState<{ name: string; district: string; caseType: 'presale' | 'existing' } | null>(null)

  const fetchData = useCallback(async (f: FilterValues) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({
        dateFromYear: f.dateFromYear, dateFromMonth: f.dateFromMonth,
        dateToYear:   f.dateToYear,   dateToMonth:   f.dateToMonth,
        presale: f.presale, buildingAge: f.buildingAge,
      })
      if (f.types.length > 0)     p.set('types', f.types.join(','))
      if (f.rooms.length > 0)     p.set('rooms', f.rooms.join(','))
      if (f.districts.length > 0) p.set('districts', f.districts.join(','))
      const res  = await fetch(`/api/charts?${p}`)
      const json = await res.json()
      if (!json.error) setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(DEFAULT_FILTERS) }, [fetchData])

  const handleApply = (f: FilterValues) => { setFilters(f); fetchData(f) }

  // 標籤刪除 → 立即套用
  const handleTagRemove = (updated: FilterValues) => {
    setFilters(updated)
    fetchData(updated)
  }

  // 點擊個案列 → 開啟詳情面板
  const handleCaseClick = (row: Record<string, unknown>) => {
    const rawType = String(row.case_type ?? '')
    // 純預售模式下 case_type 欄不存在，用 filters.presale 判斷
    const caseType: 'presale' | 'existing' =
      rawType === '預售' ? 'presale' :
      rawType === '成屋' ? 'existing' :
      filters.presale === 'true' ? 'presale' : 'existing'

    setPanelCase({
      name:     String(row.name     ?? ''),
      district: String(row.district ?? ''),
      caseType,
    })
    setPanelOpen(true)
  }

  const dateRange = `${filters.dateFromYear}年${filters.dateFromMonth}月 ～ ${filters.dateToYear}年${filters.dateToMonth}月`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <FilterBar onApply={handleApply} loading={loading} />

      {/* Tab 切換 */}
      <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        {([
          { id: 'data', label: '▦ 數據看板' },
          { id: 'map',  label: '◵ 地圖' },
        ] as const).map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 'var(--control-h-sm)', padding: '0 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                fontFamily: 'var(--font-sans)',
                background: active ? 'var(--accent-wash)' : 'transparent',
                color: active ? 'var(--accent-tint)' : 'var(--text-muted)',
                border: active ? '1px solid var(--accent-wash-border)' : '1px solid transparent',
                cursor: 'pointer', transition: 'var(--transition-base)',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Case detail panel */}
      <CaseDetailPanel
        open={panelOpen}
        caseName={panelCase?.name ?? ''}
        caseType={panelCase?.caseType ?? 'presale'}
        district={panelCase?.district ?? ''}
        filters={filters}
        onClose={() => setPanelOpen(false)}
      />

      {/* ── 地圖 tab ── */}
      {activeTab === 'map' && (
        <div className="px-5 pt-3 pb-6">
          <div className="px-0 pt-1 pb-2">
            <ActiveFilterTags filters={filters} onRemove={handleTagRemove} />
          </div>
          <MapView
            filters={filters}
            onCaseClick={(name, caseType, district) => {
              setPanelCase({ name, caseType, district })
              setPanelOpen(true)
            }}
          />
        </div>
      )}

      {/* ── 數據 tab ── */}
      {activeTab === 'data' && (
        <>
          {/* Loading state */}
          {loading && !data && <Skeleton />}

          {/* Refetch overlay */}
          {loading && data && (
            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 40, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-full)', padding: '6px 16px', boxShadow: 'var(--shadow-pop)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
              <span style={{ width: 12, height: 12, border: '1.5px solid var(--border-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'tra-spin .6s linear infinite', display: 'inline-block' }} />
              更新中…
            </div>
          )}

          {data && (
            <div className="pb-10">
              {/* Active filter tags */}
              <div className="px-5 pt-3">
                <ActiveFilterTags filters={filters} onRemove={handleTagRemove} />
              </div>

              {/* KPI */}
              <KpiBar data={data.kpi} dateRange={dateRange} />

              {/* Divider */}
              <div style={{ margin: '0 20px 16px', height: 1, background: 'var(--border-card)' }} />

              <div className="px-5 space-y-4">
                {/* Row 1: Districts + Types */}
                <div className="grid grid-cols-1 xl:grid-cols-[3fr_1.6fr] gap-4">
                  <DataTable title="行政區排行" columns={DIST_COLS}  data={data.districts} pageSize={8} />
                  <DataTable title="類型統計"   columns={TYPE_COLS}  data={data.types}     pageSize={8} />
                </div>

                {/* Row 2: Rooms */}
                <DataTable title="房型統計" columns={ROOMS_COLS} data={data.rooms} pageSize={10} />

                {/* Row 3: Cases */}
                <DataTable
                  title={
                    filters.presale === 'true' ? '個案統計（預售屋）' :
                    filters.presale === 'false' ? '個案統計（成屋）' :
                    '個案統計（成屋 ＋ 預售屋）'
                  }
                  columns={getCasesCols(filters.presale)}
                  data={data.cases}
                  pageSize={10}
                  onRowClick={handleCaseClick}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

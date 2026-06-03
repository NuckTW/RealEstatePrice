'use client'

import { useState, useEffect, useCallback } from 'react'
import FilterBar, { FilterValues, DEFAULT_FILTERS, ActiveFilterTags } from './FilterBar'
import KpiBar from './KpiBar'
import DataTable, { ColDef } from './DataTable'

/* ── Column definitions ────────────────────────────────────── */
const DIST_COLS: ColDef[] = [
  { key: 'district',   label: '行政區',      align: 'left' },
  { key: 'count',      label: '戶數',        barColor: '#8b5cf6', minWidth: 72 },
  { key: 'unit_price', label: '單價(萬/坪)', barColor: '#06b6d4', minWidth: 72 },
  { key: 'area',       label: '坪數',        barColor: '#14b8a6', minWidth: 64 },
  { key: 'avg_total',  label: '均總價(萬)',  barColor: '#f59e0b', minWidth: 80 },
  { key: 'sales',      label: '總銷(億)',    barColor: '#10b981', minWidth: 64 },
  { key: 'pct',        label: '佔比',        barColor: '#6366f1', format: v => `${v}%`, minWidth: 52 },
]

const TYPE_COLS: ColDef[] = [
  { key: 'type',  label: '類型',     align: 'left',
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
  { key: 'count', label: '戶數',     barColor: '#8b5cf6', minWidth: 72 },
  { key: 'sales', label: '總銷(億)', barColor: '#10b981', minWidth: 64 },
  { key: 'pct',   label: '佔比',     barColor: '#6366f1', format: v => `${v}%`, minWidth: 52 },
]

const ROOMS_COLS: ColDef[] = [
  { key: 'rooms',      label: '房型',        align: 'left',
    format: v => v === 0 || v === '0' ? '0房' : `${v}房` },
  { key: 'count',      label: '戶數',        barColor: '#8b5cf6', minWidth: 72 },
  { key: 'unit_price', label: '單價(萬/坪)', barColor: '#06b6d4', minWidth: 72 },
  { key: 'area',       label: '坪數',        barColor: '#14b8a6', minWidth: 64 },
  { key: 'avg_total',  label: '均總價(萬)',  barColor: '#f59e0b', minWidth: 80 },
  { key: 'sales',      label: '總銷(億)',    barColor: '#10b981', minWidth: 64 },
  { key: 'pct',        label: '佔比',        barColor: '#6366f1', format: v => `${v}%`, minWidth: 52 },
  { key: 'min_price',  label: '最低(萬)',    barColor: '#3b82f6', minWidth: 72 },
  { key: 'max_price',  label: '最高(萬)',    barColor: '#ef4444', minWidth: 72 },
]

const CASES_COLS: ColDef[] = [
  { key: 'district',    label: '行政區',      align: 'left' },
  { key: 'name',        label: '建案名稱',    align: 'left' },
  { key: 'total_count', label: '總戶數',      align: 'right',
    format: v => (v == null || v === '') ? 'x' : Number(v).toLocaleString() },
  { key: 'count',       label: '銷售戶數',    barColor: '#8b5cf6', minWidth: 72 },
  { key: 'sales_ratio', label: '銷售成數',    barColor: '#a78bfa',
    format: v => (v == null || v === '') ? 'x' : `${v}%`, minWidth: 72 },
  { key: 'unit_price',  label: '單價(萬/坪)', barColor: '#06b6d4', minWidth: 72 },
  { key: 'area',        label: '坪數',        barColor: '#14b8a6', minWidth: 64 },
  { key: 'avg_total',   label: '均總價(萬)',  barColor: '#f59e0b', minWidth: 80 },
  { key: 'sales',       label: '總銷(億)',    barColor: '#10b981', minWidth: 64 },
  { key: 'min_price',   label: '最低(萬)',    barColor: '#3b82f6', minWidth: 72 },
  { key: 'max_price',   label: '最高(萬)',    barColor: '#ef4444', minWidth: 72 },
]

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
  return (
    <div className="px-5 py-4 space-y-4 animate-pulse">
      {/* KPI skeletons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/4 border border-white/5" />
        ))}
      </div>
      {/* Table skeletons */}
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_1.6fr] gap-4">
        <div className="h-64 rounded-2xl bg-white/4 border border-white/5" />
        <div className="h-64 rounded-2xl bg-white/4 border border-white/5" />
      </div>
      <div className="h-48 rounded-2xl bg-white/4 border border-white/5" />
    </div>
  )
}

/* ── Dashboard ─────────────────────────────────────────────── */
export default function Dashboard() {
  const [data, setData]       = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS)

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

  const dateRange = `${filters.dateFromYear}年${filters.dateFromMonth}月 ～ ${filters.dateToYear}年${filters.dateToMonth}月`

  return (
    <div className="min-h-screen bg-[#080d16]">
      <FilterBar onApply={handleApply} loading={loading} />

      {/* Loading state */}
      {loading && !data && <Skeleton />}

      {/* Refetch overlay */}
      {loading && data && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-[#111827] border border-white/10 rounded-full px-4 py-2 shadow-2xl text-xs text-gray-300">
          <span className="w-3 h-3 border border-gray-500 border-t-violet-400 rounded-full animate-spin" />
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
          <div className="mx-5 h-px bg-white/4 mb-4" />

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
              title="個案統計（預售屋）"
              columns={CASES_COLS}
              data={data.cases}
              pageSize={10}
            />
          </div>
        </div>
      )}
    </div>
  )
}

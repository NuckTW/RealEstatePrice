'use client'

import { useState, useEffect, useCallback } from 'react'
import FilterBar, { FilterValues, DEFAULT_FILTERS } from './FilterBar'
import KpiBar from './KpiBar'
import DataTable, { ColDef } from './DataTable'

/* ── Column definitions ────────────────────────────────────── */
const DIST_COLS: ColDef[] = [
  { key: 'district',  label: '行政區',     align: 'left' },
  { key: 'count',     label: '戶數',       barColor: '#7c3aed', minWidth: 72 },
  { key: 'unit_price',label: '單價(萬/坪)',barColor: '#0891b2', minWidth: 72 },
  { key: 'area',      label: '坪數',       barColor: '#0d9488', minWidth: 64 },
  { key: 'avg_total', label: '均總價(萬)', barColor: '#d97706', minWidth: 80 },
  { key: 'sales',     label: '總銷(億)',   barColor: '#059669', minWidth: 64 },
  { key: 'pct',       label: '佔比', barColor: '#2563eb', format: v => `${v}%`, minWidth: 52 },
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
  { key: 'count', label: '戶數',     barColor: '#7c3aed', minWidth: 72 },
  { key: 'sales', label: '總銷(億)', barColor: '#059669', minWidth: 64 },
  { key: 'pct',   label: '佔比', barColor: '#2563eb', format: v => `${v}%`, minWidth: 52 },
]

const ROOMS_COLS: ColDef[] = [
  { key: 'rooms',     label: '房型',       align: 'left',
    format: v => v === 0 || v === '0' ? '0房' : `${v}房` },
  { key: 'count',     label: '戶數',       barColor: '#7c3aed', minWidth: 72 },
  { key: 'unit_price',label: '單價(萬/坪)',barColor: '#0891b2', minWidth: 72 },
  { key: 'area',      label: '坪數',       barColor: '#0d9488', minWidth: 64 },
  { key: 'avg_total', label: '均總價(萬)', barColor: '#d97706', minWidth: 80 },
  { key: 'sales',     label: '總銷(億)',   barColor: '#059669', minWidth: 64 },
  { key: 'pct',       label: '佔比', barColor: '#2563eb', format: v => `${v}%`, minWidth: 52 },
  { key: 'min_price', label: '最低(萬)',   barColor: '#3b82f6', minWidth: 72 },
  { key: 'max_price', label: '最高(萬)',   barColor: '#e11d48', minWidth: 72 },
]

const CASES_COLS: ColDef[] = [
  { key: 'district',  label: '行政區',     align: 'left' },
  { key: 'name',      label: '建案名稱',   align: 'left' },
  { key: 'count',     label: '戶數',       barColor: '#7c3aed', minWidth: 64 },
  { key: 'unit_price',label: '單價(萬/坪)',barColor: '#0891b2', minWidth: 72 },
  { key: 'area',      label: '坪數',       barColor: '#0d9488', minWidth: 64 },
  { key: 'avg_total', label: '均總價(萬)', barColor: '#d97706', minWidth: 80 },
  { key: 'sales',     label: '總銷(億)',   barColor: '#059669', minWidth: 64 },
  { key: 'min_price', label: '最低(萬)',   barColor: '#3b82f6', minWidth: 72 },
  { key: 'max_price', label: '最高(萬)',   barColor: '#e11d48', minWidth: 72 },
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

/* ── Dashboard ─────────────────────────────────────────────── */
export default function Dashboard() {
  const [data, setData]       = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS)

  const fetchData = useCallback(async (f: FilterValues) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ months: f.months, type: f.type, rooms: f.rooms, presale: f.presale })
      if (f.districts.length > 0) p.set('districts', f.districts.join(','))
      const res  = await fetch(`/api/charts?${p}`)
      const json = await res.json()
      if (!json.error) setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(DEFAULT_FILTERS) }, [fetchData])

  const handleApply = (f: FilterValues) => {
    setFilters(f)
    fetchData(f)
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <FilterBar onApply={handleApply} loading={loading} />

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse text-sm">
          載入資料中…
        </div>
      )}

      {data && (
        <>
          <KpiBar data={data.kpi} months={filters.months} />

          <div className="p-5 space-y-5">
            {/* Row 1: Districts + Types */}
            <div className="grid grid-cols-1 xl:grid-cols-[3fr_1.6fr] gap-5">
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
        </>
      )}
    </div>
  )
}

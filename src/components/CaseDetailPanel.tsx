'use client'

import { useEffect, useState } from 'react'
import { FilterValues } from './FilterBar'

interface DetailRow {
  transaction_date: string
  floor: string | null
  total_floors: string | null
  rooms: number
  area: number | null
  unit_price: number | null
  total_price: number | null
  parking_price: string | null
  // 擴充欄位
  unit_number: string | null
  building_type: string | null
  main_material: string | null
  main_area: number | null
  aux_area: number | null
  balcony_area: number | null
  land_area: number | null
  urban_land_use: string | null
  parking_type: string | null
  parking_area: number | null
  bathrooms: number | null
  living_rooms: number | null
}

interface Props {
  open: boolean
  caseName: string
  caseType: 'presale' | 'existing'
  district: string
  filters: FilterValues
  onClose: () => void
}

function rocDate(iso: string) {
  const d = new Date(iso)
  const roc = d.getFullYear() - 1911
  return `${roc}年${d.getMonth() + 1}月${d.getDate()}日`
}

function sqm(v: number | null) {
  return v != null && v > 0 ? `${v}坪` : null
}

/** 展開行：建物面積細項 + 車位 + 土地 */
function ExpandedDetail({ row, caseType }: { row: DetailRow; caseType: 'presale' | 'existing' }) {
  const hasAreaBreakdown = caseType === 'existing' &&
    (row.main_area != null || row.aux_area != null || row.balcony_area != null)
  const hasParking = row.parking_type && row.parking_type !== ''
  const hasLand = row.land_area != null && row.land_area > 0

  return (
    <div className="px-4 py-3 bg-white/[0.02] border-t border-white/[0.04] grid grid-cols-1 gap-3">

      {/* 棟號 + 建材 + 型態 */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
        {row.unit_number && (
          <span>
            <span className="text-gray-500">棟號</span>
            <span className="text-gray-200 ml-1.5 font-medium">{row.unit_number}</span>
          </span>
        )}
        {row.building_type && (
          <span>
            <span className="text-gray-500">型態</span>
            <span className="text-gray-300 ml-1.5">{row.building_type}</span>
          </span>
        )}
        {row.main_material && (
          <span>
            <span className="text-gray-500">建材</span>
            <span className="text-gray-300 ml-1.5">{row.main_material}</span>
          </span>
        )}
        {row.bathrooms != null && row.bathrooms > 0 && (
          <span>
            <span className="text-gray-500">格局</span>
            <span className="text-gray-300 ml-1.5">
              {row.rooms}房{row.living_rooms ?? 0}廳{row.bathrooms}衛
            </span>
          </span>
        )}
      </div>

      {/* 建物面積細項（成屋才有） */}
      {hasAreaBreakdown && (
        <div>
          <div className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">建物面積細項</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {sqm(row.main_area) && (
              <span>
                <span className="text-gray-500">主建物</span>
                <span className="text-teal-400 ml-1.5 font-medium">{sqm(row.main_area)}</span>
              </span>
            )}
            {sqm(row.aux_area) && (
              <span>
                <span className="text-gray-500">附屬</span>
                <span className="text-gray-300 ml-1.5">{sqm(row.aux_area)}</span>
              </span>
            )}
            {sqm(row.balcony_area) && (
              <span>
                <span className="text-gray-500">陽台</span>
                <span className="text-gray-300 ml-1.5">{sqm(row.balcony_area)}</span>
              </span>
            )}
            {row.area != null && row.main_area != null && (() => {
              const common = Math.round((row.area - (row.main_area ?? 0) - (row.aux_area ?? 0) - (row.balcony_area ?? 0)) * 10) / 10
              return common > 0 ? (
                <span>
                  <span className="text-gray-500">公設</span>
                  <span className="text-gray-400 ml-1.5">{common}坪</span>
                  <span className="text-gray-600 ml-1">
                    ({Math.round(common / row.area * 100)}%)
                  </span>
                </span>
              ) : null
            })()}
          </div>
        </div>
      )}

      {/* 預售屋公設比說明 */}
      {caseType === 'presale' && (
        <div className="text-[10px] text-gray-600 italic">
          預售屋資料不含主建物/陽台細項，公設比無法計算
        </div>
      )}

      {/* 車位 */}
      {hasParking && (
        <div>
          <div className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">車位</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span>
              <span className="text-gray-500">類別</span>
              <span className="text-gray-300 ml-1.5">{row.parking_type}</span>
            </span>
            {row.parking_area != null && row.parking_area > 0 && (
              <span>
                <span className="text-gray-500">面積</span>
                <span className="text-gray-300 ml-1.5">{row.parking_area}坪</span>
              </span>
            )}
            {row.parking_price !== 'x' && row.parking_price !== '含' && row.parking_price && (
              <span>
                <span className="text-gray-500">價格</span>
                <span className="text-amber-400 ml-1.5 font-medium">{row.parking_price}萬</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* 土地 */}
      {hasLand && (
        <div>
          <div className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">土地</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span>
              <span className="text-gray-500">移轉面積</span>
              <span className="text-gray-300 ml-1.5">{row.land_area}坪</span>
            </span>
            {row.urban_land_use && (
              <span>
                <span className="text-gray-500">用途</span>
                <span className="text-gray-300 ml-1.5">{row.urban_land_use}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CaseDetailPanel({ open, caseName, caseType, district, filters, onClose }: Props) {
  const [rows, setRows]         = useState<DetailRow[]>([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !caseName) return
    setRows([])
    setExpanded(null)
    setLoading(true)

    const p = new URLSearchParams({
      name:          caseName,
      district:      district,
      case_type:     caseType === 'presale' ? 'presale' : 'existing',
      dateFromYear:  filters.dateFromYear,
      dateFromMonth: filters.dateFromMonth,
      dateToYear:    filters.dateToYear,
      dateToMonth:   filters.dateToMonth,
    })

    fetch(`/api/case-detail?${p}`)
      .then(r => r.json())
      .then(j => setRows(j.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [open, caseName, caseType, district, filters])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const headers = ['#', '交易日期', '棟號', '樓層', '房型', '坪數', '單價(萬/坪)', '總價(萬)', '車位(萬)']

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[3000] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 z-[3100] h-full w-full max-w-2xl
          bg-[#0d1420] border-l border-white/8 shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/6 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                caseType === 'presale'
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'bg-teal-500/20 text-teal-300'
              }`}>
                {caseType === 'presale' ? '預售' : '成屋'}
              </span>
              <span className="text-[11px] text-gray-500">{district}</span>
            </div>
            <h2 className="text-base font-semibold text-white leading-tight">{caseName}</h2>
            {!loading && rows.length > 0 && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                共 {rows.length} 筆交易紀錄
                {caseType === 'presale' && <span className="text-gray-600 ml-1">（完整銷售期）</span>}
                <span className="text-gray-700 ml-1">· 點擊列可展開詳情</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-gray-400 hover:text-white flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32 gap-2 text-gray-500 text-sm">
              <span className="w-4 h-4 border border-gray-600 border-t-violet-400 rounded-full animate-spin" />
              載入中…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-600 text-sm">
              <span className="text-2xl opacity-30">◌</span>
              <span>無交易紀錄</span>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0d1420] z-10">
                <tr className="border-b border-white/5">
                  {headers.map((h, hi) => (
                    <th
                      key={h}
                      className={`px-2 py-2.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap
                        ${hi === 0 ? 'text-center w-7' : hi <= 3 ? 'text-left' : 'text-right'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <>
                    <tr
                      key={i}
                      onClick={() => setExpanded(expanded === i ? null : i)}
                      className={`border-b border-white/[0.03] cursor-pointer transition-colors
                        ${expanded === i ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                    >
                      {/* # 編號 */}
                      <td className="px-2 py-2.5 text-center text-gray-600 tabular-nums text-[10px]">
                        {i + 1}
                      </td>

                      {/* 交易日期 */}
                      <td className="px-2 py-2.5 text-gray-300 whitespace-nowrap tabular-nums">
                        {rocDate(row.transaction_date)}
                      </td>

                      {/* 棟號 */}
                      <td className="px-2 py-2.5 whitespace-nowrap">
                        {row.unit_number
                          ? <span className="text-violet-300 text-[10px] font-medium">{row.unit_number}</span>
                          : <span className="text-gray-700">—</span>}
                      </td>

                      {/* 樓層 */}
                      <td className="px-2 py-2.5 text-gray-300 whitespace-nowrap">
                        {row.floor != null
                          ? (row.total_floors != null
                              ? `${row.floor}／共${row.total_floors}層`
                              : `${row.floor}`)
                          : '—'}
                      </td>

                      {/* 房型 */}
                      <td className="px-2 py-2.5 text-gray-300 whitespace-nowrap text-right">
                        {row.rooms === 0 ? '0房' : `${row.rooms}房`}
                      </td>

                      {/* 坪數 */}
                      <td className="px-2 py-2.5 text-gray-300 whitespace-nowrap tabular-nums text-right">
                        {row.area ?? '—'}
                      </td>

                      {/* 單價 */}
                      <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-right">
                        <span className="text-cyan-400 font-medium">
                          {row.unit_price ?? '—'}
                        </span>
                      </td>

                      {/* 總價 */}
                      <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-right">
                        <span className="text-amber-400 font-medium">
                          {row.total_price != null ? row.total_price.toLocaleString() : '—'}
                        </span>
                      </td>

                      {/* 車位 */}
                      <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-right">
                        {row.parking_price === 'x'
                          ? <span className="text-gray-600">x</span>
                          : row.parking_price === '含'
                            ? <span className="text-gray-400 text-[10px]">含</span>
                            : <span className="text-gray-300">{row.parking_price}</span>}
                      </td>
                    </tr>

                    {/* 展開明細 */}
                    {expanded === i && (
                      <tr key={`exp-${i}`} className="border-b border-white/[0.06]">
                        <td colSpan={9} className="p-0">
                          <ExpandedDetail row={row} caseType={caseType} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

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
  // '2025-04-17' → '114年4月17日'
  const d = new Date(iso)
  const roc = d.getFullYear() - 1911
  return `${roc}年${d.getMonth() + 1}月${d.getDate()}日`
}

export default function CaseDetailPanel({ open, caseName, caseType, district, filters, onClose }: Props) {
  const [rows, setRows]       = useState<DetailRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !caseName) return
    setRows([])
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

  const headers = ['#', '交易日期', '樓層', '房型', '坪數', '單價(萬/坪)', '總價(萬)', '車位(萬)']

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
                      className={`px-3 py-2.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap
                        ${hi === 0 ? 'text-center w-8' : hi <= 2 ? 'text-left' : 'text-right'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                  >
                    {/* # 編號 */}
                    <td className="px-3 py-2.5 text-center text-gray-600 tabular-nums text-[10px]">
                      {i + 1}
                    </td>

                    {/* 交易日期 */}
                    <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap tabular-nums">
                      {rocDate(row.transaction_date)}
                    </td>

                    {/* 樓層 */}
                    <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">
                      {row.floor != null
                        ? (row.total_floors != null
                            ? `${row.floor}／共${row.total_floors}層`
                            : `${row.floor}`)
                        : '—'}
                    </td>

                    {/* 房型 */}
                    <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap text-right">
                      {row.rooms === 0 ? '0房' : `${row.rooms}房`}
                    </td>

                    {/* 坪數 */}
                    <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap tabular-nums text-right">
                      {row.area ?? '—'}
                    </td>

                    {/* 單價 */}
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-right">
                      <span className="text-cyan-400 font-medium">
                        {row.unit_price ?? '—'}
                      </span>
                    </td>

                    {/* 總價 */}
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-right">
                      <span className="text-amber-400 font-medium">
                        {row.total_price != null ? row.total_price.toLocaleString() : '—'}
                      </span>
                    </td>

                    {/* 車位 */}
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-right">
                      {row.parking_price === 'x'
                        ? <span className="text-gray-600">x</span>
                        : row.parking_price === '含'
                          ? <span className="text-gray-400 text-[10px]">含</span>
                          : <span className="text-gray-300">{row.parking_price}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

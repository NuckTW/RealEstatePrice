'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect } from 'react'
import type { PresaleMarker } from '@/components/AreaAnalysisMap'
import type { FilterValues } from './FilterBar'

const AreaAnalysisMap   = dynamic(() => import('./AreaAnalysisMap'),   { ssr: false })
const AreaAnalysisPanel = dynamic(() => import('./AreaAnalysisPanel'), { ssr: false })

interface Props {
  filters: FilterValues
}

export default function AreaAnalysisTab({ filters }: Props) {
  const [markers,  setMarkers]  = useState<PresaleMarker[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)

  /* 篩選器變動 → 重新載入預售屋標記 */
  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({
      dateFromYear:  filters.dateFromYear,
      dateFromMonth: filters.dateFromMonth,
      dateToYear:    filters.dateToYear,
      dateToMonth:   filters.dateToMonth,
      presale:       'true',
      buildingAge:   filters.buildingAge,
    })
    if (filters.types.length     > 0) p.set('types',     filters.types.join(','))
    if (filters.rooms.length     > 0) p.set('rooms',     filters.rooms.join(','))
    if (filters.districts.length > 0) p.set('districts', filters.districts.join(','))

    fetch(`/api/map?${p}`)
      .then(r => r.json())
      .then(d => {
        setMarkers((d.markers ?? []).filter(
          (m: PresaleMarker & { case_type: string }) => m.case_type === '預售'
        ))
        setSelected([])
      })
      .finally(() => setLoading(false))
  }, [filters])

  const handleBoundsSelect = useCallback((keys: string[]) => {
    setSelected(prev => {
      const next = [...prev]
      keys.forEach(k => { if (!next.includes(k)) next.push(k) })
      return next.slice(0, 15)
    })
  }, [])

  const handleMarkerToggle = useCallback((key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key].slice(0, 15)
    )
  }, [])

  const handleRemove = useCallback((key: string) => {
    setSelected(prev => prev.filter(k => k !== key))
  }, [])

  const handleAdd = useCallback((key: string) => {
    setSelected(prev => prev.includes(key) ? prev : [...prev, key].slice(0, 15))
  }, [])

  return (
    <div style={{ padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10, height: 'calc(100vh - var(--nav-h) - 108px)', minHeight: 500 }}>
      {/* 說明列 + 清除按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          在地圖右上角點「矩形」工具框選範圍，或直接點擊建案標記加入分析（最多 15 個）
        </p>
        {selected.length > 0 && (
          <button
            onClick={() => setSelected([])}
            style={{ fontSize: 11, padding: '3px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
          >
            清除全部
          </button>
        )}
      </div>

      {/* 主體：地圖 + 面板 */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, minHeight: 0 }}>
        {/* 地圖 */}
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-card)' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,13,22,.7)', zIndex: 1000, fontSize: 13, color: '#9ca3af' }}>
              載入建案資料…
            </div>
          )}
          <AreaAnalysisMap
            markers={markers}
            selected={selected}
            onBoundsSelect={handleBoundsSelect}
            onMarkerToggle={handleMarkerToggle}
          />
        </div>

        {/* 分析面板 */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-card)', borderRadius: 16, padding: '14px 12px', overflowY: 'auto' }}>
          <AreaAnalysisPanel
            selected={selected}
            onRemove={handleRemove}
            onAdd={handleAdd}
          />
        </div>
      </div>
    </div>
  )
}

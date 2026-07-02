'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { PresaleMarker } from '@/components/AreaAnalysisMap'
import type { FilterValues } from './FilterBar'
import { MAX_SELECT } from '@/lib/areaSelection'

const AreaAnalysisMap   = dynamic(() => import('./AreaAnalysisMap'),   { ssr: false })
const AreaAnalysisPanel = dynamic(() => import('./AreaAnalysisPanel'), { ssr: false })

interface Props {
  filters: FilterValues
}

export default function AreaAnalysisTab({ filters }: Props) {
  const [markers,  setMarkers]  = useState<PresaleMarker[]>([])
  // 初始選取從 URL ?projects= 還原（分享連結）
  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    return (new URLSearchParams(window.location.search).get('projects') ?? '')
      .split(',').filter(Boolean).slice(0, MAX_SELECT)
  })
  const [loading,  setLoading]  = useState(true)

  /* 選取變更 → 寫回 URL（保留 Dashboard 管理的其他參數） */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (selected.length) p.set('projects', selected.join(','))
    else p.delete('projects')
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [selected])

  /* 篩選器變動 → 重新載入預售屋標記（首次載入不清空選取，保留 URL 還原的建案） */
  const isFirstLoad = useRef(true)
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
        if (isFirstLoad.current) isFirstLoad.current = false
        else setSelected([])
      })
      .finally(() => setLoading(false))
  }, [filters])

  const handleBoundsSelect = useCallback((keys: string[]) => {
    setSelected(prev => {
      const next = [...prev]
      keys.forEach(k => { if (!next.includes(k)) next.push(k) })
      return next.slice(0, MAX_SELECT)
    })
  }, [])

  const handleMarkerToggle = useCallback((key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key].slice(0, MAX_SELECT)
    )
  }, [])

  const handleRemove = useCallback((key: string) => {
    setSelected(prev => prev.filter(k => k !== key))
  }, [])

  const handleAdd = useCallback((key: string) => {
    setSelected(prev => prev.includes(key) ? prev : [...prev, key].slice(0, MAX_SELECT))
  }, [])

  return (
    // 手機：自然高度直向堆疊（地圖固定高、面板往下長）；桌機（lg+）：滿版高度左右兩欄
    <div className="lg:h-[calc(100vh-var(--nav-h)-108px)]" style={{ padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 500 }}>
      {/* 說明列 + 清除按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          點「▭ 框選範圍」在地圖上拖拉矩形，或直接點擊建案標記加入分析（最多 {MAX_SELECT} 個）
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]" style={{ flex: 1, gap: 12, minHeight: 0 }}>
        {/* 地圖（手機固定 60vh，桌機吃滿欄高） */}
        <div className="h-[60vh] lg:h-auto" style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-card)' }}>
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

        {/* 分析面板（手機自然高度，桌機內部捲動） */}
        <div className="lg:overflow-y-auto" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-card)', borderRadius: 16, padding: '14px 12px' }}>
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

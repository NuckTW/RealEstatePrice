'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect } from 'react'
import type { PresaleMarker } from '@/components/AreaAnalysisMap'

const AreaAnalysisMap   = dynamic(() => import('@/components/AreaAnalysisMap'),   { ssr: false })
const AreaAnalysisPanel = dynamic(() => import('@/components/AreaAnalysisPanel'), { ssr: false })

export default function AreaAnalysisPage() {
  const [markers,  setMarkers]  = useState<PresaleMarker[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)

  /* 載入全部預售屋標記（不帶日期篩選） */
  useEffect(() => {
    fetch('/api/map?presale=true')
      .then(r => r.json())
      .then(d => setMarkers((d.markers ?? []).filter((m: PresaleMarker & { case_type: string }) => m.case_type === '預售')))
      .finally(() => setLoading(false))
  }, [])

  const handleBoundsSelect = useCallback((keys: string[]) => {
    setSelected(prev => {
      const next = [...prev]
      keys.forEach(k => { if (!next.includes(k)) next.push(k) })
      return next.slice(0, 10)
    })
  }, [])

  const handleMarkerToggle = useCallback((key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key].slice(0, 10)
    )
  }, [])

  const handleRemove = useCallback((key: string) => {
    setSelected(prev => prev.filter(k => k !== key))
  }, [])

  const handleAdd = useCallback((key: string) => {
    setSelected(prev => prev.includes(key) ? prev : [...prev, key].slice(0, 10))
  }, [])

  return (
    <div style={{ height: 'calc(100vh - var(--nav-h))', display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 12, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
            框選分析
          </h1>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', marginTop: 2 }}>
            在地圖右上角點「矩形」工具框選範圍，或直接點擊建案標記加入分析
          </p>
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => setSelected([])}
            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            清除全部
          </button>
        )}
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, minHeight: 0 }}>
        {/* Map */}
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-card)' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,13,22,.7)', zIndex: 1000, fontSize: 13, color: '#9ca3af' }}>
              <span style={{ marginRight: 8 }}>載入建案資料…</span>
            </div>
          )}
          <AreaAnalysisMap
            markers={markers}
            selected={selected}
            onBoundsSelect={handleBoundsSelect}
            onMarkerToggle={handleMarkerToggle}
          />
        </div>

        {/* Panel */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-card)', borderRadius: 16, padding: '16px 14px', overflowY: 'auto' }}>
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

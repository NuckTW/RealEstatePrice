'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const PermitTxChart = dynamic(() => import('./SupplyChart').then(m => m.PermitTxChart), {
  ssr: false, loading: () => <div style={centerStyle(380)}>圖表載入中…</div>,
})
const UnsoldDistrictChart = dynamic(() => import('./SupplyChart').then(m => m.UnsoldDistrictChart), {
  ssr: false, loading: () => <div style={centerStyle(380)}>圖表載入中…</div>,
})
const UnsoldTrendChart = dynamic(() => import('./SupplyChart').then(m => m.UnsoldTrendChart), {
  ssr: false, loading: () => <div style={centerStyle(380)}>圖表載入中…</div>,
})

interface ApiData {
  permits: Record<string, unknown>[]
  unsoldTrend: { quarter: string; total: number }[]
  unsoldByDistrict: { quarter: string | null; rows: { district: string; units: number }[] }
}

function centerStyle(h: number): React.CSSProperties {
  return { height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-sans)' }
}

function cardStyle(): React.CSSProperties {
  return {
    background: 'var(--surface-card)', border: '1px solid var(--border-card)',
    borderRadius: 'var(--radius-lg)', padding: 16,
  }
}

function sectionTitle(title: string, sub?: string) {
  return (
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-strong)' }}>{title}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 10 }}>{sub}</span>}
    </div>
  )
}

export default function SupplyPanel() {
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/supply')
      .then(r => r.json())
      .then(d => { if (d.error) setError(true); else setData(d) })
      .catch(() => setError(true))
  }, [])

  if (error) return <div style={centerStyle(300)}>資料載入失敗，請稍後再試</div>
  if (!data) return <div style={centerStyle(300)}>載入中…</div>

  return (
    <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-sans)' }}>

      <div style={cardStyle()}>
        {sectionTitle('建照／使照核發量 × 實價登錄成交量', '建照為供給領先指標，使照反映完工交屋；疊上成交量觀察供需是否平衡（民國年月）')}
        <PermitTxChart rows={data.permits} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
        <div style={cardStyle()}>
          {sectionTitle('各行政區待售新成屋', data.unsoldByDistrict.quarter ? `最新一季：${data.unsoldByDistrict.quarter}` : undefined)}
          <UnsoldDistrictChart rows={data.unsoldByDistrict.rows} />
        </div>
        <div style={cardStyle()}>
          {sectionTitle('全市待售新成屋趨勢', '季資料')}
          <UnsoldTrendChart rows={data.unsoldTrend} />
        </div>
      </div>
    </div>
  )
}

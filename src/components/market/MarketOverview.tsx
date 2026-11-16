'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import KpiBar, { type KpiData } from '@/components/KpiBar'
import DataTable from '@/components/DataTable'
import TransactionTable from '@/components/TransactionTable'
import CaseDetailPanel from '@/components/CaseDetailPanel'
import type { TrendRow } from '@/components/KpiTrend'
import { useGlobalFilters } from '@/hooks/useGlobalFilters'
import { useSite } from '@/components/shell/SiteContext'
import { buildApiQuery } from '@/lib/globalFilters'
import { BACKFILL_MONTHS } from '@/lib/backfill'
import { DIST_COLS, TYPE_COLS, ROOMS_COLS } from './statColumns'

const KpiTrend = dynamic(() => import('@/components/KpiTrend'), { ssr: false })

interface ChartData {
  kpi: KpiData
  districts: Record<string, unknown>[]
  types: Record<string, unknown>[]
  rooms: Record<string, unknown>[]
  trend?: TrendRow[]
}

const STAT_TABS = [
  { id: 'district', label: '行政區' },
  { id: 'type',     label: '建物類型' },
  { id: 'rooms',    label: '房型' },
] as const

/** 市場頁「概況」：吃全站篩選，KPI、量價走勢、分布統計、逐筆明細 */
export default function MarketOverview() {
  const { filters } = useGlobalFilters()
  const { lastDate } = useSite()
  const key = buildApiQuery(filters)

  const [res, setRes] = useState<{ key: string; data: ChartData | null } | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/charts?${key}`)
      .then(r => r.json())
      .then(j => { if (alive) setRes({ key, data: j.error ? null : j }) })
      .catch(() => { if (alive) setRes(prev => ({ key, data: prev?.data ?? null })) })
    return () => { alive = false }
  }, [key])
  const data = res?.data ?? null
  const loading = res?.key !== key

  const [statTab, setStatTab] = useState<(typeof STAT_TABS)[number]['id']>('district')
  const [detail, setDetail] = useState<{ name: string; district: string; caseType: 'presale' | 'existing' } | null>(null)

  // 迄月落在資料最新月往前 2 個月內：戶數會被低估
  const showBackfillWarning = useMemo(() => {
    if (!lastDate) return false
    const [ly, lm] = lastDate.split('-').map(Number)
    const diff = (ly * 12 + lm - 1) - ((Number(filters.dateToYear) + 1911) * 12 + Number(filters.dateToMonth) - 1)
    return diff >= 0 && diff <= BACKFILL_MONTHS
  }, [lastDate, filters.dateToYear, filters.dateToMonth])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
      {loading && (
        <div role="status" style={{ position: 'absolute', right: 0, top: -34, fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--border-strong)', borderTopColor: 'var(--accent)', animation: 'tra-spin .6s linear infinite' }} />
          更新中…
        </div>
      )}

      {!data && loading && <div style={{ height: 220, borderRadius: 'var(--radius-xl)', background: 'var(--surface-card)', opacity: 0.5 }} />}
      {!data && !loading && <div style={{ padding: 24, color: 'var(--text-faint)' }}>資料載入失敗，請稍後再試</div>}

      {data && (
        <>
          <div style={{ margin: '0 -20px' }}><KpiBar data={data.kpi} showBackfillWarning={showBackfillWarning} /></div>
          {data.trend && data.trend.length > 1 && <KpiTrend rows={data.trend} lastDataDate={lastDate} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div role="tablist" aria-label="分布統計" style={{ display: 'flex', gap: 6 }}>
              {STAT_TABS.map(t => (
                <button key={t.id} role="tab" aria-selected={statTab === t.id} onClick={() => setStatTab(t.id)} className="mk-tab" data-on={statTab === t.id || undefined}>
                  {t.label}
                </button>
              ))}
            </div>
            {statTab === 'district' && <DataTable title="行政區排行" columns={DIST_COLS} data={data.districts} pageSize={10} />}
            {statTab === 'type' && <DataTable title="類型統計" columns={TYPE_COLS} data={data.types} pageSize={10} />}
            {statTab === 'rooms' && <DataTable title="房型統計" columns={ROOMS_COLS} data={data.rooms} pageSize={10} />}
          </div>
        </>
      )}

      <TransactionTable filters={filters} onCaseClick={(name, caseType, district) => setDetail({ name, caseType, district })} />

      <CaseDetailPanel
        open={!!detail}
        caseName={detail?.name ?? ''}
        caseType={detail?.caseType ?? 'presale'}
        district={detail?.district ?? ''}
        filters={filters}
        onClose={() => setDetail(null)}
      />

      <style>{`
        .mk-tab { height:30px; padding:0 14px; border-radius:999px; border:1px solid transparent; background:transparent; cursor:pointer;
          font-size:var(--text-xs); font-weight:var(--weight-semibold); font-family:var(--font-sans); color:var(--text-muted); }
        .mk-tab[data-on] { background:var(--accent-wash); color:var(--accent-tint); border-color:var(--accent-wash-border); }
        @keyframes tra-spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { MultiSelect, StyledSelect } from './FilterBar'

const ProjectCompareChart = dynamic(() => import('./ProjectCompareChart'), {
  ssr: false,
  loading: () => <div style={centerStyle(460)}>圖表載入中…</div>,
})

export interface ProjectPoint {
  key: string; name: string; district: string; buildingType: string
  txCount: number; reliable: boolean
  priceMedian: number; priceP25: number | null; priceP75: number | null
  areaMedian: number; totalMedian: number
  firstTx: string; lastTx: string
}
interface ApiData { projects: ProjectPoint[]; districts: string[]; minReliableTx: number }

const MAX_SELECTED = 12
const ISO_LINES = [600, 800, 1000, 1200, 1500, 2000]

// 與 FilterBar 的選項值一致，確保與站上其他頁面篩選邏輯相同
const TYPE_OPTIONS = [
  { label: '住宅大樓', value: '住宅大樓' },
  { label: '華廈', value: '華廈' },
  { label: '透天厝', value: '透天厝' },
  { label: '公寓', value: '公寓' },
  { label: '店面', value: '店面' },
]
const ROOM_OPTIONS = [
  { label: '1房', value: '1' }, { label: '2房', value: '2' },
  { label: '3房', value: '3' }, { label: '4房', value: '4' },
  { label: '5房以上', value: '5+' },
]
const PRESALE_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '預售', value: 'true' },
  { label: '成屋', value: 'false' },
]

function centerStyle(h: number): React.CSSProperties {
  return { height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'var(--font-sans)' }
}
function cardStyle(): React.CSSProperties {
  return { background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 16 }
}
function chipStyle(active: boolean): React.CSSProperties {
  return {
    height: 26, padding: '0 10px', borderRadius: 'var(--radius-full)',
    fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: active ? 600 : 400,
    background: active ? 'var(--accent-wash)' : 'var(--surface-control)',
    color: active ? 'var(--accent-tint)' : 'var(--text-muted)',
    border: active ? '1px solid var(--accent-wash-border)' : '1px solid var(--border-control)',
    cursor: 'pointer', transition: 'var(--transition-base)', whiteSpace: 'nowrap',
  }
}

export default function ProjectComparePanel() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [district, setDistrict] = useState<string>('')
  const [selected, setSelected] = useState<string[]>([])
  const [hideUnreliable, setHideUnreliable] = useState(false)
  const [types, setTypes] = useState<string[]>([])
  const [rooms, setRooms] = useState<string[]>([])
  const [presale, setPresale] = useState('all')
  const [firstLoad, setFirstLoad] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (types.length) qs.set('types', types.join(','))
    if (rooms.length) qs.set('rooms', rooms.join(','))
    if (presale !== 'all') qs.set('presale', presale)

    fetch(`/api/project-compare?${qs}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) return
        setData(d)
        // 首次載入預設帶出成交量最大的 6 案；之後換篩選條件保留使用者的選擇
        if (firstLoad) {
          setSelected(d.projects.slice(0, 6).map((p: ProjectPoint) => p.key))
          setFirstLoad(false)
        }
      })
      .finally(() => setLoading(false))
  }, [types, rooms, presale, firstLoad])

  const byKey = useMemo(
    () => new Map((data?.projects ?? []).map(p => [p.key, p])),
    [data])

  const candidates = useMemo(() => {
    const list = data?.projects ?? []
    const kw = q.trim().toLowerCase()
    return list.filter(p =>
      (!district || p.district === district) &&
      (!kw || p.name.toLowerCase().includes(kw)) &&
      (!hideUnreliable || p.reliable)
    ).slice(0, 60)
  }, [data, q, district, hideUnreliable])

  const points = useMemo(
    () => selected.map(k => byKey.get(k)).filter((p): p is ProjectPoint => !!p),
    [selected, byKey])

  // 選了但在目前篩選條件下沒有交易的案 —— 要明講，不能讓它默默從圖上消失
  const droppedCount = selected.length - points.length

  const toggle = (key: string) => setSelected(s =>
    s.includes(key) ? s.filter(x => x !== key)
      : s.length >= MAX_SELECTED ? s : [...s, key])

  if (!data) {
    return (
      <div style={{ padding: 20 }}>
        <div style={centerStyle(460)}>{loading ? '載入中…' : '查詢失敗'}</div>
      </div>
    )
  }

  const unreliableCount = points.filter(p => !p.reliable).length
  const filtersActive = types.length > 0 || rooms.length > 0 || presale !== 'all'
  const districtsInView = [...new Set(points.map(p => p.district))]

  return (
    <div style={{ padding: '8px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={cardStyle()}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder={`搜尋建案（共 ${data.projects.length} 案）`}
            style={{
              height: 32, padding: '0 12px', minWidth: 220, flex: '0 1 280px',
              borderRadius: 'var(--radius-md)', fontSize: 13,
              background: 'var(--surface-control)', color: 'var(--text-default)',
              border: '1px solid var(--border-control)', fontFamily: 'var(--font-sans)',
            }} />
          <StyledSelect
            options={[{ label: '全部行政區', value: '' },
                      ...data.districts.map(d => ({ label: d, value: d }))]}
            value={district} onChange={setDistrict} />
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={hideUnreliable}
              onChange={e => setHideUnreliable(e.target.checked)} />
            只顯示 ≥{data.minReliableTx} 筆
          </label>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 'auto' }}>
            已選 {selected.length}/{MAX_SELECTED}
            {selected.length > 0 && (
              <button onClick={() => setSelected([])}
                style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
                清除
              </button>
            )}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
                      paddingBottom: 14, marginBottom: 12, borderBottom: '1px solid var(--border-card)' }}>
          <MultiSelect label="建築類型" options={TYPE_OPTIONS} selected={types}
            onChange={setTypes} placeholder="全部類型" />
          <MultiSelect label="房型" options={ROOM_OPTIONS} selected={rooms}
            onChange={setRooms} placeholder="全部房型" />
          <StyledSelect label="成/預售" options={PRESALE_OPTIONS}
            value={presale} onChange={setPresale} />
          {(types.length > 0 || rooms.length > 0 || presale !== 'all') && (
            <button onClick={() => { setTypes([]); setRooms([]); setPresale('all') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)',
                       cursor: 'pointer', fontSize: 12, height: 32 }}>
              重設篩選
            </button>
          )}
          {loading && (
            <span style={{ fontSize: 11, color: 'var(--text-faint)', height: 32,
                           display: 'flex', alignItems: 'center' }}>更新中…</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 132, overflowY: 'auto' }}>
          {candidates.map(p => (
            <button key={p.key} onClick={() => toggle(p.key)} style={chipStyle(selected.includes(p.key))}>
              {p.name}
              <span style={{ opacity: 0.65, marginLeft: 5 }}>
                {p.district.replace('區', '')} {p.txCount}
              </span>
              {!p.reliable && <span style={{ color: 'var(--negative)', marginLeft: 4 }}>·少</span>}
            </button>
          ))}
          {!candidates.length && (
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>沒有符合的建案</span>
          )}
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#4ca8e0', marginRight: 5 }} />樣本 ≥{data.minReliableTx} 筆</span>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: 'var(--text-faint)', marginRight: 5 }} />樣本不足，僅供參考</span>
          <span>圓圈大小 = 成交筆數</span>
          <span>虛線 = 總價等值線</span>
        </div>

        {points.length === 0
          ? <div style={centerStyle(460)}>請從上方選擇建案</div>
          : <ProjectCompareChart points={points} isoLines={ISO_LINES} />}

        {(unreliableCount > 0 || districtsInView.length > 1 || droppedCount > 0 || filtersActive) && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.9 }}>
            {filtersActive && (
              <div>目前數字是「符合篩選條件的交易」之中位數，不是各案全部交易的中位數。</div>
            )}
            {droppedCount > 0 && (
              <div>已選建案中有 {droppedCount} 案在目前篩選條件下沒有成交，暫時不顯示於圖表。</div>
            )}
            {unreliableCount > 0 && (
              <div>已選建案中有 {unreliableCount} 案成交筆數不足 {data.minReliableTx} 筆，其中位數等同少數幾筆的算術結果，不宜當作行情。</div>
            )}
            {districtsInView.length > 1 && (
              <div>目前混合了 {districtsInView.join('、')} 共 {districtsInView.length} 個行政區。跨區價差多來自區域而非產品競爭力，建議同區比較。</div>
            )}
          </div>
        )}
      </div>

      {points.length > 0 && (
        <div style={{ ...cardStyle(), overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
                {['建案', '行政區', '建物型態', '筆數', '中位單價', 'P25–P75', '中位坪數', '中位總價', '成交期間'].map((h, i) => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: i < 3 ? 'left' : 'right', fontWeight: 400, borderBottom: '1px solid var(--border-card)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...points].sort((a, b) => b.priceMedian - a.priceMedian).map(p => (
                <tr key={p.key} style={{ color: p.reliable ? 'var(--text-default)' : 'var(--text-faint)' }}>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-card)' }}>
                    {p.name}{!p.reliable && <span style={{ color: 'var(--negative)', marginLeft: 6 }}>樣本不足</span>}
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-card)' }}>{p.district}</td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-card)' }}>{p.buildingType}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)' }}>{p.txCount}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)' }}>{p.priceMedian}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)' }}>
                    {p.priceP25 != null ? `${p.priceP25}–${p.priceP75}` : '—'}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)' }}>{p.areaMedian}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)' }}>{p.totalMedian}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)' }}>{p.firstTx}～{p.lastTx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

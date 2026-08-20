'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'

const SearchMap = dynamic(() => import('./SearchMap'), {
  ssr: false,
  loading: () => <div style={centerStyle(480)}>地圖載入中…</div>,
})

/** /api/project-compare 回傳的建案摘要（欄位子集，第一版只用得到這些） */
interface ProjectSummary {
  key: string; name: string; district: string; buildingType: string
  txCount: number
  priceMedian: number; areaMedian: number; totalMedian: number
  firstTx: string; lastTx: string
}
interface ApiData { projects: ProjectSummary[]; minReliableTx: number }

/** /api/case-detail 回傳的交易明細（欄位子集） */
interface DetailRow {
  transaction_date: string
  floor: string | null
  total_floors: number | null
  rooms: number | null
  area: number | null
  unit_price: number | null
  total_price: number | null
  parking_price: string | null
  notes: string | null
}

const MAX_CANDIDATES = 20

function centerStyle(h: number): React.CSSProperties {
  return { height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }
}
function cardStyle(): React.CSSProperties {
  return { background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 16 }
}

/** ISO 日期 → 民國年/月/日（緊湊格式，供表格欄位使用） */
function rocDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const roc = d.getFullYear() - 1911
  return `${roc}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/** 樓層顯示：同 TransactionTable / CaseDetailPanel 的邏輯 */
function floorLabel(row: DetailRow): string {
  if (!row.floor) return '—'
  return row.total_floors != null ? `${row.floor}/${row.total_floors}` : row.floor
}

/** 註記判斷：特殊關係交易（警示色）與增建（頂樓加蓋／增建／陽台外推） */
function noteFlags(notes: string | null): { special: boolean; addition: boolean } {
  const s = notes ?? ''
  return {
    special: s.includes('特殊關係'),
    addition: s.includes('頂樓加蓋') || s.includes('增建') || s.includes('陽台外推'),
  }
}

export default function SearchPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // 只在第一次 render 讀 URL 參數當初始值，之後 URL 的變化由本元件自己寫入，不需要再讀回來
  // 用 useState 的 lazy initializer 而非 useRef：render 中不能讀取 ref.current
  const [initialQ] = useState(() => searchParams.get('q') ?? '')
  const appliedInitial = useRef(false)

  const [allData, setAllData] = useState<ApiData | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [q, setQ] = useState(initialQ)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ProjectSummary | null>(null)

  // 座標與明細各自用「目前資料對應哪個建案 key」當識別鍵推導 loading，
  // 不在 effect 裡同步 setState（跟 ProjectComparePanel 的作法一致）
  const [loc, setLoc] = useState<{ key: string; lat: number | null; lon: number | null } | null>(null)
  const [detail, setDetail] = useState<{ key: string; rows: DetailRow[] } | null>(null)

  const boxRef = useRef<HTMLDivElement>(null)

  // 一次抓回全市預售建案清單，前端做即時比對（見專案規格：不新寫搜尋 API）。
  // 若 URL 帶了 q，資料到齊的同一個 .then() 回呼裡順便自動選中對應建案（可分享連結）——
  // setState 要放在 promise 回呼（非同步）裡，不能直接寫在 effect 主體，否則會觸發
  // react-hooks/set-state-in-effect（同步 setState 導致串聯 rerender）
  useEffect(() => {
    let cancelled = false
    fetch('/api/project-compare?presale=true')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) { setLoadFailed(true); return }
        setAllData({ projects: d.projects, minReliableTx: d.minReliableTx })
        if (!appliedInitial.current) {
          appliedInitial.current = true
          const kw = initialQ.trim().toLowerCase()
          if (kw) {
            const projects: ProjectSummary[] = d.projects
            const match = projects.find(p => p.name.toLowerCase() === kw)
              ?? projects.find(p => p.name.toLowerCase().includes(kw))
            if (match) {
              setSelected(match)
              setQ(match.name)
            }
          }
        }
      })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true }
  }, [initialQ])

  // 點擊下拉外部時收合
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // 選定建案後查座標（僅預售，第一版範圍）
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    fetch(`/api/project-location?name=${encodeURIComponent(selected.name)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setLoc({ key: selected.key, lat: d.lat ?? null, lon: d.lon ?? null }) })
      .catch(() => { if (!cancelled) setLoc({ key: selected.key, lat: null, lon: null }) })
    return () => { cancelled = true }
  }, [selected])

  // 選定建案後查完整實價登錄明細（重用既有的 /api/case-detail）
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    const p = new URLSearchParams({ name: selected.name, district: selected.district, case_type: 'presale' })
    fetch(`/api/case-detail?${p}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setDetail({ key: selected.key, rows: d.rows ?? [] }) })
      .catch(() => { if (!cancelled) setDetail({ key: selected.key, rows: [] }) })
    return () => { cancelled = true }
  }, [selected])

  const candidates = useMemo(() => {
    if (!allData) return []
    const kw = q.trim().toLowerCase()
    if (!kw) return []
    return allData.projects.filter(p => p.name.toLowerCase().includes(kw)).slice(0, MAX_CANDIDATES)
  }, [allData, q])

  function selectProject(p: ProjectSummary) {
    setSelected(p)
    setQ(p.name)
    setOpen(false)
    // 用 replace 同步 URL，不觸發整頁重載，讓選定結果可以分享連結
    const params = new URLSearchParams(searchParams.toString())
    params.set('q', p.name)
    router.replace(`/search?${params.toString()}`, { scroll: false })
  }

  const locLoading    = !!selected && loc?.key !== selected.key
  const detailLoading = !!selected && detail?.key !== selected.key
  const unreliable    = !!selected && !!allData && selected.txCount < allData.minReliableTx

  return (
    <div style={{ padding: '8px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* 搜尋框 */}
      <div style={cardStyle()} ref={boxRef}>
        <div style={{ position: 'relative' }}>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => { if (q.trim()) setOpen(true) }}
            placeholder={allData ? `輸入建案名稱搜尋（共 ${allData.projects.length} 案預售建案）` : '載入建案清單中…'}
            style={{
              width: '100%', height: 36, padding: '0 12px',
              borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
              background: 'var(--surface-control)', color: 'var(--text-default)',
              border: '1px solid var(--border-control)', fontFamily: 'var(--font-sans)',
            }}
          />
          {open && candidates.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20,
              background: 'var(--surface-overlay)', border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)',
              maxHeight: 320, overflowY: 'auto',
            }}>
              {candidates.map(p => (
                <button
                  key={p.key}
                  onClick={() => selectProject(p)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '8px 12px', gap: 12,
                    background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-card)',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-default)' }}>{p.name}</span>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                    {p.district} · {p.txCount} 筆
                  </span>
                </button>
              ))}
            </div>
          )}
          {open && q.trim() && candidates.length === 0 && allData && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20,
              background: 'var(--surface-overlay)', border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)',
              padding: '10px 12px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', fontFamily: 'var(--font-sans)',
            }}>
              沒有符合的預售建案
            </div>
          )}
        </div>
        {loadFailed && (
          <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--negative)' }}>建案清單載入失敗，請重新整理頁面</div>
        )}
      </div>

      {!selected && !loadFailed && (
        <div style={cardStyle()}>
          <div style={centerStyle(200)}>輸入建案名稱並從下拉選單中選擇</div>
        </div>
      )}

      {selected && (
        <>
          {/* 建案摘要 */}
          <div style={cardStyle()}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)', fontFamily: 'var(--font-sans)' }}>
                {selected.name}
              </h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{selected.district} · {selected.buildingType || '—'}</span>
              {unreliable && (
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--negative)', fontWeight: 600 }}>樣本不足，僅供參考</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
              {[
                ['成交筆數', `${selected.txCount} 筆`],
                ['中位單價', `${selected.priceMedian} 萬/坪`],
                ['中位坪數', `${selected.areaMedian} 坪`],
                ['中位總價', `${selected.totalMedian} 萬`],
                ['成交期間', `${selected.firstTx}～${selected.lastTx}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', marginBottom: 2 }}>{label}</div>
                  <div style={{
                    fontSize: 'var(--text-base)', fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: unreliable ? 'var(--negative)' : 'var(--text-default)',
                  }}>{value}</div>
                </div>
              ))}
            </div>
            {allData && (
              <div style={{ marginTop: 10, fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>
                僅計入預售交易；成交筆數低於 {allData.minReliableTx} 筆時中位數等同少數幾筆的算術結果，不宜當作行情。
              </div>
            )}
          </div>

          {/* 地圖 + 明細 */}
          <div className="search-layout">
            <div style={{ ...cardStyle(), padding: 0, overflow: 'hidden', height: 480, minWidth: 0 }}>
              {locLoading && <div style={centerStyle(480)}>座標載入中…</div>}
              {!locLoading && loc && loc.lat == null && (
                <div style={centerStyle(480)}>此建案尚無座標資料</div>
              )}
              {!locLoading && loc && loc.lat != null && loc.lon != null && (
                <SearchMap key={selected.key} lat={loc.lat} lon={loc.lon} name={selected.name} />
              )}
            </div>

            <div style={{ ...cardStyle(), minWidth: 0 }}>
              {detailLoading && <div style={centerStyle(200)}>明細載入中…</div>}
              {!detailLoading && detail && detail.rows.length === 0 && (
                <div style={centerStyle(200)}>無交易紀錄</div>
              )}
              {!detailLoading && detail && detail.rows.length > 0 && (
                <>
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
                    共 {detail.rows.length} 筆交易紀錄
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)' }}>
                          {['交易日', '樓層', '坪數', '單價(萬/坪)', '總價(萬)', '房型', '車位', '註記'].map((h, i) => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: i < 2 ? 'left' : (i === 7 ? 'left' : 'right'), fontWeight: 400, borderBottom: '1px solid var(--border-card)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rows.map((row, i) => {
                          const flags = noteFlags(row.notes)
                          return (
                            <tr key={i}>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-card)', fontFamily: 'var(--font-mono)' }}>{rocDate(row.transaction_date)}</td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-card)' }}>{floorLabel(row)}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)', fontFamily: 'var(--font-mono)' }}>{row.area ?? '—'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)', fontFamily: 'var(--font-mono)' }}>{row.unit_price ?? '—'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)', fontFamily: 'var(--font-mono)' }}>{row.total_price != null ? row.total_price.toLocaleString() : '—'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)' }}>{row.rooms == null ? '—' : `${row.rooms}房`}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid var(--border-card)' }}>
                                {row.parking_price === 'x' ? '無' : row.parking_price === '含' ? '含' : row.parking_price != null ? `${row.parking_price}萬` : '—'}
                              </td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-card)' }}>
                                {!flags.special && !flags.addition && <span style={{ color: 'var(--text-faint)' }}>—</span>}
                                {flags.special && <span style={{ color: 'var(--negative)', fontWeight: 600, marginRight: flags.addition ? 8 : 0 }}>特殊關係</span>}
                                {flags.addition && <span style={{ color: 'var(--text-muted)' }}>增建</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        .search-layout {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .search-layout { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </div>
  )
}

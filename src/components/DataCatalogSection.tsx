'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { VillageGeo } from './VillageChoroplethMap'
import { Legend, quintileBreaks, classOf } from './ChoroplethLegend'
import { computeIndex, fmtValue, type Catalog, type IndexDef, type Indicator, type Village } from '@/lib/buyerIndex'

const VillageChoroplethMap = dynamic(() => import('./VillageChoroplethMap'), {
  ssr: false, loading: () => <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>地圖載入中…</div>,
})

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 'var(--radius-lg)', padding: 16,
}

/** 不能畫成村里／行政區分布的資料（縣市、園區層級的時間序列）→ 連到所在頁籤 */
const OTHER_DATA: { label: string; level: string; tab: string }[] = [
  { label: '房價所得比、貸款負擔率', level: '縣市・季', tab: '房市與負擔' },
  { label: '新增購屋貸款利率、成數、年限', level: '縣市・季', tab: '房市與負擔' },
  { label: '家庭收支（可支配所得、消費支出）', level: '縣市・年', tab: '房市與負擔' },
  { label: '建物第一次移轉、買賣移轉月序列', level: '縣市・月', tab: '房市與負擔' },
  { label: '住宅開工、使用執照逐年戶數', level: '行政區・年', tab: '房市與負擔' },
  { label: '租金與房價每坪中位數（大樓、透天）', level: '行政區', tab: '房市與負擔' },
  { label: '屋齡結構（五級占比）', level: '行政區・季', tab: '房市與負擔' },
  { label: '工業及服務業普查行業別員工', level: '行政區', tab: '就業與產業' },
  { label: '南科從業員工（含碩博士）', level: '園區・月', tab: '就業與產業' },
  { label: '南科產業別員工', level: '園區・年', tab: '就業與產業' },
  { label: '人口推估（高、中、低推估逐年）', level: '行政區・年', tab: '人口與家庭' },
  { label: '國中小學生數、各校新生成長', level: '行政區・學年', tab: '人口與家庭' },
  { label: '重大建設時程（捷運、鐵路、道路、產業、重劃區）', level: '行政區', tab: '重大建設' },
]

type Item = Indicator & { count: number; total: number }

export default function DataCatalogSection({ catalog, villages, geo, indices, customStatus, onGoTab, highlightDistrict }: {
  catalog: Catalog
  villages: Village[]
  geo: VillageGeo
  indices: IndexDef[]
  customStatus: 'idle' | 'loading' | 'ready' | 'error'
  onGoTab: (tab: string) => void
  highlightDistrict?: string
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>('全部')
  const [selKey, setSelKey] = useState<string>('index:firstBuyer')
  const [selVillage, setSelVillage] = useState<string | null>(null)

  const codes = useMemo(() => villages.map(v => v.code), [villages])

  // 指數也當成可顯示的資料：key = index:<id>
  const indexValues = useMemo(() => {
    const m = new Map<string, Map<string, number | null>>()
    for (const d of indices) m.set(`index:${d.id}`, computeIndex(d, catalog, codes).scores)
    return m
  }, [indices, catalog, codes])

  const items = useMemo<Item[]>(() => {
    const idx: Item[] = indices.map(d => ({
      key: `index:${d.id}`, label: d.name, unit: '分', group: d.preset ? '指數' : '自訂指數', level: '村里',
      desc: d.desc || '自訂指數', source: '本站計算', period: '最新', digits: 1, count: codes.length, total: codes.length,
    }))
    const rest: Item[] = catalog.indicators.map(ind => {
      const dv = catalog.districtValues.get(ind.key)
      const vals = dv ? [...dv.values()] : [...(catalog.values.get(ind.key)?.values() ?? [])]
      return { ...ind, count: vals.filter(x => x != null).length, total: vals.length }
    })
    return [...idx, ...rest]
  }, [indices, catalog, codes])

  const groups = useMemo(() => ['全部', ...new Set(items.map(i => i.group))], [items])
  const shown = items.filter(i =>
    (group === '全部' || i.group === group) &&
    (!query.trim() || `${i.label}${i.desc}${i.source}`.includes(query.trim())))

  const sel = items.find(i => i.key === selKey) ?? items[0]
  const villageCount = items.filter(i => i.level === '村里' && !i.key.startsWith('index:')).length
  const districtCount = items.filter(i => i.level === '行政區').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'baseline' }}>
        <div>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>資料總覽</span>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>點任一列就會在右邊顯示分布；村里資料畫地圖，行政區資料畫長條</span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>村里資料 <b style={statNum}>{villageCount}</b> 項</span>
          <span>行政區資料 <b style={statNum}>{districtCount}</b> 項</span>
          <span>指數 <b style={statNum}>{indices.length}</b> 個</span>
          <span>其他時間序列 <b style={statNum}>{OTHER_DATA.length}</b> 項</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 14, alignItems: 'start' }}>
        {/* 左：清單 */}
        <div style={{ ...cardStyle, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input
              id="catalog-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜尋資料名稱、來源…"
              style={{ ...inputStyle, flex: '1 1 180px' }}
            />
            <select id="catalog-group" value={group} onChange={e => setGroup(e.target.value)} style={inputStyle} aria-label="分類">
              {groups.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          {customStatus !== 'ready' && (
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', marginBottom: 8 }}>
              手動資料與自訂指數需要在「自訂指數」頁籤輸入密碼後才會列出。
            </div>
          )}
          <div style={{ maxHeight: 640, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-card)', zIndex: 1 }}>
                <tr>
                  <th style={th}>資料</th>
                  <th style={th}>層級</th>
                  <th style={th}>期間</th>
                  <th style={{ ...th, textAlign: 'right' }}>覆蓋</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i, k) => {
                  const newGroup = k === 0 || shown[k - 1].group !== i.group
                  const active = i.key === sel?.key
                  return [
                    newGroup && (
                      <tr key={`g-${i.group}`}>
                        <td colSpan={4} style={{ padding: '10px 8px 4px', fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>{i.group}</td>
                      </tr>
                    ),
                    <tr
                      key={i.key}
                      onClick={() => {
                        setSelKey(i.key); setSelVillage(null)
                        // 窄螢幕清單與顯示上下排列時，捲到顯示區
                        const el = document.getElementById('catalog-display')
                        if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      aria-selected={active}
                      style={{ cursor: 'pointer', background: active ? 'var(--accent-wash)' : undefined, borderBottom: '1px solid var(--border-card)' }}
                    >
                      <td style={{ ...td, whiteSpace: 'normal' }}>
                        <div style={{ color: active ? 'var(--accent-tint)' : 'var(--text-strong)', fontWeight: 600 }}>{i.label}</div>
                        <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>{i.source}</div>
                      </td>
                      <td style={td}><LevelTag level={i.level} /></td>
                      <td style={{ ...td, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)' }}>{i.period}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', color: i.count < i.total * 0.9 ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {i.count}/{i.total}
                      </td>
                    </tr>,
                  ]
                })}
              </tbody>
            </table>

            <div style={{ padding: '14px 8px 4px', fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>其他資料（時間序列，在各頁籤以圖表呈現）</div>
            {OTHER_DATA.filter(o => !query.trim() || o.label.includes(query.trim())).map(o => (
              <div key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid var(--border-card)', fontSize: 'var(--text-xs)' }}>
                <span style={{ flex: 1, color: 'var(--text-default)' }}>{o.label}</span>
                <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{o.level}</span>
                <button onClick={() => onGoTab(o.tab)} style={linkBtn}>前往{o.tab} →</button>
              </div>
            ))}
          </div>
        </div>

        {/* 右：顯示 */}
        {sel && (
          <Display
            item={sel}
            values={indexValues.get(sel.key) ?? catalog.values.get(sel.key) ?? new Map()}
            districtValues={catalog.districtValues.get(sel.key) ?? null}
            villages={villages} geo={geo}
            selVillage={selVillage} onSelVillage={setSelVillage}
            highlightDistrict={highlightDistrict}
          />
        )}
      </div>
    </div>
  )
}

/* ── 右側顯示：村里 → 地圖 + 前後 10 名；行政區 → 長條 ─────────── */
function Display({ item, values, districtValues, villages, geo, selVillage, onSelVillage, highlightDistrict }: {
  item: Item
  values: Map<string, number | null>
  districtValues: Map<string, number | null> | null
  villages: Village[]
  geo: VillageGeo
  selVillage: string | null
  onSelVillage: (c: string) => void
  highlightDistrict?: string
}) {
  // 統計：行政區資料用 37 區計算，村里資料用 650 里
  const nums = [...(districtValues ?? values).values()].filter((x): x is number => x != null)
  const villageNums = [...values.values()].filter((x): x is number => x != null)
  const sorted = [...nums].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null
  const breaks = useMemo(() => quintileBreaks(villageNums), [values]) // eslint-disable-line react-hooks/exhaustive-deps
  const byCode = useMemo(() => new Map(villages.map(v => [v.code, v])), [villages])
  const allCodes = useMemo(() => villages.map(v => v.code), [villages])   // 初次顯示縮放到全市

  const classByCode = useMemo(() => {
    const m = new Map<string, number>()
    for (const [code, x] of values) if (x != null) m.set(code, classOf(x, breaks))
    return m
  }, [values, breaks])
  const tooltipByCode = useMemo(() => new Map(villages.map(v => [
    v.code, `${v.district} ${v.village}｜${item.label} ${fmtValue(item, values.get(v.code))}`,
  ])), [villages, values, item])
  const lowConfidence = useMemo(() => new Set(villages.filter(v => v.lowConfidence).map(v => v.code)), [villages])

  const ranked = villages
    .map(v => ({ v, x: values.get(v.code) ?? null }))
    .filter((r): r is { v: Village; x: number } => r.x != null)
    .sort((a, b) => b.x - a.x)
  const sv = selVillage ? byCode.get(selVillage) : null

  return (
    <div id="catalog-display" style={{ ...cardStyle, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, scrollMarginTop: 140 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-strong)' }}>{item.label}</span>
          <LevelTag level={item.level} />
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)', marginTop: 4 }}>{item.desc}</div>
        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', marginTop: 2 }}>來源：{item.source}｜期間：{item.period}{item.unit ? `｜單位：${item.unit}` : ''}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {[
          ['中位數', median], ['最低', sorted[0] ?? null], ['最高', sorted.at(-1) ?? null],
        ].map(([k, x]) => (
          <div key={k as string} style={statBox}>
            <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>{k as string}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 600 }}>{fmtValue(item, x as number | null)}</div>
          </div>
        ))}
        <div style={statBox}>
          <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>有資料</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 600 }}>{item.count}/{item.total}</div>
        </div>
      </div>

      {districtValues ? (
        <DistrictBars item={item} values={districtValues} highlightDistrict={highlightDistrict} />
      ) : (
        <>
          <div style={{ position: 'relative', height: 440, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <VillageChoroplethMap
              geojson={geo} classByCode={classByCode} lowConfidence={lowConfidence} tooltipByCode={tooltipByCode}
              selected={selVillage} onSelect={onSelVillage} focusCodes={allCodes}
            />
            <Legend breaks={breaks} title={item.label} digits={Math.min(item.digits, 2)} />
          </div>
          {sv && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)', padding: '6px 10px', background: 'var(--accent-wash)', border: '1px solid var(--accent-wash-border)', borderRadius: 'var(--radius-md)' }}>
              {sv.district} {sv.village}：<b style={{ fontFamily: 'var(--font-mono)' }}>{fmtValue(item, values.get(sv.code))}</b>
              {(() => { const r = ranked.findIndex(x => x.v.code === sv.code); return r >= 0 ? `（全市第 ${r + 1} / ${ranked.length} 名）` : '（無資料）' })()}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
            {[['最高 10 里', ranked.slice(0, 10)], ['最低 10 里', ranked.slice(-10).reverse()]].map(([title, rows]) => (
              <div key={title as string} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>{title as string}</div>
                {(rows as { v: Village; x: number }[]).map(({ v, x }) => (
                  <button key={v.code} onClick={() => onSelVillage(v.code)} style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 2px',
                    background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-card)', cursor: 'pointer',
                    fontSize: 'var(--text-2xs)', color: 'var(--text-default)', fontFamily: 'var(--font-sans)', textAlign: 'left',
                  }}>
                    <span><span style={{ color: 'var(--text-muted)' }}>{v.district}</span> {v.village}{v.lowConfidence && <span style={{ color: 'var(--warning)' }}> ⚠</span>}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtValue(item, x)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── 行政區長條圖 ─────────────────────────────────────────────── */
function DistrictBars({ item, values, highlightDistrict }: { item: Item; values: Map<string, number | null>; highlightDistrict?: string }) {
  const rows = [...values.entries()]
    .filter((r): r is [string, number] => r[1] != null)
    .sort((a, b) => b[1] - a[1])
  const missing = [...values.entries()].filter(r => r[1] == null).map(r => r[0])
  const max = Math.max(...rows.map(r => Math.abs(r[1])), 1e-9)
  const hasNeg = rows.some(r => r[1] < 0)
  return (
    <div>
      <div style={{ maxHeight: 620, overflowY: 'auto' }}>
        {rows.map(([d, x], i) => {
          const w = Math.abs(x) / max * (hasNeg ? 50 : 100)
          return (
            <div key={d} style={{ display: 'grid', gridTemplateColumns: '28px 64px 1fr 84px', gap: 8, alignItems: 'center', padding: '3px 0', fontSize: 'var(--text-2xs)', background: d === highlightDistrict ? 'var(--accent-wash)' : undefined }}>
              <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{i + 1}</span>
              <span style={{ color: 'var(--text-default)' }}>{d}</span>
              <div style={{ position: 'relative', height: 10 }}>
                {hasNeg && <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--border-card)' }} />}
                <div style={{
                  position: 'absolute', top: 0, height: '100%', borderRadius: 'var(--radius-full)',
                  background: x < 0 ? 'var(--negative)' : 'var(--accent)', width: `${w}%`,
                  left: hasNeg ? (x < 0 ? `${50 - w}%` : '50%') : 0,
                }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-strong)' }}>{fmtValue(item, x)}</span>
            </div>
          )
        })}
      </div>
      {missing.length > 0 && <div style={{ marginTop: 6, fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>無資料：{missing.join('、')}</div>}
      <div style={{ marginTop: 6, fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>行政區層級資料放進指數時，同一區所有里拿到相同分數。</div>
    </div>
  )
}

function LevelTag({ level }: { level: string }) {
  const village = level === '村里'
  return (
    <span style={{
      fontSize: 'var(--text-3xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap',
      background: village ? 'var(--accent-wash)' : 'var(--surface-control)',
      color: village ? 'var(--accent-tint)' : 'var(--text-muted)',
      border: `1px solid ${village ? 'var(--accent-wash-border)' : 'var(--border-control)'}`,
    }}>{level}</span>
  )
}

const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-card)' }
const td: React.CSSProperties = { padding: '6px 8px', whiteSpace: 'nowrap', verticalAlign: 'top' }
const statNum: React.CSSProperties = { fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }
const statBox: React.CSSProperties = { background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', padding: '6px 8px', minWidth: 0 }
const inputStyle: React.CSSProperties = {
  height: 'var(--control-h-md)', padding: '0 10px', borderRadius: 'var(--radius-md)',
  background: 'var(--surface-control)', color: 'var(--text-default)',
  border: '1px solid var(--border-control)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
}
const linkBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', whiteSpace: 'nowrap',
  fontSize: 'var(--text-2xs)', color: 'var(--accent-tint)', fontFamily: 'var(--font-sans)',
}

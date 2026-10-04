'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { VillageGeo } from './VillageChoroplethMap'
import { quintileBreaks, classOf, RAMP, RAMP_LABEL } from './ChoroplethLegend'
import { computeIndex, PRESET_INDICES, type Catalog, type Village } from '@/lib/buyerIndex'
import {
  villageCentroids, computeCatchment, defaultFbShare,
  type Site, type Product, type ProductType, type CatchmentResult,
} from '@/lib/catchment'
import { usePassword, savePassword } from '@/lib/chatPassword'

const VillageChoroplethMap = dynamic(() => import('./VillageChoroplethMap'), {
  ssr: false, loading: () => <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>地圖載入中…</div>,
})

interface Project {
  name: string; district: string; n: number; firstDate: string; lastDate: string
  priceWan: number; ping: number; rooms: number; smallShare: number; unitWan: number; lat: number; lon: number
}

/* ── 樣式 ─────────────────────────────────────────────────────── */
const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 'var(--radius-lg)', padding: 16,
}
const inputStyle: React.CSSProperties = {
  height: 'var(--control-h-md)', padding: '0 10px', borderRadius: 'var(--radius-md)',
  background: 'var(--surface-control)', color: 'var(--text-default)',
  border: '1px solid var(--border-control)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', minWidth: 0,
}
const label: React.CSSProperties = { fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }
const btn = (primary = false): React.CSSProperties => ({
  height: 'var(--control-h-md)', padding: '0 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', whiteSpace: 'nowrap',
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
  border: `1px solid ${primary ? 'var(--accent)' : 'var(--border-control)'}`,
  background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--on-accent)' : 'var(--text-default)',
})
const pct = (v: number | null | undefined, d = 1) => (v == null || Number.isNaN(v) ? '—' : `${(v * 100).toFixed(d)}%`)
const num = (v: number | null | undefined, d = 0) => (v == null || Number.isNaN(v) ? '—' : v.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d }))

export default function CatchmentSection({ villages, geo, catalog, employeesByDistrict, defaultRate }: {
  villages: Village[]
  geo: VillageGeo
  catalog: Catalog
  employeesByDistrict: Map<string, number>
  defaultRate: number
}) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [projError, setProjError] = useState(false)
  const [query, setQuery] = useState('')
  const [site, setSite] = useState<Site | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [product, setProduct] = useState<Product>({ priceWan: 1200, rooms: 3, type: 'presale' })
  const [fbShare, setFbShare] = useState(0.4)
  const [halfKm, setHalfKm] = useState(6)
  const [ratePct, setRatePct] = useState(defaultRate)
  const [showPoints, setShowPoints] = useState(true)
  const [selVillage, setSelVillage] = useState<string | null>(null)

  const pickProject = (p: Project) => {
    setSite({ lat: p.lat, lon: p.lon, label: `${p.name}（${p.district}）` })
    setProjectName(p.name)
    setProduct({ priceWan: p.priceWan, rooms: p.rooms, type: 'presale' })
    setFbShare(Math.round(defaultFbShare(p.smallShare) * 20) / 20)
    setQuery('')
  }

  // 建案清單：開啟頁籤時才抓；預設選最近仍在成交、量較大的建案，讓頁面一打開就有結果
  useEffect(() => {
    let cancelled = false
    fetch('/api/potential-buyers/projects').then(r => r.json()).then(j => {
      if (cancelled) return
      if (j.error) { setProjError(true); return }
      setProjects(j.projects)
      const first = (j.projects as Project[]).find(p => p.n >= 50) ?? j.projects[0]
      if (first) pickProject(first)
    }).catch(() => { if (!cancelled) setProjError(true) })
    return () => { cancelled = true }
  }, [])

  const codes = useMemo(() => villages.map(v => v.code), [villages])
  const centroids = useMemo(() => villageCentroids(geo), [geo])
  const scores = useMemo(() => {
    const cache = new Map<string, Map<string, number>>()
    const [fb, nh, rs] = PRESET_INDICES.map(p => computeIndex(p, catalog, codes, cache).scores)
    return { firstBuyer: fb, newHome: nh, resale: rs }
  }, [catalog, codes])

  const result = useMemo<CatchmentResult | null>(() => site ? computeCatchment({
    villages, centroids, site, product, scores, employeesByDistrict,
    params: { halfKm, fbShare, ratePct, ltv: 0.8, years: 30 },
  }) : null, [villages, centroids, site, product, scores, employeesByDistrict, halfKm, fbShare, ratePct])

  // 地圖
  const shareByCode = useMemo(() => new Map((result?.rows ?? []).map(r => [r.code, r])), [result])
  const breaks = useMemo(() => quintileBreaks((result?.rows ?? []).map(r => r.share)), [result])
  const classByCode = useMemo(() => new Map((result?.rows ?? []).map(r => [r.code, classOf(r.share, breaks)])), [result, breaks])
  const tooltipByCode = useMemo(() => new Map(villages.map(v => {
    const r = shareByCode.get(v.code)
    return [v.code, r ? `${v.district} ${v.village}｜客源占比 ${pct(r.share, 2)}｜距離 ${num(r.distKm, 1)} 公里` : `${v.district} ${v.village}`]
  })), [villages, shareByCode])
  const lowConfidence = useMemo(() => new Set(villages.filter(v => v.lowConfidence).map(v => v.code)), [villages])
  // 換位置時才縮放（8 公里內的里），調滑桿不會讓地圖亂跳
  const focusCodes = useMemo(() => {
    if (!site) return null
    const near = villages.filter(v => {
      const c = centroids.get(v.code)
      return c && Math.hypot((c.lat - site.lat) * 111, (c.lon - site.lon) * 102) < 8
    }).map(v => v.code)
    return near.length ? near : null
  }, [site, villages, centroids])
  const points = useMemo(() => (showPoints && projects ? projects.map(p => ({
    id: p.name, lat: p.lat, lon: p.lon, label: `${p.name}（${p.district}）｜${num(p.priceWan)} 萬・${p.rooms} 房`,
  })) : []), [showPoints, projects])
  const marker = useMemo(() => (site ? { lat: site.lat, lon: site.lon, label: site.label } : null), [site])
  const rings = useMemo(() => [halfKm, halfKm * 2], [halfKm])

  const matches = query.trim() && projects
    ? projects.filter(p => `${p.name}${p.district}`.includes(query.trim())).slice(0, 8)
    : []
  const proj = projectName ? projects?.find(p => p.name === projectName) : null
  const segLabel = product.type === 'presale' ? '換新屋' : '換二手'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 控制列 */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>客源分析</span>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
            選一個預售建案，或直接在地圖上點一個位置，推估潛在買方可能來自哪些里
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 14 }}>
          {/* 位置 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <label style={label} htmlFor="cm-search">搜尋預售建案（{projects ? `${projects.length} 案` : projError ? '載入失敗' : '載入中…'}）
              <div style={{ position: 'relative' }}>
                <input id="cm-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="輸入建案名稱或行政區" style={{ ...inputStyle, width: '100%' }} autoComplete="off" />
                {matches.length > 0 && (
                  <div role="listbox" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200, background: 'var(--surface-overlay)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)', marginTop: 4, maxHeight: 280, overflowY: 'auto' }}>
                    {matches.map(p => (
                      <button key={p.name} role="option" aria-selected={false} onClick={() => pickProject(p)} style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 10px', background: 'transparent',
                        border: 'none', borderBottom: '1px solid var(--border-card)', cursor: 'pointer', textAlign: 'left',
                        fontSize: 'var(--text-xs)', color: 'var(--text-default)', fontFamily: 'var(--font-sans)',
                      }}>
                        <span><b style={{ color: 'var(--text-strong)' }}>{p.name}</b> <span style={{ color: 'var(--text-muted)' }}>{p.district}</span></span>
                        <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{num(p.priceWan)} 萬・{p.rooms} 房</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>或在地圖上點任一位置（綠點是預售建案，點了也會選取該建案）</div>
            {site && (
              <div style={{ background: 'var(--accent-wash)', border: '1px solid var(--accent-wash-border)', borderRadius: 'var(--radius-md)', padding: '8px 10px', fontSize: 'var(--text-xs)' }}>
                <div style={{ fontWeight: 700, color: 'var(--accent-tint)' }}>📍 {site.label}</div>
                {proj && (
                  <div style={{ color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.6 }}>
                    成交 {proj.n} 筆（{proj.firstDate.slice(0, 7)}～{proj.lastDate.slice(0, 7)}）・中位數 {num(proj.priceWan)} 萬、{num(proj.ping, 1)} 坪、{proj.rooms} 房、{num(proj.unitWan, 1)} 萬／坪・2 房以下 {pct(proj.smallShare, 0)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 產品 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, alignContent: 'start' }}>
            <label style={label}>總價（萬，不含車位）
              <input id="cm-price" type="number" min={100} max={20000} step={50} value={product.priceWan}
                onChange={e => setProduct(p => ({ ...p, priceWan: Math.max(100, Number(e.target.value) || 0) }))} style={inputStyle} />
            </label>
            <label style={label}>房數
              <select id="cm-rooms" value={product.rooms} onChange={e => {
                const rooms = Number(e.target.value)
                setProduct(p => ({ ...p, rooms }))
                setFbShare(Math.round(defaultFbShare(rooms <= 2 ? 1 : 0) * 20) / 20)
              }} style={inputStyle}>
                {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r} 房{r === 5 ? '以上' : ''}</option>)}
              </select>
            </label>
            <label style={label}>類型
              <select id="cm-type" value={product.type} onChange={e => setProduct(p => ({ ...p, type: e.target.value as ProductType }))} style={inputStyle}>
                <option value="presale">預售／新成屋（換新屋客）</option>
                <option value="resale">成屋（換二手客）</option>
              </select>
            </label>
            <label style={label}>房貸利率（%）
              <input id="cm-rate" type="number" min={0.5} max={6} step={0.05} value={ratePct} onChange={e => setRatePct(Number(e.target.value) || defaultRate)} style={inputStyle} />
            </label>
          </div>

          {/* 假設 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <label style={label} htmlFor="cm-half">距離每 <b style={{ color: 'var(--text-strong)' }}>{halfKm} 公里</b> 吸引力減半
              <input id="cm-half" type="range" min={2} max={15} step={1} value={halfKm} onChange={e => setHalfKm(Number(e.target.value))} />
              <span style={{ color: 'var(--text-faint)' }}>越小代表買方越在地；沒有買方戶籍資料可以校準，是假設值</span>
            </label>
            <label style={label} htmlFor="cm-fb">首購 <b style={{ color: 'var(--text-strong)' }}>{Math.round(fbShare * 100)}%</b>／{segLabel} {Math.round((1 - fbShare) * 100)}%
              <input id="cm-fb" type="range" min={0} max={1} step={0.05} value={fbShare} onChange={e => setFbShare(Number(e.target.value))} />
              <span style={{ color: 'var(--text-faint)' }}>預設依 2 房以下成交占比推估；可依產品定位調整</span>
            </label>
            <label style={{ ...label, flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input id="cm-points" type="checkbox" checked={showPoints} onChange={e => setShowPoints(e.target.checked)} /> 地圖顯示預售建案位置
            </label>
          </div>
        </div>
      </div>

      {/* 地圖 + 摘要 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 14 }}>
        <div style={{ ...cardStyle, padding: 8, gridColumn: 'span 2', minWidth: 0 }} className="pb-map-card">
          <div className="pb-map-box" style={{ position: 'relative' }}>
            <VillageChoroplethMap
              geojson={geo} classByCode={classByCode} lowConfidence={lowConfidence} tooltipByCode={tooltipByCode}
              selected={selVillage} onSelect={setSelVillage} focusCodes={focusCodes}
              marker={marker} rings={rings} points={points}
              onPointClick={id => { const p = projects?.find(x => x.name === id); if (p) pickProject(p) }}
              onMapClick={(lat, lon) => { setSite({ lat, lon, label: '自選位置' }); setProjectName(null) }}
            />
            <ShareLegend breaks={breaks} halfKm={halfKm} />
          </div>
        </div>

        <div style={{ ...cardStyle, minWidth: 0 }}>
          {result ? <Summary result={result} product={product} /> : <div style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>選一個建案或在地圖上點一個位置</div>}
        </div>
      </div>

      {result && (
        <>
          <VillageTable result={result} segLabel={segLabel} selected={selVillage} onPick={setSelVillage} />
          <AiExplain site={site!} product={product} halfKm={halfKm} fbShare={fbShare} result={result} />
        </>
      )}

      <details style={{ ...cardStyle, fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>客源分數怎麼算？</summary>
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          <li>村里客源分數 = 距離衰減 × 負擔能力 × [首購比重 × 25–34 歲人口 × 首購指數係數 ＋ 換屋比重 × 35–44 歲人口 × {segLabel}指數係數]；客源占比 = 分數 ÷ 全市總和。</li>
          <li><b>距離衰減</b>：0.5 ^（村里中心到分析位置的直線距離 ÷ 減半距離）。減半距離是假設值，實價登錄沒有買方戶籍資料可以校準。</li>
          <li><b>指數係數</b>：0.5 ＋ 指數 ÷ 100（指數 0 為 0.5 倍、100 為 1.5 倍），讓人口多寡仍是主要因素。</li>
          <li><b>負擔能力</b>：年房貸（八成、30 年、本息平均攤還）÷ 里所得中位數；50% 以下不扣分，100% 以上只剩 0.15 倍。所得是綜所稅申報資料，會低估實際家戶所得，且落後 2–3 年。</li>
          <li><b>就業地</b>：普查從業員工依行政區人口重心距離加權，代表「在附近工作的人」，他們可能住在別處，只供參考，不計入村里客源占比。</li>
          <li>結果是相對可能性，適合比較區域、規劃廣告投放範圍，不是實際成交買方的統計。</li>
        </ul>
      </details>
    </div>
  )
}

/* ── 圖例 ─────────────────────────────────────────────────────── */
function ShareLegend({ breaks, halfKm }: { breaks: number[]; halfKm: number }) {
  return (
    <div style={{
      position: 'absolute', left: 10, bottom: 24, zIndex: 1000, background: 'var(--surface-overlay)', border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-md)', padding: '8px 10px', boxShadow: 'var(--shadow-pop)', fontSize: 'var(--text-2xs)', color: 'var(--text-default)',
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>客源占比（全市五分位）</div>
      {[...RAMP].reverse().map((c, ri) => {
        const i = RAMP.length - 1 - ri
        const lo = i === 0 ? null : breaks[i - 1], hi = i === RAMP.length - 1 ? null : breaks[i]
        return (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.7 }}>
            <span style={{ width: 14, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />
            <span style={{ minWidth: 48 }}>{RAMP_LABEL[i]}</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{lo == null ? `≤ ${pct(hi, 2)}` : hi == null ? `> ${pct(lo, 2)}` : `${pct(lo, 2)}–${pct(hi, 2)}`}</span>
          </div>
        )
      })}
      <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>虛線圈：{halfKm}、{halfKm * 2} 公里</div>
    </div>
  )
}

/* ── 摘要 ─────────────────────────────────────────────────────── */
function Summary({ result, product }: { result: CatchmentResult; product: Product }) {
  const top = result.districts.slice(0, 6)
  const max = Math.max(...top.map(d => d.share), 1e-9)
  const burdenMed = (() => {
    const xs = result.rows.slice(0, 30).map(r => r.burden).filter((x): x is number => x != null).sort((a, b) => a - b)
    return xs.length ? xs[Math.floor(xs.length / 2)] : null
  })()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <Stat k="80% 客源範圍" v={result.radius80 != null ? `${num(result.radius80, 1)} 公里內` : '—'} />
        <Stat k="首購客占比" v={pct(result.fbPart, 0)} />
        <Stat k="年房貸（八成、30 年）" v={`${num(result.annualWan, 1)} 萬`} />
        <Stat k="前 30 里房貸占所得（中位數）" v={pct(burdenMed, 0)} warn={burdenMed != null && burdenMed > 0.7} />
      </div>
      <div>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 6 }}>各區客源占比</div>
        {top.map(d => (
          <div key={d.district} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 48px', gap: 8, alignItems: 'center', fontSize: 'var(--text-2xs)', padding: '2px 0' }}>
            <span style={{ color: 'var(--text-default)' }}>{d.district}</span>
            <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)', overflow: 'hidden' }}>
              <div style={{ width: `${d.share / max * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-full)' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-strong)' }}>{pct(d.share)}</span>
          </div>
        ))}
      </div>
      {result.jobs.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>
            附近就業地 <span style={{ fontWeight: 400, color: 'var(--text-faint)', fontSize: 'var(--text-2xs)' }}>普查從業員工，依距離加權排序；不計入村里占比</span>
          </div>
          {result.jobs.slice(0, 5).map(j => (
            <div key={j.district} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', padding: '2px 0', color: 'var(--text-default)' }}>
              <span>{j.district}<span style={{ color: 'var(--text-faint)' }}>（{num(j.distKm, 1)} 公里）</span></span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{num(j.employees)} 人</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', lineHeight: 1.6 }}>
        {product.type === 'presale' ? '換屋客以「換新屋指數」計' : '換屋客以「換二手指數」計'}；占比是相對可能性，不是實際買方統計。
      </div>
    </div>
  )
}
function Stat({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>{k}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 700, color: warn ? 'var(--warning)' : 'var(--text-strong)' }}>{v}</div>
    </div>
  )
}

/* ── 村里客源排行 ─────────────────────────────────────────────── */
function VillageTable({ result, segLabel, selected, onPick }: { result: CatchmentResult; segLabel: string; selected: string | null; onPick: (c: string) => void }) {
  const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-card)' }
  const td: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }
  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>主要客源村里</span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>前 30 名，點選列會在地圖上框出</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>村里</th>
              <th style={th}>客源占比</th>
              <th style={th}>累計</th>
              <th style={th}>距離（公里）</th>
              <th style={th}>25–34 歲人口</th>
              <th style={th}>35–44 歲人口</th>
              <th style={th}>首購指數</th>
              <th style={th}>{segLabel}指數</th>
              <th style={th} title="年房貸 ÷ 里所得中位數">房貸占所得</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 30).map((r, i) => (
              <tr key={r.code} onClick={() => onPick(r.code)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-card)', background: r.code === selected ? 'var(--accent-wash)' : undefined }}>
                <td style={{ ...td, textAlign: 'left', color: 'var(--text-faint)' }}>{i + 1}</td>
                <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{r.district}</span> {r.village}
                  {r.lowConfidence && <span title="人口未滿 1,000" style={{ marginLeft: 6, color: 'var(--warning)', fontSize: 'var(--text-3xs)' }}>⚠</span>}
                </td>
                <td style={{ ...td, color: 'var(--text-strong)', fontWeight: 600 }}>{pct(r.share, 2)}</td>
                <td style={{ ...td, color: 'var(--text-muted)' }}>{pct(r.cum, 0)}</td>
                <td style={td}>{num(r.distKm, 1)}</td>
                <td style={td}>{num(r.fbPop)}</td>
                <td style={td}>{num(r.upPop)}</td>
                <td style={td}>{num(r.fbIdx, 1)}</td>
                <td style={td}>{num(r.upIdx, 1)}</td>
                <td style={{ ...td, color: r.burden != null && r.burden > 0.7 ? 'var(--warning)' : undefined }}>{pct(r.burden, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── AI 解讀 ──────────────────────────────────────────────────── */
function AiExplain({ site, product, halfKm, fbShare, result }: { site: Site; product: Product; halfKm: number; fbShare: number; result: CatchmentResult }) {
  const password = usePassword()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [out, setOut] = useState<{ text: string; model: string; for: string } | null>(null)
  const key = `${site.label}|${site.lat.toFixed(4)},${site.lon.toFixed(4)}|${product.priceWan}|${product.rooms}|${product.type}|${halfKm}|${fbShare}`

  const ask = async () => {
    if (!password) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/potential-buyers/catchment-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-chat-password': password },
        body: JSON.stringify({
          site: { label: site.label }, product, params: { halfKm, fbShare },
          summary: { radius80: result.radius80, fbPart: result.fbPart, annualWan: result.annualWan },
          villages: result.rows.slice(0, 15).map(r => ({ name: `${r.district}${r.village}`, share: r.share, distKm: r.distKm, burden: r.burden })),
          districts: result.districts.slice(0, 8).map(d => ({ district: d.district, share: d.share })),
          jobs: result.jobs.slice(0, 5).map(j => ({ district: j.district, employees: j.employees, distKm: j.distKm })),
        }),
      })
      const j = await r.json()
      if (r.status === 401) { savePassword(''); setErr('密碼錯誤，請重新輸入') }
      else if (!r.ok) setErr(j.error ?? 'AI 解讀失敗')
      else setOut({ text: j.text, model: j.model, for: key })
    } catch {
      setErr('連線失敗')
    }
    setBusy(false)
  }

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>AI 解讀</span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>依目前的分析結果寫一段客源說明與行銷建議；使用 Gemini 免費額度，與 AI 問答共用密碼與每日上限</span>
      </div>
      {password === null ? null : !password ? (
        <form onSubmit={e => { e.preventDefault(); if (pw.trim()) savePassword(pw.trim()) }} style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
          <input id="cm-pw" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="AI 問答密碼" autoComplete="current-password" style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" style={btn(true)}>解鎖</button>
        </form>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btn(true)} onClick={ask} disabled={busy}>{busy ? 'AI 撰寫中…' : out ? '依目前條件重新解讀' : '產生 AI 解讀'}</button>
          {out && out.for !== key && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--warning)' }}>條件已變更，下方是先前條件的解讀</span>}
          {err && <span role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--negative)' }}>{err}</span>}
        </div>
      )}
      {out && (
        <div style={{ background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: 'var(--text-sm)', color: 'var(--text-default)', lineHeight: 1.8 }}>
          {out.text.split(/\n+/).map((line, i) => {
            const clean = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim()
            if (!clean) return null
            const heading = /^(\d+[.、]|[一二三四][、.])/.test(clean) && clean.length < 30
            return <p key={i} style={{ margin: heading ? '10px 0 2px' : '0 0 6px', fontWeight: heading ? 700 : 400, color: heading ? 'var(--text-strong)' : undefined }}>{clean}</p>
          })}
          <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', marginTop: 6 }}>模型：{out.model}｜AI 依模型數字推論，請自行判斷</div>
        </div>
      )}
    </div>
  )
}

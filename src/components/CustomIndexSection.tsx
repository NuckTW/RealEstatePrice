'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { VillageGeo } from './VillageChoroplethMap'
import { Legend, quintileBreaks, classOf } from './ChoroplethLegend'
import {
  computeIndex, rankCorr, parseAreaValues, fmtValue,
  type Catalog, type IndexDef, type Component, type CustomDataset, type Village, type Indicator,
} from '@/lib/buyerIndex'
import type { CustomStore } from './PotentialBuyersPanel'

const VillageChoroplethMap = dynamic(() => import('./VillageChoroplethMap'), {
  ssr: false, loading: () => <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>地圖載入中…</div>,
})

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
const btn = (primary = false): React.CSSProperties => ({
  height: 'var(--control-h-md)', padding: '0 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', whiteSpace: 'nowrap',
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
  border: `1px solid ${primary ? 'var(--accent)' : 'var(--border-control)'}`,
  background: primary ? 'var(--accent)' : 'transparent',
  color: primary ? 'var(--on-accent)' : 'var(--text-default)',
})
const label: React.CSSProperties = { fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }
const h2: React.CSSProperties = { fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }
const sub: React.CSSProperties = { fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }

/** 兩個指標排名相關 ≥ 此值視為高度重複 */
const REDUNDANT = 0.8

interface Draft { id: string | null; name: string; desc: string; components: Component[]; aiNote: string | null }
interface AiSuggestion {
  name: string; summary: string; cautions: string[]; model: string
  components: (Component & { reason: string })[]
}

export default function CustomIndexSection({ catalog, villages, geo, presets, store, password, onPassword, onChanged, onViewOnMap, highlightDistrict }: {
  catalog: Catalog
  villages: Village[]
  geo: VillageGeo
  presets: IndexDef[]
  store: CustomStore
  password: string | null
  onPassword: (pw: string) => void
  onChanged: () => Promise<void> | void
  onViewOnMap: (indexId: string) => void
  highlightDistrict?: string
}) {
  if (password === null) return <div style={{ height: 300 }} />   // 尚未讀到 localStorage
  if (!password) return <PasswordGate onPassword={onPassword} />
  if (store.status === 'error') {
    return (
      <div style={{ ...cardStyle, color: 'var(--text-default)', fontSize: 'var(--text-sm)' }}>
        ⚠ {store.error}
        <button style={{ ...btn(), marginLeft: 12 }} onClick={() => onChanged()}>重試</button>
      </div>
    )
  }
  if (store.status !== 'ready') return <div style={{ ...cardStyle, color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>讀取自訂資料中…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <IndexEditor
        catalog={catalog} villages={villages} geo={geo} presets={presets} saved={store.indices}
        password={password} onChanged={onChanged} onViewOnMap={onViewOnMap} highlightDistrict={highlightDistrict}
      />
      <DatasetEditor datasets={store.datasets} villages={villages} password={password} onChanged={onChanged} />
    </div>
  )
}

/* ── 密碼閘（與 AI 問答共用） ──────────────────────────────────── */
function PasswordGate({ onPassword }: { onPassword: (pw: string) => void }) {
  const [pw, setPw] = useState('')
  return (
    <form
      onSubmit={e => { e.preventDefault(); if (pw.trim()) onPassword(pw.trim()) }}
      style={{ ...cardStyle, maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={h2}>自訂指數需要密碼</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)', lineHeight: 1.7 }}>
        手動加入的資料、自訂指數和 AI 建議都存在資料庫，用 AI 問答的同一組密碼保護。輸入一次後，這台裝置兩邊都能用。
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="custom-pw" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="密碼" autoComplete="current-password" style={{ ...inputStyle, flex: 1 }} />
        <button type="submit" style={btn(true)}>解鎖</button>
      </div>
    </form>
  )
}

/* ── API 小工具 ───────────────────────────────────────────────── */
async function post(password: string, body: unknown): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const r = await fetch('/api/potential-buyers/custom', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-chat-password': password }, body: JSON.stringify(body),
    })
    const j = await r.json()
    return r.ok ? { ok: true, id: j.id } : { ok: false, error: j.error ?? '儲存失敗' }
  } catch {
    return { ok: false, error: '連線失敗' }
  }
}

/** 兩步確認的刪除鈕（瀏覽器 confirm() 在部分環境無效，改在頁面上確認） */
function DeleteButton({ onConfirm, label = '刪除' }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false)
  return armed ? (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <button style={{ ...btn(), borderColor: 'var(--negative)', color: 'var(--negative)' }} onClick={() => { setArmed(false); onConfirm() }}>確定{label}</button>
      <button style={btn()} onClick={() => setArmed(false)}>取消</button>
    </span>
  ) : (
    <button style={btn()} onClick={() => setArmed(true)}>{label}</button>
  )
}

/* ── 指標下拉選單（依分類分組） ──────────────────────────────── */
function IndicatorSelect({ id, value, onChange, indicators }: { id: string; value: string; onChange: (k: string) => void; indicators: Indicator[] }) {
  const groups = [...new Set(indicators.map(i => i.group))]
  return (
    <select id={id} value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, width: '100%' }} aria-label="指標">
      {!indicators.some(i => i.key === value) && <option value={value}>（找不到：{value}）</option>}
      {groups.map(g => (
        <optgroup key={g} label={g}>
          {indicators.filter(i => i.group === g).map(i => (
            <option key={i.key} value={i.key}>{i.label}{i.level === '行政區' ? '（區）' : ''}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/* ══ 指數編輯器 ══════════════════════════════════════════════════ */
function IndexEditor({ catalog, villages, geo, presets, saved, password, onChanged, onViewOnMap, highlightDistrict }: {
  catalog: Catalog; villages: Village[]; geo: VillageGeo; presets: IndexDef[]; saved: IndexDef[]
  password: string; onChanged: () => Promise<void> | void; onViewOnMap: (id: string) => void; highlightDistrict?: string
}) {
  const blank = (): Draft => ({ id: null, name: '', desc: '', components: [{ key: 'income', weight: 50 }, { key: 'share2534', weight: 50 }], aiNote: null })
  const [draft, setDraft] = useState<Draft>(() => saved[0]
    ? { id: saved[0].id, name: saved[0].name, desc: saved[0].desc, components: saved[0].components, aiNote: saved[0].aiNote ?? null }
    : blank())
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [selVillage, setSelVillage] = useState<string | null>(null)

  const codes = useMemo(() => villages.map(v => v.code), [villages])
  const rankCache = useMemo(() => new Map<string, Map<string, number>>(), [catalog])   // eslint-disable-line react-hooks/exhaustive-deps
  const res = useMemo(() => computeIndex(draft, catalog, codes, rankCache), [draft, catalog, codes, rankCache])
  const presetScores = useMemo(() => presets.map(p => ({ p, s: computeIndex(p, catalog, codes, rankCache).scores })), [presets, catalog, codes, rankCache])

  const load = (d: IndexDef, asCopy = false) => {
    setDraft({
      id: asCopy ? null : d.id, name: asCopy ? `${d.name}（複製）` : d.name, desc: d.desc,
      components: d.components.map(c => ({ ...c })), aiNote: asCopy ? null : d.aiNote ?? null,
    })
    setMsg(null)
  }
  const setComp = (i: number, patch: Partial<Component>) =>
    setDraft(d => ({ ...d, components: d.components.map((c, k) => (k === i ? { ...c, ...patch } : c)) }))

  const save = async () => {
    if (!draft.name.trim()) { setMsg({ ok: false, text: '請先填指數名稱' }); return }
    setBusy(true)
    const r = await post(password, { action: 'saveIndex', index: draft })
    setBusy(false)
    if (!r.ok) { setMsg({ ok: false, text: r.error ?? '儲存失敗' }); return }
    setDraft(d => ({ ...d, id: r.id ?? d.id }))
    setMsg({ ok: true, text: '已儲存，可在「村里指數」頁籤選擇這個指數' })
    await onChanged()
  }
  const remove = async () => {
    if (!draft.id) return
    const r = await post(password, { action: 'deleteIndex', id: draft.id })
    if (!r.ok) { setMsg({ ok: false, text: r.error ?? '刪除失敗' }); return }
    setDraft(blank()); setMsg({ ok: true, text: '已刪除' })
    await onChanged()
  }

  // 高度重複的組成（排名相關 ≥ 0.8）
  const redundant = useMemo(() => redundantPairs(res.used.map(c => c.key), catalog), [res.used, catalog])

  // 預覽：地圖、前 10 名、與三個預設指數的相似度
  const scores = res.scores
  const breaks = useMemo(() => quintileBreaks([...scores.values()]), [scores])
  const classByCode = useMemo(() => new Map([...scores].map(([k, v]) => [k, classOf(v, breaks)])), [scores, breaks])
  const tooltipByCode = useMemo(() => new Map(villages.map(v => [v.code, `${v.district} ${v.village}｜${draft.name || '自訂指數'} ${scores.get(v.code)?.toFixed(1)}`])), [villages, scores, draft.name])
  const lowConfidence = useMemo(() => new Set(villages.filter(v => v.lowConfidence).map(v => v.code)), [villages])
  const top = [...villages].filter(v => !highlightDistrict || v.district === highlightDistrict)
    .sort((a, b) => (scores.get(b.code) ?? 0) - (scores.get(a.code) ?? 0)).slice(0, 10)

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 12 }}>
        <span style={h2}>自訂指數</span>
        <span style={sub}>挑指標、給權重，即時看到各里排名；儲存後可在「村里指數」頁籤選用</span>
      </div>

      {/* 已存的指數 + 從預設複製 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>已儲存：</span>
        {saved.length === 0 && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>還沒有</span>}
        {saved.map(s => (
          <button key={s.id} onClick={() => load(s)} style={chip(draft.id === s.id)}>{s.name}</button>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--border-card)', margin: '0 4px' }} />
        <button onClick={() => { setDraft(blank()); setMsg(null) }} style={chip(false)}>＋ 新指數</button>
        {presets.map(p => <button key={p.id} onClick={() => load(p, true)} style={chip(false)} title="以預設指數為起點複製一份">複製{p.short}</button>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
        {/* 左：編輯 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
            <label style={label}>指數名稱
              <input id="idx-name" value={draft.name} maxLength={40} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="例：南科工程師首購" style={inputStyle} />
            </label>
            <label style={label}>說明（選填）
              <input id="idx-desc" value={draft.desc} maxLength={500} onChange={e => setDraft(d => ({ ...d, desc: e.target.value }))} placeholder="這個指數想找什麼客群" style={inputStyle} />
            </label>
          </div>

          {/* 組成格子 */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)', minWidth: 460 }}>
              <thead>
                <tr>
                  {['指標', '權重', '反向', '占比', ''].map((h, i) => (
                    <th key={i} style={{ padding: '4px 6px', textAlign: i === 0 ? 'left' : 'center', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-card)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.components.map((c, i) => {
                  const share = res.totalWeight && c.weight > 0 && catalog.values.has(c.key) ? c.weight / res.totalWeight * 100 : 0
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-card)' }}>
                      <td style={{ padding: '6px', minWidth: 180 }}>
                        <IndicatorSelect id={`comp-${i}`} value={c.key} onChange={k => setComp(i, { key: k })} indicators={catalog.indicators} />
                      </td>
                      <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input id={`w-range-${i}`} type="range" min={0} max={100} step={5} value={c.weight} onChange={e => setComp(i, { weight: Number(e.target.value) })} style={{ width: 90 }} aria-label="權重滑桿" />
                          <input id={`w-num-${i}`} type="number" min={0} max={100} value={c.weight} onChange={e => setComp(i, { weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} style={{ ...inputStyle, width: 58, padding: '0 6px' }} aria-label="權重" />
                        </div>
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>
                        <input id={`inv-${i}`} type="checkbox" checked={!!c.invert} onChange={e => setComp(i, { invert: e.target.checked })} title="勾選代表數值越低越好" aria-label="反向" />
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{share.toFixed(0)}%</td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>
                        <button onClick={() => setDraft(d => ({ ...d, components: d.components.filter((_, k) => k !== i) }))} aria-label="移除這個指標" style={{ ...btn(), padding: '0 8px' }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btn()} onClick={() => setDraft(d => ({ ...d, components: [...d.components, { key: catalog.indicators[0]?.key ?? 'income', weight: 20 }] }))}>＋ 加一個指標</button>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', alignSelf: 'center' }}>權重會自動換算成占比，不用剛好加到 100；「反向」代表數值越低分數越高。</span>
          </div>

          {redundant.length > 0 && (
            <div style={warnBox}>
              ⚠ 以下指標排名幾乎同步，同時放等於重複加權：
              {redundant.map(([a, b, r]) => <div key={a + b}>・{catalog.byKey.get(a)?.label} ↔ {catalog.byKey.get(b)?.label}（相關 {r.toFixed(2)}）</div>)}
            </div>
          )}

          <AiAssistant
            catalog={catalog} current={draft.components} password={password}
            onApply={(s, mode) => setDraft(d => ({
              ...d,
              name: d.name || s.name,
              aiNote: [s.summary, ...s.components.map(c => `${catalog.byKey.get(c.key)?.label ?? c.key}：${c.reason}`)].join('\n'),
              components: mode === 'replace'
                ? s.components.map(({ key, weight, invert }) => ({ key, weight, invert }))
                : [...d.components.filter(c => !s.components.some(x => x.key === c.key)), ...s.components.map(({ key, weight, invert }) => ({ key, weight, invert }))],
            }))}
          />

          {draft.aiNote && (
            <details style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
              <summary style={{ cursor: 'pointer' }}>AI 建議理由（會一起儲存）</summary>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginTop: 4 }}>{draft.aiNote}</div>
            </details>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={btn(true)} onClick={save} disabled={busy}>{busy ? '儲存中…' : draft.id ? '儲存變更' : '儲存指數'}</button>
            {draft.id && <button style={btn()} onClick={() => onViewOnMap(draft.id!)}>在村里指數地圖上看 →</button>}
            {draft.id && <DeleteButton onConfirm={remove} />}
            {msg && <span role="status" style={{ fontSize: 'var(--text-xs)', color: msg.ok ? 'var(--positive)' : 'var(--negative)' }}>{msg.text}</span>}
          </div>
        </div>

        {/* 右：即時預覽 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ position: 'relative', height: 380, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
            <VillageChoroplethMap
              geojson={geo} classByCode={classByCode} lowConfidence={lowConfidence} tooltipByCode={tooltipByCode}
              selected={selVillage} onSelect={setSelVillage} focusCodes={codes}
            />
            <Legend breaks={breaks} title={draft.name || '自訂指數'} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
            和預設指數的排名相似度：
            {presetScores.map(({ p, s }) => {
              const r = rankCorr(scores, s)
              return <span key={p.id} style={chip(false)}>{p.short} <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{r == null ? '—' : r.toFixed(2)}</b></span>
            })}
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>{highlightDistrict || '全市'}前 10 名</div>
            {top.map((v, i) => (
              <button key={v.code} onClick={() => setSelVillage(v.code)} style={{
                width: '100%', display: 'flex', gap: 8, padding: '4px 2px', background: v.code === selVillage ? 'var(--accent-wash)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--border-card)', cursor: 'pointer', fontSize: 'var(--text-2xs)', color: 'var(--text-default)', fontFamily: 'var(--font-sans)', textAlign: 'left',
              }}>
                <span style={{ width: 18, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
                <span style={{ flex: 1 }}><span style={{ color: 'var(--text-muted)' }}>{v.district}</span> {v.village}{v.lowConfidence && <span style={{ color: 'var(--warning)' }}> ⚠</span>}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-strong)' }}>{scores.get(v.code)?.toFixed(1)}</span>
              </button>
            ))}
          </div>
          {selVillage && (() => {
            const v = villages.find(x => x.code === selVillage)
            if (!v) return null
            return (
              <div style={{ fontSize: 'var(--text-2xs)', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', padding: 8 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>{v.district} {v.village}：{scores.get(v.code)?.toFixed(1)} 分</div>
                {res.used.map(c => {
                  const ind = catalog.byKey.get(c.key)
                  const p = res.parts.get(c.key + (c.invert ? ':inv' : ''))?.get(v.code) ?? 50
                  return (
                    <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text-default)' }}>
                      <span>{ind?.label}{c.invert ? '（反向）' : ''}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmtValue(ind, catalog.values.get(c.key)?.get(v.code))}・百分位 {Math.round(p)}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

function redundantPairs(keys: string[], catalog: Catalog): [string, string, number][] {
  const out: [string, string, number][] = []
  const uniq = [...new Set(keys)]
  const nonNull = (k: string) => new Map([...(catalog.values.get(k) ?? new Map())].filter((e): e is [string, number] => e[1] != null))
  for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
    const r = rankCorr(nonNull(uniq[i]), nonNull(uniq[j]))
    if (r != null && Math.abs(r) >= REDUNDANT) out.push([uniq[i], uniq[j], r])
  }
  return out
}

/* ── AI 協助 ──────────────────────────────────────────────────── */
function AiAssistant({ catalog, current, password, onApply }: {
  catalog: Catalog; current: Component[]; password: string
  onApply: (s: AiSuggestion, mode: 'replace' | 'merge') => void
}) {
  const [goal, setGoal] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sug, setSug] = useState<AiSuggestion | null>(null)

  const ask = async () => {
    if (!goal.trim()) { setErr('先描述想找的客群'); return }
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/potential-buyers/ai-weights', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-chat-password': password },
        body: JSON.stringify({
          goal,
          current,
          indicators: catalog.indicators.map(i => ({ key: i.key, label: i.label, unit: i.unit, group: i.group, level: i.level, desc: i.desc })),
        }),
      })
      const j = await r.json()
      if (!r.ok) setErr(j.error ?? 'AI 建議失敗')
      else setSug(j)
    } catch {
      setErr('連線失敗')
    }
    setBusy(false)
  }

  const redundant = sug ? redundantPairs(sug.components.map(c => c.key), catalog) : []

  return (
    <div style={{ border: '1px dashed var(--accent-wash-border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--accent-wash)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-tint)' }}>AI 協助：描述客群，AI 建議指標與權重</div>
      <textarea
        id="ai-goal" value={goal} onChange={e => setGoal(e.target.value)} maxLength={500} rows={2}
        placeholder="例：南科工程師、30 歲左右、首購預算 1,500 萬內、偏好有學區的新成屋"
        style={{ ...inputStyle, height: 'auto', padding: 8, resize: 'vertical', lineHeight: 1.6 }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={btn(true)} onClick={ask} disabled={busy}>{busy ? 'AI 思考中…' : '請 AI 建議'}</button>
        <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>使用 Gemini 免費額度，與 AI 問答共用每日上限；建議僅供參考</span>
        {err && <span role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--negative)' }}>{err}</span>}
      </div>

      {sug && (
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{sug.name || 'AI 建議'}</div>
          {sug.summary && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)', lineHeight: 1.6 }}>{sug.summary}</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-2xs)' }}>
            <tbody>
              {sug.components.map(c => (
                <tr key={c.key} style={{ borderBottom: '1px solid var(--border-card)', verticalAlign: 'top' }}>
                  <td style={{ padding: '4px 4px', color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>
                    {catalog.byKey.get(c.key)?.label ?? c.key}{c.invert && <span style={{ color: 'var(--warning)' }}>（反向）</span>}
                  </td>
                  <td style={{ padding: '4px 4px', fontFamily: 'var(--font-mono)', color: 'var(--accent-tint)', textAlign: 'right' }}>{c.weight}</td>
                  <td style={{ padding: '4px 4px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sug.cautions.length > 0 && (
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {sug.cautions.map((c, i) => <div key={i}>・{c}</div>)}
            </div>
          )}
          {redundant.length > 0 && (
            <div style={warnBox}>
              ⚠ 實際資料檢查：{redundant.map(([a, b, r]) => `${catalog.byKey.get(a)?.label} ↔ ${catalog.byKey.get(b)?.label}（${r.toFixed(2)}）`).join('、')} 高度重複
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btn(true)} onClick={() => onApply(sug, 'replace')}>套用（取代目前配方）</button>
            <button style={btn()} onClick={() => onApply(sug, 'merge')}>加到目前配方</button>
            <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', alignSelf: 'center' }}>模型：{sug.model}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══ 手動資料 ════════════════════════════════════════════════════ */
interface DsDraft { id: string | null; name: string; unit: string; level: 'village' | 'district'; source: string; description: string; values: Record<string, number> }

function DatasetEditor({ datasets, villages, password, onChanged }: {
  datasets: CustomDataset[]; villages: Village[]; password: string; onChanged: () => Promise<void> | void
}) {
  const blank = (): DsDraft => ({ id: null, name: '', unit: '', level: 'district', source: '', description: '', values: {} })
  const [draft, setDraft] = useState<DsDraft | null>(null)
  const [paste, setPaste] = useState('')
  const [parseMsg, setParseMsg] = useState<string | null>(null)
  const [villageDistrict, setVillageDistrict] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const districts = useMemo(() => [...new Set(villages.map(v => v.district))].sort((a, b) => a.localeCompare(b, 'zh-TW')), [villages])

  const edit = (d: CustomDataset) => {
    setDraft({ id: d.id, name: d.name, unit: d.unit ?? '', level: d.level, source: d.source ?? '', description: d.description ?? '', values: { ...d.values } })
    setPaste(''); setParseMsg(null); setMsg(null)
  }
  const setValue = (key: string, raw: string) => setDraft(d => {
    if (!d) return d
    const values = { ...d.values }
    const x = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(x)) delete values[key]
    else values[key] = x
    return { ...d, values }
  })
  const applyPaste = () => {
    if (!draft) return
    const r = parseAreaValues(paste, draft.level, villages)
    const n = Object.keys(r.values).length
    setDraft({ ...draft, values: { ...draft.values, ...r.values } })
    setParseMsg(`對到 ${n} 筆${r.unmatched.length ? `；${r.unmatched.length} 行對不到：${r.unmatched.slice(0, 5).join('｜')}${r.unmatched.length > 5 ? '…' : ''}` : ''}`)
  }
  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) { setMsg({ ok: false, text: '請先填資料名稱' }); return }
    setBusy(true)
    const r = await post(password, { action: 'saveDataset', dataset: draft })
    setBusy(false)
    if (!r.ok) { setMsg({ ok: false, text: r.error ?? '儲存失敗' }); return }
    setDraft(d => (d ? { ...d, id: r.id ?? d.id } : d))
    setMsg({ ok: true, text: '已儲存，指數編輯器的「手動資料」分類裡可以選到' })
    await onChanged()
  }
  const remove = async (id: string) => {
    const r = await post(password, { action: 'deleteDataset', id })
    if (!r.ok) { setMsg({ ok: false, text: r.error ?? '刪除失敗' }); return }
    if (draft?.id === id) setDraft(null)
    setMsg({ ok: true, text: '已刪除' })
    await onChanged()
  }

  const n = draft ? Object.keys(draft.values).length : 0
  const total = draft?.level === 'district' ? districts.length : villages.length

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 12 }}>
        <span style={h2}>手動資料</span>
        <span style={sub}>加入自己的資料（例如：建案去化率、客戶來源分布），可放進自訂指數，也會出現在「資料總覽」</span>
      </div>

      {/* 已存的資料 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {datasets.length === 0 && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>還沒有手動資料</div>}
        {datasets.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-md)', background: draft?.id === d.id ? 'var(--accent-wash)' : 'var(--bg-sunken)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)' }}>{d.name}</span>
            <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-muted)' }}>{d.level === 'village' ? '村里' : '行政區'}・{Object.keys(d.values).length} 筆{d.unit ? `・${d.unit}` : ''}{d.updatedAt ? `・${d.updatedAt.slice(0, 10)}` : ''}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
              <button style={btn()} onClick={() => edit(d)}>編輯</button>
              <DeleteButton onConfirm={() => remove(d.id)} />
            </span>
          </div>
        ))}
        {!draft && <button style={{ ...btn(true), alignSelf: 'flex-start', marginTop: 4 }} onClick={() => { setDraft(blank()); setMsg(null) }}>＋ 新增資料</button>}
        {!draft && msg && <span role="status" style={{ fontSize: 'var(--text-xs)', color: msg.ok ? 'var(--positive)' : 'var(--negative)' }}>{msg.text}</span>}
      </div>

      {draft && (
        <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 10 }}>
            <label style={label}>資料名稱
              <input id="ds-name" value={draft.name} maxLength={60} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="例：建案平均去化率" style={inputStyle} />
            </label>
            <label style={label}>單位
              <input id="ds-unit" value={draft.unit} maxLength={20} onChange={e => setDraft({ ...draft, unit: e.target.value })} placeholder="例：%" style={inputStyle} />
            </label>
            <label style={label}>層級
              <select id="ds-level" value={draft.level} disabled={n > 0} onChange={e => setDraft({ ...draft, level: e.target.value as DsDraft['level'] })} style={inputStyle} title={n > 0 ? '已有數值時不能改層級' : ''}>
                <option value="district">行政區（37 區）</option>
                <option value="village">村里（650 里）</option>
              </select>
            </label>
            <label style={label}>來源（選填）
              <input id="ds-source" value={draft.source} maxLength={200} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="例：自行調查 2026Q3" style={inputStyle} />
            </label>
          </div>
          <label style={label}>說明（選填）
            <input id="ds-desc" value={draft.description} maxLength={500} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="這筆資料代表什麼、怎麼算的" style={inputStyle} />
          </label>

          {/* 貼上 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label} htmlFor="ds-paste">從 Excel／Google 試算表貼上（每行一筆）
              <span style={{ color: 'var(--text-faint)' }}>
                {draft.level === 'district' ? '格式：行政區, 數值（例：永康區, 12.5）' : '格式：行政區, 村里, 數值（例：永康區, 光復里, 12.5）或 村里代碼, 數值'}
              </span>
            </label>
            <textarea id="ds-paste" value={paste} onChange={e => setPaste(e.target.value)} rows={4} style={{ ...inputStyle, height: 'auto', padding: 8, fontFamily: 'var(--font-mono)', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={btn()} onClick={applyPaste} disabled={!paste.trim()}>解析並填入格子</button>
              {parseMsg && <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{parseMsg}</span>}
            </div>
          </div>

          {/* 格子 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)' }}>逐格輸入</span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>已填 {n} / {total}；空白代表沒資料（計算指數時給中間分 50）</span>
              {draft.level === 'village' && (
                <select id="ds-village-district" value={villageDistrict} onChange={e => setVillageDistrict(e.target.value)} style={inputStyle} aria-label="選擇行政區">
                  <option value="">選擇行政區…</option>
                  {districts.map(d => <option key={d} value={d}>{d}（{villages.filter(v => v.district === d && draft.values[v.code] != null).length}/{villages.filter(v => v.district === d).length}）</option>)}
                </select>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(170px, 100%), 1fr))', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
              {(draft.level === 'district'
                ? districts.map(d => ({ key: d, name: d }))
                : villages.filter(v => v.district === villageDistrict).map(v => ({ key: v.code, name: v.village }))
              ).map(a => (
                <label key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-2xs)', color: 'var(--text-default)' }}>
                  <span style={{ width: 64, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  <input
                    id={`ds-v-${a.key}`} type="number" step="any" inputMode="decimal"
                    value={draft.values[a.key] ?? ''} onChange={e => setValue(a.key, e.target.value)}
                    style={{ ...inputStyle, flex: 1, height: 'var(--control-h-sm)', fontFamily: 'var(--font-mono)' }}
                  />
                </label>
              ))}
              {draft.level === 'village' && !villageDistrict && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>先選一個行政區，再逐里輸入；整批資料建議用上面的貼上</div>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={btn(true)} onClick={save} disabled={busy}>{busy ? '儲存中…' : '儲存資料'}</button>
            <button style={btn()} onClick={() => { setDraft(null); setMsg(null) }}>關閉</button>
            {msg && <span role="status" style={{ fontSize: 'var(--text-xs)', color: msg.ok ? 'var(--positive)' : 'var(--negative)' }}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 共用樣式 ─────────────────────────────────────────────────── */
const chip = (active: boolean): React.CSSProperties => ({
  height: 'var(--control-h-sm)', padding: '0 10px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
  fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
  display: 'inline-flex', alignItems: 'center', gap: 4,
  border: `1px solid ${active ? 'var(--accent-wash-border)' : 'var(--border-control)'}`,
  background: active ? 'var(--accent-wash)' : 'transparent',
  color: active ? 'var(--accent-tint)' : 'var(--text-muted)',
})
const warnBox: React.CSSProperties = {
  fontSize: 'var(--text-2xs)', color: 'var(--text-default)', background: 'rgba(232,162,59,0.10)',
  border: '1px solid rgba(232,162,59,0.30)', borderRadius: 'var(--radius-md)', padding: '6px 8px', lineHeight: 1.7,
}

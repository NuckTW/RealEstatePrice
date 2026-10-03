'use client'

import { useMemo, useState } from 'react'

export interface SchoolData {
  byDistrict: { year: number; level: string; district: string; entry: number; total: number; schools: number }[]
  growth: {
    level: string; code: string; name: string; district: string | null; isPublic: boolean
    yearNow: number; yearThen: number; entryNow: number | null; entryThen: number | null; totalNow: number | null
  }[]
}

type Level = '國小' | '國中'
/** 比較年數：最新學年 vs 5 年前（入學人數單年波動大，太短看不出趨勢） */
const SPAN = 5

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 'var(--radius-lg)', padding: 16,
}
const pct = (a: number | null | undefined, b: number | null | undefined) => (a != null && b) ? (a / b - 1) * 100 : null

export default function SchoolSection({ data, highlightDistrict }: { data: SchoolData; highlightDistrict?: string }) {
  const [level, setLevel] = useState<Level>('國小')
  const entryLabel = level === '國小' ? '一年級新生' : '七年級新生'

  const view = useMemo(() => {
    const rows = data.byDistrict.filter(r => r.level === level)
    const y1 = Math.max(...rows.map(r => r.year)), y0 = y1 - SPAN
    const at = (d: string, y: number) => rows.find(r => r.district === d && r.year === y)
    const districts = [...new Set(rows.map(r => r.district))].map(d => {
      const now = at(d, y1), then = at(d, y0)
      return { district: d, entryNow: now?.entry ?? null, entryThen: then?.entry ?? null, chg: pct(now?.entry, then?.entry), total: now?.total ?? null, schools: now?.schools ?? null }
    }).filter(r => r.entryNow != null).sort((a, b) => (b.chg ?? -999) - (a.chg ?? -999))
    const sum = (y: number) => rows.filter(r => r.year === y).reduce((s, r) => s + r.entry, 0)
    // 新生成長最多的學校（排除 5 年前新生 < 30 人的小校，避免小基數放大）
    const top = data.growth
      .filter(g => g.level === level && g.entryNow != null && g.entryThen != null && g.entryThen >= 30)
      .map(g => ({ ...g, diff: g.entryNow! - g.entryThen! }))
      .sort((a, b) => b.diff - a.diff).slice(0, 10)
    return { y0, y1, districts, cityNow: sum(y1), cityThen: sum(y0), top }
  }, [data, level])

  if (!view.districts.length) return null
  const chgCell = (v: number | null) => (
    <span style={{ color: v == null ? 'var(--text-faint)' : v >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
      {v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
    </span>
  )
  const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-card)' }
  const td: React.CSSProperties = { padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>學區學生數</span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
          新生人數反映有學齡子女的家庭（換屋客群）；不計入村里指數
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div role="tablist" style={{ display: 'inline-flex', padding: 3, gap: 3, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)', border: '1px solid var(--border-control)' }}>
          {(['國小', '國中'] as Level[]).map(l => (
            <button key={l} role="tab" aria-selected={level === l} onClick={() => setLevel(l)} style={{
              height: 'var(--control-h-sm)', padding: '0 12px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
              background: level === l ? 'var(--accent)' : 'transparent', color: level === l ? 'var(--on-accent)' : 'var(--text-muted)',
            }}>{l}</button>
          ))}
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
          全市{entryLabel}：{view.y0} 學年 {view.cityThen.toLocaleString()} → {view.y1} 學年 {view.cityNow.toLocaleString()}（{chgCell(pct(view.cityNow, view.cityThen))}）
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div style={{ overflowX: 'auto', maxHeight: 420 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-card)' }}>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>行政區</th>
                <th style={th}>{view.y0} {entryLabel}</th>
                <th style={th}>{view.y1} {entryLabel}</th>
                <th style={th}>{SPAN} 年變化</th>
                <th style={th}>總學生數</th>
                <th style={th}>校數</th>
              </tr>
            </thead>
            <tbody>
              {view.districts.map(r => (
                <tr key={r.district} style={{ borderBottom: '1px solid var(--border-card)', background: r.district === highlightDistrict ? 'var(--accent-wash)' : undefined }}>
                  <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>{r.district}</td>
                  <td style={td}>{r.entryThen?.toLocaleString() ?? '—'}</td>
                  <td style={{ ...td, color: 'var(--text-strong)', fontWeight: 600 }}>{r.entryNow?.toLocaleString() ?? '—'}</td>
                  <td style={td}>{chgCell(r.chg)}</td>
                  <td style={td}>{r.total?.toLocaleString() ?? '—'}</td>
                  <td style={{ ...td, color: 'var(--text-faint)' }}>{r.schools ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 6 }}>
            {entryLabel}增加最多的學校（{view.y0} → {view.y1} 學年）
          </div>
          {view.top.map((g, k) => (
            <div key={g.code} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border-card)', fontSize: 'var(--text-xs)' }}>
              <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{k + 1}</span>
              <span style={{ color: 'var(--text-default)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{g.district ?? ''}</span> {g.name.replace(/^(市立|國立|私立)/, '')}
                {!g.isPublic && <span style={{ marginLeft: 4, fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>私立</span>}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{g.entryThen} → {g.entryNow}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--positive)', minWidth: 40, textAlign: 'right' }}>+{g.diff}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        依 {SPAN} 年新生變化排序；新生數也受少子化、越區就讀、學區調整與新設校影響，宜搭配人口資料判讀。
        學校成長榜排除 {view.y0} 學年新生未滿 30 人的小校。資料：教育部統計處國民小學／國民中學校別資料（行政區依校址）。
      </div>
    </div>
  )
}

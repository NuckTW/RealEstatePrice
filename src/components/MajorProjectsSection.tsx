'use client'

import { useMemo, useState } from 'react'
import { MAJOR_PROJECTS, VERIFIED_AT, type ProjectCategory, type ProjectStatus } from '@/lib/majorProjects'

const CATEGORIES: (ProjectCategory | '全部')[] = ['全部', '捷運', '鐵路', '道路', '產業', '重劃區']

/** 狀態徽章：以文字 + 色點呈現（不只靠顏色辨識） */
const STATUS_TONE: Record<ProjectStatus, string> = {
  '規劃中': 'var(--text-faint)',
  '已核定': 'var(--info)',
  '發包中': 'var(--info)',
  '施工中': 'var(--warning)',
  '即將完工': 'var(--positive)',
  '已完工': 'var(--text-muted)',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 'var(--radius-lg)', padding: 16,
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-3xs)', fontWeight: 600,
      padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-control)',
      color: 'var(--text-default)', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_TONE[status] }} />
      {status}
    </span>
  )
}

export default function MajorProjectsSection({ highlightDistrict }: { highlightDistrict?: string }) {
  const [cat, setCat] = useState<ProjectCategory | '全部'>('全部')
  const [open, setOpen] = useState<string | null>(null)

  const list = useMemo(() => MAJOR_PROJECTS
    .filter(p => cat === '全部' || p.category === cat)
    // 有選行政區時，影響該區的建設排前面；其餘依預定完成年（未定的放最後）
    .sort((a, b) => {
      const ha = highlightDistrict && a.districts.includes(highlightDistrict) ? 0 : 1
      const hb = highlightDistrict && b.districts.includes(highlightDistrict) ? 0 : 1
      return ha - hb || (a.expectedYear ?? 9999) - (b.expectedYear ?? 9999)
    }), [cat, highlightDistrict])

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>重大建設時程表</span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
          捷運、鐵路地下化、交流道、產業園區、重劃區；{highlightDistrict ? `影響${highlightDistrict}的排在前面；` : ''}不計入村里指數
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            height: 'var(--control-h-sm)', padding: '0 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
            fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
            border: `1px solid ${cat === c ? 'var(--accent-wash-border)' : 'var(--border-control)'}`,
            background: cat === c ? 'var(--accent-wash)' : 'transparent',
            color: cat === c ? 'var(--accent-tint)' : 'var(--text-muted)',
          }}>
            {c}{c !== '全部' && <span style={{ marginLeft: 4, opacity: 0.6 }}>{MAJOR_PROJECTS.filter(p => p.category === c).length}</span>}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {list.map(p => {
          const hit = highlightDistrict && p.districts.includes(highlightDistrict)
          const expanded = open === p.id
          return (
            <div key={p.id} style={{
              border: `1px solid ${hit ? 'var(--accent-wash-border)' : 'var(--border-card)'}`,
              background: hit ? 'var(--accent-wash)' : 'var(--bg-sunken)',
              borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>{p.category}</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.35 }}>{p.name}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
                預定：<b style={{ color: 'var(--text-strong)' }}>{p.expected}</b>
                {p.budget && <span style={{ color: 'var(--text-muted)' }}>｜{p.budget}</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {p.districts.map(d => (
                  <span key={d} style={{
                    fontSize: 'var(--text-3xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                    background: d === highlightDistrict ? 'var(--accent)' : 'var(--surface-control)',
                    color: d === highlightDistrict ? 'var(--on-accent)' : 'var(--text-muted)',
                  }}>{d}</span>
                ))}
              </div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-default)', lineHeight: 1.6 }}>{p.summary}</div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--accent-tint)', lineHeight: 1.6 }}>購屋觀點：{p.impact}</div>

              <button onClick={() => setOpen(expanded ? null : p.id)} style={{
                alignSelf: 'flex-start', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
              }}>{expanded ? '▲ 收合時程與來源' : '▼ 展開時程與來源'}</button>

              {expanded && (
                <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: 8 }}>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {p.timeline.map((t, k) => (
                      <li key={k} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8, fontSize: 'var(--text-2xs)', padding: '2px 0' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{t.date}</span>
                        <span style={{ color: 'var(--text-default)' }}>{t.label}</span>
                      </li>
                    ))}
                  </ol>
                  {p.note && <div style={{ marginTop: 6, fontSize: 'var(--text-3xs)', color: 'var(--warning)', lineHeight: 1.6 }}>⚠ {p.note}</div>}
                  <div style={{ marginTop: 6, fontSize: 'var(--text-3xs)', color: 'var(--text-faint)', lineHeight: 1.7 }}>
                    來源：{p.sources.map((s, k) => (
                      <span key={k}>{k > 0 && '、'}<a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>{s.title}</a></span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        資料整理日期 {VERIFIED_AT}，依政府新聞稿與媒體報導人工彙整；時程常有變動，請以主管機關最新公告為準。
        捷運與鐵路以站點所在行政區、產業與重劃區以基地所在行政區標示。
      </div>
    </div>
  )
}

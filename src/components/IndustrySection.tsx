'use client'

import { useMemo, useState } from 'react'

export interface IndustryPoint { indicator: string; level: string; area: string; period: string; value: number }

/** 行業代號 → 中文（對應 scripts/fetch_industry_census.py） */
const INDUSTRY_LABEL: Record<string, string> = {
  mfg: '製造業', electricity: '電力燃氣', water: '用水污染整治', construction: '營建工程', trade: '批發零售',
  transport: '運輸倉儲', accommodation: '住宿餐飲', ict: '資通訊', finance: '金融保險', realestate: '不動產',
  professional: '專業科技服務', support: '支援服務', education: '教育', health: '醫療社工', arts: '藝術娛樂',
  other: '其他服務', agriculture: '農林漁牧', mining: '礦業', public: '公共行政',
}

type SortKey = 'employees' | 'jobsPerK' | 'mfgShare' | 'officerShare' | 'biz'

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)',
  borderRadius: 'var(--radius-lg)', padding: 16,
}
const fmt = (v: number | null | undefined, d = 0) =>
  v == null || Number.isNaN(v) ? '—' : v.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d })

export default function IndustrySection({ data, popByDistrict, highlightDistrict }: {
  data: IndustryPoint[]
  /** 各區人口（由村里資料加總），用來算「每千人就業機會」 */
  popByDistrict: Map<string, number>
  highlightDistrict?: string
}) {
  const [sort, setSort] = useState<SortKey>('jobsPerK')

  const view = useMemo(() => {
    const get = (area: string, ind: string) => data.find(d => d.area === area && d.indicator === ind)?.value ?? null
    const censusYear = data.find(d => d.indicator.startsWith('census_'))?.period ?? null
    const bizYear = data.find(d => d.indicator.startsWith('biz_count:'))?.period ?? null
    const districts = [...new Set(data.filter(d => d.level === 'district').map(d => d.area))]
    const rows = districts.map(area => {
      const emp = get(area, 'census_employees:all')
      // 主要產業：從業員工最多的大行業
      const byInd = Object.keys(INDUSTRY_LABEL)
        .map(k => ({ k, v: get(area, `census_employees:${k}`) ?? 0 }))
        .sort((a, b) => b.v - a.v)
      const pop = popByDistrict.get(area) ?? null
      const mfg = get(area, 'census_employees:mfg')
      const officers = get(area, 'census_officers')
      return {
        area, employees: emp, output: get(area, 'census_output:all'),
        jobsPerK: emp != null && pop ? emp / pop * 1000 : null,
        mfgShare: emp && mfg != null ? mfg / emp * 100 : null,
        officerShare: emp && officers != null ? officers / emp * 100 : null,
        top: byInd[0]?.v ? `${INDUSTRY_LABEL[byInd[0].k]} ${emp ? Math.round(byInd[0].v / emp * 100) : 0}%` : '—',
        biz: get(area, 'biz_count:all'),
      }
    })
    rows.sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1))
    const cityEmp = get('臺南市', 'census_employees:all')
    const cityPop = [...popByDistrict.values()].reduce((s, v) => s + v, 0)
    return {
      rows, censusYear, bizYear,
      city: {
        employees: cityEmp,
        jobsPerK: cityEmp && cityPop ? cityEmp / cityPop * 1000 : null,
        mfgShare: cityEmp ? (get('臺南市', 'census_employees:mfg') ?? 0) / cityEmp * 100 : null,
        officerShare: cityEmp ? (get('臺南市', 'census_officers') ?? 0) / cityEmp * 100 : null,
        biz: get('臺南市', 'biz_count:all'),
      },
    }
  }, [data, popByDistrict, sort])

  if (!view.rows.length) return null
  const maxEmp = Math.max(...view.rows.map(r => r.employees ?? 0))
  const th = (key: SortKey | null, label: string): React.ReactNode => (
    <th
      onClick={key ? () => setSort(key) : undefined}
      style={{
        padding: '6px 8px', fontWeight: 600, fontSize: 'var(--text-2xs)', textAlign: 'right', whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--border-card)', cursor: key ? 'pointer' : 'default',
        color: key && sort === key ? 'var(--accent-tint)' : 'var(--text-muted)',
      }}
    >{label}{key && sort === key ? ' ▼' : ''}</th>
  )
  const td: React.CSSProperties = { padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>產業與就業（行政區）</span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginLeft: 10 }}>
          「為什麼買在這裡」：就業機會集中的區吸引通勤購屋；不計入村里指數
        </span>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)', marginBottom: 10 }}>
        全市（{view.censusYear} 年普查）：從業員工 {fmt(view.city.employees)} 人、每千居民 {fmt(view.city.jobsPerK)} 個工作、
        製造業占 {fmt(view.city.mfgShare, 1)}%、職員（監督及專技人員）占 {fmt(view.city.officerShare, 1)}%；
        {view.bizYear} 年底工商登記 {fmt(view.city.biz)} 家
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 520 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-card)' }}>
            <tr>
              <th style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'left', borderBottom: '1px solid var(--border-card)' }}>行政區</th>
              {th('employees', '從業員工')}
              {th('jobsPerK', '每千居民工作數')}
              {th(null, '主要產業（員工占比）')}
              {th('mfgShare', '製造業占比')}
              {th('officerShare', '職員占比')}
              {th('biz', `${view.bizYear ?? ''} 工商家數`)}
            </tr>
          </thead>
          <tbody>
            {view.rows.map(r => (
              <tr key={r.area} style={{ borderBottom: '1px solid var(--border-card)', background: r.area === highlightDistrict ? 'var(--accent-wash)' : undefined }}>
                <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>{r.area}</td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <div style={{ width: 60, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)' }}>
                      <div style={{ width: `${(r.employees ?? 0) / maxEmp * 100}%`, height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--accent)' }} />
                    </div>
                    <span style={{ minWidth: 56 }}>{fmt(r.employees)}</span>
                  </div>
                </td>
                <td style={{ ...td, color: 'var(--text-strong)', fontWeight: 600 }}>{fmt(r.jobsPerK)}</td>
                <td style={{ ...td, fontFamily: 'var(--font-sans)', color: 'var(--text-muted)' }}>{r.top}</td>
                <td style={td}>{fmt(r.mfgShare, 1)}%</td>
                <td style={td}>{fmt(r.officerShare, 1)}%</td>
                <td style={td}>{fmt(r.biz)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        點欄位標題可排序。每千居民工作數 = 從業員工 ÷ 區內戶籍人口 × 1000；超過 1000 代表區外通勤進來工作的人多（就業中心）。
        職員 = 監督及專技人員，占比越高白領工作越多。從業員工、職員、主要產業為主計總處 {view.censusYear} 年工業及服務業普查（5 年一次）；
        工商家數為內政部 SEGIS 行政區工商家數（公司與商業登記，與普查的場所單位定義不同，不宜直接比較），每年更新、逐年累積。
      </div>
    </div>
  )
}

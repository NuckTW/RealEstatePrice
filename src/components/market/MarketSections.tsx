'use client'

import { useEffect, useState, type ReactNode } from 'react'
import AnalysisPanel from '@/components/AnalysisPanel'
import PriceIndexPanel from '@/components/PriceIndexPanel'
import SupplyPanel from '@/components/SupplyPanel'
import { useGlobalFilters } from '@/hooks/useGlobalFilters'
import MarketOverview from './MarketOverview'

const SECTIONS = [
  { id: 'overview', label: '概況',     desc: '依篩選列條件：KPI、量價走勢、分布統計、逐筆明細' },
  { id: 'trend',    label: '趨勢比較', desc: '多行政區並列比較單價、總價、面積、車位、交易量（以篩選列的期間與行政區為起點，可在下方另外調整）' },
  { id: 'index',    label: '價格指數', desc: '全市／建物型態／行政區住宅價格指數（基期 110 年 1 月 = 100）' },
  { id: 'supply',   label: '供給',     desc: '建照・使照核發量疊上成交量，以及各區待售新成屋' },
] as const

function Section({ id, title, desc, children }: { id: string; title: string; desc: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} style={{ scrollMarginTop: 'calc(var(--nav-h) + var(--chips-h) + 56px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2 id={`${id}-h`} style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>{title}</h2>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{desc}</p>
      </div>
      {children}
    </section>
  )
}

/**
 * 市場頁：原本分散的數據看板（KPI、統計、明細）、數據分析、價格指數、市場供給，
 * 收成一頁、用錨點分段。維持一般整頁捲動（閱讀型頁面，好捲、好分享）。
 */
export default function MarketSections() {
  const { filters } = useGlobalFilters()
  const [active, setActive] = useState<string>('overview')

  // 從舊網址導過來（/market#trend 等）：內容是 client 端渲染，瀏覽器原生的錨點捲動會落空，補捲一次
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [])

  // 捲動時標示目前段落
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (top) setActive(top.target.id)
    }, { rootMargin: '-140px 0px -55% 0px' })
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [])

  const mode = filters.presale === 'true' ? 'presale' : filters.presale === 'false' ? 'existing' : 'all'

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))', paddingRight: 'max(20px, env(safe-area-inset-right, 0px))', paddingBottom: 40 }}>
      <div style={{ padding: '20px 0 4px' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>市場</h1>
      </div>

      <nav aria-label="市場頁段落" className="mk-anchors">
        {SECTIONS.map(s => (
          <a key={s.id} href={`#${s.id}`} data-on={active === s.id || undefined} aria-current={active === s.id ? 'location' : undefined}>{s.label}</a>
        ))}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, paddingTop: 12 }}>
        <Section {...sec('overview')}><MarketOverview /></Section>
        <Section {...sec('trend')}>
          <div style={{ margin: '0 -20px' }}>
            {/* key 跟著篩選列的期間／行政區／成預售：篩選列一改就用新條件重新起算 */}
            <AnalysisPanel key={`${filters.districts.join(',')}|${filters.dateFromYear}-${filters.dateFromMonth}|${filters.dateToYear}-${filters.dateToMonth}|${mode}`} initial={{
              districts: filters.districts,
              yearFrom: Number(filters.dateFromYear), monthFrom: Number(filters.dateFromMonth),
              yearTo: Number(filters.dateToYear), monthTo: Number(filters.dateToMonth),
              mode,
            }} />
          </div>
        </Section>
        <Section {...sec('index')}><div style={{ margin: '0 -20px' }}><PriceIndexPanel /></div></Section>
        <Section {...sec('supply')}><div style={{ margin: '0 -20px' }}><SupplyPanel /></div></Section>
      </div>

      <p style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--border-card)', fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', textAlign: 'center' }}>
        資料來源：內政部不動產交易實價查詢服務網・臺南市實價登錄大數據輔助區段地價平衡之研究・台南市不動產開發公會開放資料 ｜ 僅供參考，不構成投資建議
      </p>

      <style>{`
        .mk-anchors { position: sticky; top: calc(var(--nav-h) + var(--chips-h)); z-index: 1500; display: flex; gap: 4px;
          padding: 8px 0; margin: 0 -4px; background: var(--bg-app); border-bottom: 1px solid var(--border-card); overflow-x: auto; }
        .mk-anchors a { flex-shrink: 0; height: 30px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px;
          font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--text-muted); text-decoration: none; }
        .mk-anchors a:hover { color: var(--text-default); background: var(--surface-hover); }
        .mk-anchors a[data-on] { color: var(--accent-tint); background: var(--accent-wash); }
      `}</style>
    </div>
  )
}

function sec(id: (typeof SECTIONS)[number]['id']) {
  const s = SECTIONS.find(x => x.id === id)!
  return { id: s.id, title: s.label, desc: s.desc }
}

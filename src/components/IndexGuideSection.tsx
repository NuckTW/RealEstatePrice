'use client'

import { useMemo } from 'react'
import { computeIndex, partOf, presetById, type Catalog, type Village } from '@/lib/buyerIndex'
import { FIELD_GUIDE } from '@/lib/fieldGuide'
import { DIAGRAM_CSS, ExampleWaterfall, JourneyDiagram, RecipeHeatmap, StepsDiagram, ValidationDumbbell } from './IndexGuideDiagrams'

/**
 * 指數說明頁籤：以圖解說明三個客群指數＋新屋熱度怎麼算、每樣材料的資料來源，並附全站資料來源表
 * 文字原則：每段 3 句話內，重要事項才多寫
 * 範例村里（安平區國平里）的分數與全市分布以目前資料即時計算，不會因權重或資料更新而過時
 * v7（2026-10-12）：客群指數只看「住在這裡的人」；搬進來、新住宅入住移到新屋熱度；驗證改成跨期
 * 2026-10-14：圖改用 diagram-design 編輯式規範（泳道、流程、矩陣、瀑布、啞鈴圖，見 IndexGuideDiagrams.tsx）
 */

const GUIDE_CSS = `
  .ig-list { display: grid; gap: 0 28px; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); }
  .ig-field { display: grid; grid-template-columns: 11em 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .ig-field { grid-template-columns: 1fr; gap: 2px } }
`

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 16,
}
const h2: React.CSSProperties = { fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 4px' }
const h3: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)', margin: '18px 0 2px' }
const lead: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.7 }
const eyebrow: React.CSSProperties = { fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', margin: '14px 0 2px' }
const srcLink: React.CSSProperties = { color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: 2 }

/* ── 材料（指數組成）：說明、權重、來源 ─────────────────────────── */
type Seg = 'fb' | 'nh' | 'rs' | 'ht'
const SEG_NAME: Record<Seg, string> = { fb: '首購', nh: '換新屋', rs: '換二手', ht: '新屋熱度' }
interface Ingredient {
  key: string; name: string; text: string; weights: Partial<Record<Seg, number>>
  source: string; freq: string; url: string
}
const RIS_URL = 'https://www.ris.gov.tw/app/portal/346'
const PIP_URL = 'https://pip.moi.gov.tw/'
const INGREDIENTS: { group: string; items: Ingredient[] }[] = [
  { group: '客群材料：住在這裡的人', items: [
    {
      key: 'share', name: '年齡層占比', weights: { fb: 70, nh: 45 },
      text: '里內每 100 人有幾個是 25–34 歲（首購）或 35–44 歲（換新屋）。這是客群指數裡最重的一項，預測力也最好。',
      source: '內政部戶政司 村里人口（ODRP014）', freq: '每月', url: RIS_URL,
    },
    {
      key: 'income', name: '所得（購買力）', weights: { fb: 15, nh: 15, rs: 20 },
      text: '里內綜所稅申報戶（不是家戶）所得總額排正中間的金額，代表買不買得起，約晚 2–3 年公布。它和新屋成交關係不大、和二手成交較有關；客源分析另外會用它算房貸負擔。',
      source: '財政部財政資訊中心 綜合所得稅村里統計', freq: '每年', url: 'https://data.gov.tw/dataset/103066',
    },
    {
      key: 'marriage', name: '結婚', weights: { fb: 15 },
      text: '最近 12 個月每 1,000 人結婚對數。結婚常是第一次買房的契機，但和實際成交的關係比年齡結構弱，所以只占 15%。',
      source: '內政部戶政司 村里婚姻（ODRP060／ODRP010）', freq: '每月', url: RIS_URL,
    },
    {
      key: 'birth', name: '生小孩', weights: { nh: 40 },
      text: '最近 12 個月每 1,000 人出生數。家裡人變多，就想換大一點的新房子。',
      source: '內政部戶政司 村里出生（ODRP060／ODRP010）', freq: '每月', url: RIS_URL,
    },
    {
      key: 'head', name: '年輕戶長', weights: { rs: 35 },
      text: '每 100 戶有幾戶的戶長是 26–45 歲，也就是正在成家、換屋階段的家庭。它和「35–44 歲占比」幾乎是同一群人，所以只放在換二手。',
      source: '內政部不動產資訊平台 村里戶長年齡（E4041）', freq: '每季', url: PIP_URL,
    },
    {
      key: 'edu', name: '大學以上學歷', weights: { rs: 45 },
      text: '15 歲以上每 100 人有幾個大學以上畢業。二手屋交易熱的成熟市區這個比例通常高，是預測二手成交最準的一項。',
      source: '內政部戶政司 村里教育程度（ODRP020）', freq: '每年', url: RIS_URL,
    },
  ] },
  { group: '熱度材料：人往哪裡搬、新屋在哪交屋（多是買完房才遷戶籍的結果）', items: [
    {
      key: 'cohort', name: '搬進來（世代淨移入）', weights: { ht: 50 },
      text: '比較同一批人一年前後的人數：去年 25–34 歲 1,000 人，今年同一批人（26–35 歲）1,100 人，就是淨搬來 100 人（25–34 歲占 30%、35–44 歲占 20%）。台灣多半是買房交屋後才遷戶籍，所以這比較像「剛買完、搬進來」。',
      source: '內政部戶政司 村里單一年齡人口（ODRP014）', freq: '每月', url: RIS_URL,
    },
    {
      key: 'social', name: '淨流入', weights: { ht: 20 },
      text: '最近 12 個月所有年齡的遷入減遷出，含同一區跨里搬家。和「搬進來」一樣，多是交屋後遷入。',
      source: '內政部戶政司 村里遷徙（ODRP011）', freq: '每月', url: RIS_URL,
    },
    {
      key: 'dwellings', name: '新住宅入住', weights: { ht: 30 },
      text: '有人設戶籍的住宅數比一年前多了幾 %。數字高代表新大樓、新社區正在交屋入住，是供給面的訊號。',
      source: '內政部不動產資訊平台 村里宅數（E4041）', freq: '每季', url: PIP_URL,
    },
  ] },
]

/**
 * 驗證（v7，2026-10-12，scripts/validate_buyer_indices.py）：跨期——用 2021–2024 年 7 月的分數，
 * 預測之後 24 個月各區每千戶交易的排名相關；全 37 區 vs 都市 18 區（戶數前一半）。
 * 新屋＝預售＋屋齡 3 年內成屋；二手＝屋齡 5 年以上成屋。
 * 新屋熱度只用 2021、2022 兩個時點（不動產資訊平台 2022Q4–2023Q4 季資料缺，宅數成長算不出來）。
 * match＝這個指數該對應的交易；other＝另一種交易（越接近 0 代表越分得清新屋／二手客群）
 */
const VALIDATION: { seg: Seg; match: string; other: string; all: [number, number]; urban: [number, number] }[] = [
  { seg: 'fb', match: '新屋', other: '二手', all: [0.81, 0.64], urban: [0.59, 0.15] },
  { seg: 'nh', match: '新屋', other: '二手', all: [0.81, 0.64], urban: [0.70, -0.01] },
  { seg: 'rs', match: '二手', other: '新屋', all: [0.86, 0.71], urban: [0.82, 0.01] },
  { seg: 'ht', match: '新屋', other: '二手', all: [0.77, 0.46], urban: [0.77, -0.01] },
]
/** 指數名稱：客群三個叫「○○指數」，熱度本身就是名稱 */
const segTitle = (s: Seg) => (s === 'ht' ? SEG_NAME[s] : `${SEG_NAME[s]}指數`)

/** 全站資料來源（依頁籤） */
const SOURCES: { tab: string; items: { name: string; org: string; freq: string; url?: string }[] }[] = [
  { tab: '村里指數・自訂指數・客源分析', items: [
    { name: '村里人口、單一年齡、出生、結婚、離婚、遷入遷出', org: '內政部戶政司 戶政開放資料（ODRP014、ODRP060、ODRP010、ODRP011）', freq: '每月', url: RIS_URL },
    { name: '村里教育程度、戶數結構', org: '內政部戶政司 戶政開放資料（ODRP020、ODRP025）', freq: '每年', url: RIS_URL },
    { name: '戶長年齡、宅內人口數、宅內戶數、設籍宅數', org: '內政部不動產資訊平台 主題下載（E4041）', freq: '每季', url: PIP_URL },
    { name: '綜合所得稅所得中位數', org: '財政部財政資訊中心', freq: '每年（落後 2–3 年）', url: 'https://data.gov.tw/dataset/103066' },
    { name: '生活機能點位（學校、公園、超市、醫院等）', org: 'OpenStreetMap（© OpenStreetMap contributors）', freq: '不定期', url: 'https://www.openstreetmap.org/copyright' },
    { name: '村里界線', org: '內政部國土測繪中心 村(里)界', freq: '不定期', url: 'https://data.gov.tw/dataset/7438' },
    { name: '預售建案座標與成交（客源分析）', org: '內政部不動產交易實價查詢服務網', freq: '每月 1、11、21 日', url: 'https://plvr.land.moi.gov.tw/DownloadOpenData' },
  ] },
  { tab: '人口與家庭', items: [
    { name: '臺南市人口推估（高、中、低推估）', org: '臺南市政府（參考國發會人口推估）', freq: '不定期改版', url: 'https://data.gov.tw/dataset/134546' },
    { name: '國中小學生數、各校新生', org: '教育部統計處 各級學校基本資料', freq: '每學年', url: 'https://stats.moe.gov.tw/' },
  ] },
  { tab: '就業與產業', items: [
    { name: '工業及服務業普查（行政區從業員工、行業別）', org: '行政院主計總處 110 年普查', freq: '5 年一次', url: 'https://www.stat.gov.tw/' },
    { name: '行政區工商家數', org: '內政部社會經濟資料服務平台（SEGIS）', freq: '每年', url: 'https://segis.moi.gov.tw/' },
    { name: '南科從業員工', org: '國家科學及技術委員會 科學園區統計', freq: '每月', url: 'https://wsts.nstc.gov.tw/STSWeb/sciencepark/ScienceParkReport.aspx?language=C&quyid=tqemployees01' },
    { name: '南科產業別員工', org: '國家科學及技術委員會 開放資料', freq: '每年', url: 'https://mas.nstc.gov.tw/OPENDATA/GetFile?format=csv&serialno=398&fileodr=2' },
  ] },
  { tab: '房市與負擔', items: [
    { name: '房價所得比、貸款負擔率、五大銀行房貸利率', org: '內政部不動產資訊平台', freq: '每季／每月', url: PIP_URL },
    { name: '新增購屋貸款利率、成數、年限', org: '內政部不動產資訊平台', freq: '每季', url: PIP_URL },
    { name: '低度使用（用電）住宅', org: '內政部不動產資訊平台', freq: '每半年', url: PIP_URL },
    { name: '住宅屋齡（房屋稅籍）', org: '內政部不動產資訊平台 主題下載（E4041）', freq: '每季', url: PIP_URL },
    { name: '家庭收支（可支配所得、消費支出）', org: '行政院主計總處 家庭收支調查', freq: '每年', url: 'https://data.gov.tw/dataset/9415' },
    { name: '建物第一次移轉、建物買賣移轉', org: '臺南市政府資料開放平台', freq: '每月', url: 'https://data.tainan.gov.tw/' },
    { name: '住宅開工、使用執照', org: '臺南市政府工務局（資料開放平台）', freq: '每年／逐案', url: 'https://data.tainan.gov.tw/' },
    { name: '待售新成屋（新建餘屋）', org: '台南市不動產公會 開放資料', freq: '每季', url: 'https://tnh.org.tw/open_gov.asp' },
    { name: '實價登錄買賣、預售、租賃', org: '內政部不動產交易實價查詢服務網', freq: '每月 1、11、21 日', url: 'https://plvr.land.moi.gov.tw/DownloadOpenData' },
  ] },
  { tab: '重大建設', items: [
    { name: '捷運、鐵路、道路、產業園區、重劃區時程', org: '政府新聞稿與媒體報導（人工整理，各項附來源連結）', freq: '不定期' },
  ] },
]

export default function IndexGuideSection({ villages, catalog }: { villages: Village[]; catalog: Catalog }) {
  // 範例：安平區國平里（以目前資料即時計算首購指數拆解）；中位數、前 10% 門檻、最低分也即時計算
  const example = useMemo(() => {
    const codes = villages.map(v => v.code)
    const fb = presetById('firstBuyer')
    const res = computeIndex(fb, catalog, codes)
    const v = villages.find(x => x.district === '安平區' && x.village === '國平里') ?? villages[0]
    const sorted = [...res.scores.entries()].sort((a, b) => a[1] - b[1])
    const minV = villages.find(x => x.code === sorted[0]?.[0])
    // 總分是加權平均，分布會往中間擠：前 10% 的門檻通常只有 70 多分（不是 90 分）
    const p90 = sorted[Math.floor((sorted.length - 1) * 0.9)]?.[1] ?? null
    return {
      v, score: res.scores.get(v.code) ?? 0,
      parts: res.used.map(c => ({ c, p: partOf(res, c, v.code), share: c.weight / res.totalWeight })),
      median: sorted[Math.floor((sorted.length - 1) / 2)]?.[1] ?? null,
      p90,
      min: minV ? { name: `${minV.district}${minV.village}`, score: sorted[0][1] } : null,
    }
  }, [villages, catalog])
  const partLabel: Record<string, string> = { share2534: '年齡層占比', marriage: '結婚', income: '所得' }
  const first = example.parts[0]
  const firstInd = first ? catalog.byKey.get(first.c.key) : undefined
  const firstRaw = first ? example.v.raw[first.c.key as keyof Village['raw']] : null

  return (
    <div id="guide-top" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{GUIDE_CSS + DIAGRAM_CSS}</style>

      {/* 1. 客群 vs 熱度 */}
      <section style={cardStyle}>
        <h2 style={{ ...h2, fontSize: 'var(--text-xl)' }}>三個客群指數，外加一個新屋熱度</h2>
        <p style={lead}>
          分數 0 到 100 是跟全市 650 個里比的相對排名，不是買房的機率。
          客群指數看「還住在這裡、還沒買房的人」；新屋熱度看「剛買完、搬進來的人」，兩者量的是同一群人的不同階段。
        </p>
        <JourneyDiagram />
        <p style={{ ...lead, margin: '12px 0 0' }}>
          <b style={{ color: 'var(--text-strong)' }}>怎麼用：</b>找客源（派報、廣告、客源分析）看客群指數；看哪裡正熱（選址、推案時機）看新屋熱度。
          剛大量交屋的重劃區熱度很高，但住戶多半剛買完房，不一定是下一批客源。
        </p>
      </section>

      {/* 2. 食譜：每個指數放哪些材料 */}
      <section style={cardStyle}>
        <h2 style={h2}>每個指數放了哪些材料</h2>
        <p style={lead}>
          客群指數只用「住在這裡的人」的條件：首購看年輕人和結婚，換新屋看家庭和生小孩，換二手看年輕戶長和學歷，所得三個都有。
          搬進來、新住宅入住多半是「買完房才遷戶籍」的結果，集中放在新屋熱度。
        </p>
        <RecipeHeatmap />
      </section>

      {/* 3. 算一次給你看（即時計算） */}
      {first && (
        <section style={cardStyle}>
          <h2 style={h2}>算一次給你看：{example.v.district} {example.v.village}・首購指數</h2>
          <p style={lead}>人口 {(example.v.raw.pop ?? 0).toLocaleString()} 人；下面數字都依目前資料即時計算。</p>
          <div style={h3}>每一樣材料：量 → 排名 → 乘比重</div>
          <StepsDiagram village={example.v.village} rawLabel={firstInd?.label ?? first.c.key}
            rawValue={firstRaw != null ? `${firstRaw.toFixed(firstInd?.digits ?? 1)}${firstInd?.unit === '%' ? '%' : ` ${firstInd?.unit ?? ''}`}` : '—'}
            pct={first.p} weight={first.c.weight} />
          <div style={h3}>三樣加起來就是總分</div>
          <ExampleWaterfall title="首購指數" total={example.score} median={example.median} p90={example.p90}
            parts={example.parts.map(({ c, p, share }) => ({ label: partLabel[c.key] ?? c.key, pct: p, share, weight: c.weight }))} />
          <p style={{ ...lead, margin: '10px 0 0' }}>
            加完的總分會往中間擠：全市中間的里約 {example.median?.toFixed(1)} 分，{example.p90 != null && `前 10% 的里在 ${example.p90.toFixed(1)} 分以上`}
            {example.min && `，最低是${example.min.name} ${example.min.score.toFixed(1)} 分`}。
            所以總分 80 不等於贏過 80% 的里，要比就跟上面兩條參考線比。
          </p>
        </section>
      )}

      {/* 4. 材料與來源 */}
      <section style={cardStyle}>
        <h2 style={h2}>每樣材料是什麼、從哪裡來</h2>
        {INGREDIENTS.map(g => (
          <div key={g.group}>
            <div style={eyebrow}>{g.group}</div>
            <div className="ig-list">
              {g.items.map(it => (
                <div key={it.key} style={{ borderTop: '1px solid var(--border-card)', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{it.name}</span>
                    {(Object.entries(it.weights) as [Seg, number][]).map(([s, w]) => (
                      <span key={s} style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-muted)', border: '1px solid var(--border-control)', borderRadius: 4, padding: '0 6px', whiteSpace: 'nowrap' }}>
                        {SEG_NAME[s]} <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{w}%</b>
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)', lineHeight: 1.7 }}>{it.text}</div>
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                    來源：<a href={it.url} target="_blank" rel="noopener noreferrer" style={srcLink}>{it.source}</a>｜{it.freq}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* 5. 小規則 */}
      <section style={cardStyle}>
        <h2 style={h2}>幾個小規則</h2>
        <div className="ig-list" style={{ marginTop: 6 }}>
          {[
            { t: '只看最近 12 個月', d: '人口、婚育、遷徙都取最近 12 個月，每月自動更新。' },
            { t: '小里不靠運氣', d: '小里多 2 對結婚就會暴衝，所以結婚、出生會往同區平均拉一點，里越小拉越多。' },
            { t: '沒資料就給 50 分', d: '例如新設的里沒有去年人口，那一項給中間分，不加分也不扣分。' },
          ].map(r => (
            <div key={r.t} style={{ borderTop: '1px solid var(--border-card)', padding: '10px 0' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{r.t}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>{r.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. 準不準 */}
      <section style={cardStyle}>
        <h2 style={h2}>準不準？</h2>
        <p style={lead}>
          用 2021–2024 年的分數，預測「之後 24 個月」各區每千戶的新屋（預售＋屋齡 3 年內）與二手（屋齡 5 年以上）交易，比排名。
          實心點越靠右越準；空心點（另一種交易）越靠近 0，代表越分得清新屋客和二手客。
        </p>
        <ValidationDumbbell rows={VALIDATION.map(v => ({ name: segTitle(v.seg), match: v.match, other: v.other, matchR: v.urban[0], otherR: v.urban[1] }))} />
        <p style={{ ...lead, margin: '12px 0 0', fontSize: 'var(--text-xs)' }}>
          圖是都市 18 區（戶數前一半）；全 37 區的對應相關是 {VALIDATION.map(v => `${SEG_NAME[v.seg]} ${v.all[0].toFixed(2)}`).join('、')}，但有城鄉差距撐腰，看不出真正的鑑別力。
          這是區的平均，不代表區內每個里都一樣準；客群指數量的是「住在這裡的人」，交易卻發生在「房子蓋在哪裡」，所以只能間接驗證，預售還受建商推案位置影響。
          新屋熱度只用 2021、2022 兩年驗證（2022 年底到 2023 年的村里季資料缺）。
        </p>
      </section>

      {/* 7. 不計分 */}
      <section id="field-guide" style={cardStyle}>
        <h2 style={h2}>看得到、但不算分的</h2>
        <p style={lead}>
          這些跟已經在算的材料太像，或跟實際交易沒有正向關係（老屋多、高齡戶長多的里多在偏鄉、交易少）。點村里後明細下半部就是這些數字，點欄位名稱也能看到同樣的說明。
          家戶結構裡的 26–45 歲戶長、大學以上學歷、設籍宅數年增有計分，列在這裡方便對照，說明裡有寫計入哪個指數。
        </p>
        {FIELD_GUIDE.map(g => (
          <div key={g.title} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>
              {g.title}<span style={{ fontWeight: 400, color: 'var(--text-faint)', marginLeft: 8, fontSize: 'var(--text-xs)' }}>{g.period}</span>
            </div>
            {g.items.map(it => (
              <div key={it.key} className="ig-field" style={{ padding: '8px 0', borderTop: '1px solid var(--border-card)', fontSize: 'var(--text-xs)', lineHeight: 1.7 }}>
                <div>
                  <b style={{ color: 'var(--text-strong)' }}>{it.label}</b>
                  <div style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{it.unit}</div>
                </div>
                <div style={{ color: 'var(--text-default)' }}>{it.how}</div>
                <div style={{ color: 'var(--text-muted)' }}>{it.read}</div>
              </div>
            ))}
          </div>
        ))}
        <p style={{ ...lead, margin: 0 }}>其他頁籤也有不算分的資料：南科員工（就業與產業）、開工與使照（房市與負擔）、重大建設。</p>
      </section>

      {/* 8. 全部資料來源 */}
      <section style={cardStyle}>
        <h2 style={h2}>全部資料來源</h2>
        <p style={lead}>本頁所有資料都來自政府開放資料或開放授權資料，點名稱可前往來源。</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SOURCES.map(g => (
            <div key={g.tab}>
              <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', marginBottom: 4 }}>{g.tab}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
                  <tbody>
                    {g.items.map(it => (
                      <tr key={it.name} style={{ borderBottom: '1px solid var(--border-card)' }}>
                        <td style={{ padding: '6px 8px', width: '38%', color: 'var(--text-strong)' }}>{it.name}</td>
                        <td style={{ padding: '6px 8px' }}>
                          {it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer" style={srcLink}>{it.org}</a> : it.org}
                        </td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: 'var(--text-muted)', textAlign: 'right' }}>{it.freq}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

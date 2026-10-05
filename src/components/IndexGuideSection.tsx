'use client'

import { useMemo } from 'react'
import { computeIndex, partOf, PRESET_INDICES, type Catalog, type Village } from '@/lib/buyerIndex'
import { FIELD_GUIDE } from '@/lib/fieldGuide'

/**
 * 指數說明頁籤：以圖解說明三個購屋指數怎麼算、每樣材料的資料來源，並附全站資料來源表
 * 文字原則：每段 3 句話內，重要事項才多寫
 * 範例村里（安平區國平里）的分數以目前資料即時計算，不會因權重或資料更新而過時
 */

/* ── 顏色：首購＝青綠、換新屋＝靛藍、換二手＝梅紫、所得＝站內 accent（暗色為預設，亮色另設） ── */
const GUIDE_CSS = `
  :root { --ig-fb: #4fbfae; --ig-nh: #9ea2f0; --ig-rs: #e09ccb; --ig-fb-soft: rgba(79,191,174,.16); --ig-nh-soft: rgba(158,162,240,.16); --ig-rs-soft: rgba(224,156,203,.16); }
  :root[data-theme="light"] { --ig-fb: #1f7a6e; --ig-nh: #4a4fa3; --ig-rs: #8a3f74; --ig-fb-soft: #d6ebe7; --ig-nh-soft: #dfe0f3; --ig-rs-soft: #f1dfeb; }
  .ig-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); }
  .ig-row { display: grid; grid-template-columns: 8em 1fr 9em; gap: 12px; align-items: center; }
  .ig-field { display: grid; grid-template-columns: 11em 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .ig-row { grid-template-columns: 1fr; gap: 4px } .ig-row .ig-math { text-align: left !important } .ig-field { grid-template-columns: 1fr; gap: 2px } }
`
type Seg = 'fb' | 'nh' | 'rs'
const SEG_COLOR: Record<Seg, string> = { fb: 'var(--ig-fb)', nh: 'var(--ig-nh)', rs: 'var(--ig-rs)' }
const SEG_SOFT: Record<Seg, string> = { fb: 'var(--ig-fb-soft)', nh: 'var(--ig-nh-soft)', rs: 'var(--ig-rs-soft)' }
const SEG_NAME: Record<Seg, string> = { fb: '首購', nh: '換新屋', rs: '換二手' }

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 16,
}
const h2: React.CSSProperties = { fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 4px' }
const lead: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.7 }
const srcLink: React.CSSProperties = { color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: 2 }

/* ── 材料（指數組成）：圖示、說明、權重、來源 ─────────────────── */
interface Ingredient {
  key: string; name: string; text: string; weights: Partial<Record<Seg, number>>
  source: string; freq: string; url: string; icon: React.ReactNode
}
const RIS_URL = 'https://www.ris.gov.tw/app/portal/346'
const PIP_URL = 'https://pip.moi.gov.tw/'
const INGREDIENTS: Ingredient[] = [
  {
    key: 'cohort', name: '搬進來（世代淨移入）', weights: { fb: 30, nh: 20, rs: 10 },
    text: '比較同一批人一年前後的人數：去年 25–34 歲 1,000 人，今年同一批人（26–35 歲）1,100 人，就是多搬來 100 人。換屋看 35–44 歲。',
    source: '內政部戶政司 村里單一年齡人口（ODRP014）', freq: '每月', url: RIS_URL,
    icon: <svg viewBox="0 0 44 44"><rect x="4" y="18" width="20" height="20" rx="3" fill="var(--ig-fb-soft)" /><path d="M4 20 14 10 24 20" fill="none" stroke="var(--ig-fb)" strokeWidth="3" strokeLinejoin="round" /><circle cx="36" cy="16" r="5" fill="var(--accent)" /><path d="M36 22v10M30 28l-4-2" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" /></svg>,
  },
  {
    key: 'share', name: '年齡層多不多', weights: { fb: 25, nh: 20, rs: 20 },
    text: '里內每 100 人有幾個是 25–34 歲（首購）或 35–44 歲（換屋）。',
    source: '內政部戶政司 村里人口（ODRP014）', freq: '每月', url: RIS_URL,
    icon: <svg viewBox="0 0 44 44"><circle cx="10" cy="14" r="5" fill="var(--border-control)" /><circle cx="22" cy="14" r="5" fill="var(--ig-fb)" /><circle cx="34" cy="14" r="5" fill="var(--border-control)" /><path d="M4 36c0-6 3-10 6-10s6 4 6 10M28 36c0-6 3-10 6-10s6 4 6 10" fill="none" strokeWidth="3" stroke="var(--border-control)" /><path d="M16 36c0-6 3-10 6-10s6 4 6 10" fill="none" strokeWidth="3" stroke="var(--ig-fb)" /></svg>,
  },
  {
    key: 'income', name: '所得（購買力）', weights: { fb: 25, nh: 20, rs: 30 },
    text: '里內報稅家戶所得排正中間那一戶的金額，代表買不買得起。政府約晚 2–3 年公布。',
    source: '財政部財政資訊中心 綜合所得稅村里統計', freq: '每年', url: 'https://data.gov.tw/dataset/103066',
    icon: <svg viewBox="0 0 44 44"><ellipse cx="22" cy="34" rx="14" ry="5" fill="none" stroke="var(--accent)" strokeWidth="3" /><ellipse cx="22" cy="25" rx="14" ry="5" fill="none" stroke="var(--accent)" strokeWidth="3" /><ellipse cx="22" cy="16" rx="14" ry="5" fill="var(--accent)" /></svg>,
  },
  {
    key: 'marriage', name: '結婚', weights: { fb: 10 },
    text: '最近 12 個月每 1,000 人結婚對數。它和實際預售成交的關係最弱，所以只占 10%。',
    source: '內政部戶政司 村里婚姻（ODRP060／ODRP010）', freq: '每月', url: RIS_URL,
    icon: <svg viewBox="0 0 44 44"><circle cx="16" cy="24" r="10" fill="none" stroke="var(--ig-fb)" strokeWidth="3.5" /><circle cx="28" cy="24" r="10" fill="none" stroke="var(--accent)" strokeWidth="3.5" /></svg>,
  },
  {
    key: 'birth', name: '生小孩', weights: { nh: 20 },
    text: '最近 12 個月每 1,000 人出生數。家裡人變多，就想換大一點的新房子。',
    source: '內政部戶政司 村里出生（ODRP060／ODRP010）', freq: '每月', url: RIS_URL,
    icon: <svg viewBox="0 0 44 44"><circle cx="22" cy="16" r="8" fill="var(--ig-nh-soft)" stroke="var(--ig-nh)" strokeWidth="3" /><path d="M10 38c0-7 5-12 12-12s12 5 12 12" fill="var(--ig-nh-soft)" stroke="var(--ig-nh)" strokeWidth="3" /></svg>,
  },
  {
    key: 'dwellings', name: '新住宅入住', weights: { nh: 20 },
    text: '有人設戶籍的住宅數比一年前多了幾 %。數字高代表新大樓、新社區正在交屋入住。',
    source: '內政部不動產資訊平台 村里宅數（E4041）', freq: '每季', url: PIP_URL,
    icon: <svg viewBox="0 0 44 44"><rect x="6" y="20" width="14" height="18" rx="2" fill="var(--ig-nh-soft)" stroke="var(--ig-nh)" strokeWidth="2.5" /><rect x="24" y="10" width="14" height="28" rx="2" fill="var(--ig-nh)" /><path d="M28 16h6M28 22h6M28 28h6" stroke="var(--surface-card)" strokeWidth="2" /></svg>,
  },
  {
    key: 'head', name: '年輕戶長', weights: { rs: 20 },
    text: '每 100 戶有幾戶的戶長是 26–45 歲，也就是正在成家、換屋階段的家庭。',
    source: '內政部不動產資訊平台 村里戶長年齡（E4041）', freq: '每季', url: PIP_URL,
    icon: <svg viewBox="0 0 44 44"><path d="M6 22 22 8l16 14" fill="none" stroke="var(--ig-rs)" strokeWidth="3" strokeLinejoin="round" /><rect x="11" y="20" width="22" height="18" rx="2" fill="var(--ig-rs-soft)" /><circle cx="22" cy="27" r="4" fill="var(--ig-rs)" /><path d="M15 38c0-4 3-6 7-6s7 2 7 6" fill="var(--ig-rs)" /></svg>,
  },
  {
    key: 'edu', name: '大學以上學歷', weights: { rs: 20 },
    text: '15 歲以上每 100 人有幾個大學以上畢業。二手屋交易熱的成熟市區，這個比例通常高。',
    source: '內政部戶政司 村里教育程度（ODRP020）', freq: '每年', url: RIS_URL,
    icon: <svg viewBox="0 0 44 44"><path d="M4 18 22 10l18 8-18 8z" fill="var(--ig-rs)" /><path d="M12 22v9c0 3 5 5 10 5s10-2 10-5v-9" fill="none" stroke="var(--ig-rs)" strokeWidth="3" /></svg>,
  },
  {
    key: 'social', name: '淨流入', weights: { fb: 10 },
    text: '最近 12 個月所有年齡的遷入減遷出，含同一區跨里搬家。',
    source: '內政部戶政司 村里遷徙（ODRP011）', freq: '每月', url: RIS_URL,
    icon: <svg viewBox="0 0 44 44"><path d="M6 16h24l-6-6" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" stroke="var(--ig-fb)" /><path d="M38 28H14l6 6" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" stroke="var(--border-control)" /></svg>,
  },
]

/** 食譜長條：與 PRESET_INDICES 一致（標籤用口語） */
const RECIPES: { seg: Seg; who: string; parts: { label: string; w: number; income?: boolean }[] }[] = [
  { seg: 'fb', who: '25–34 歲年輕人，第一次買房', parts: [
    { label: '年輕人搬進來', w: 30 }, { label: '年輕人多不多', w: 25 }, { label: '結婚', w: 10 }, { label: '所得', w: 25, income: true }, { label: '淨流入', w: 10 }] },
  { seg: 'nh', who: '35–44 歲家庭，換預售屋或新成屋', parts: [
    { label: '家庭搬進來', w: 20 }, { label: '家庭多不多', w: 20 }, { label: '生小孩', w: 20 }, { label: '所得', w: 20, income: true }, { label: '新住宅入住', w: 20 }] },
  { seg: 'rs', who: '35–44 歲家庭，在成熟市區換二手屋', parts: [
    { label: '搬進來', w: 10 }, { label: '家庭多不多', w: 20 }, { label: '年輕戶長', w: 20 }, { label: '所得', w: 30, income: true }, { label: '大學以上', w: 20 }] },
]

/** 驗證（2026-10，37 區排名相關） */
const VALIDATION: { seg: Seg; rows: [string, number][]; note: string }[] = [
  { seg: 'fb', rows: [['預售成交', 0.57], ['新屋交屋', 0.90]], note: '近 24 月預售成交、近 12 月新屋交屋（每千戶）' },
  { seg: 'nh', rows: [['新屋交易', 0.79], ['二手交易', 0.59]], note: '新屋＝預售＋屋齡 3 年內成屋（近 24 月、每千戶）' },
  { seg: 'rs', rows: [['二手交易', 0.80], ['新屋交易', 0.62]], note: '二手＝屋齡 5 年以上成屋（近 24 月、每千戶）' },
]

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
  // 範例：安平區國平里（以目前資料即時計算首購指數拆解）；中位數、最低分也即時計算
  const example = useMemo(() => {
    const codes = villages.map(v => v.code)
    const fb = PRESET_INDICES[0]
    const res = computeIndex(fb, catalog, codes)
    const v = villages.find(x => x.district === '安平區' && x.village === '國平里') ?? villages[0]
    const sorted = [...res.scores.entries()].sort((a, b) => a[1] - b[1])
    const minV = villages.find(x => x.code === sorted[0]?.[0])
    return {
      v, score: res.scores.get(v.code) ?? 0,
      parts: fb.components.map(c => ({ c, p: partOf(res, c, v.code) })),
      median: sorted[Math.floor((sorted.length - 1) / 2)]?.[1] ?? null,
      min: minV ? { name: `${minV.district}${minV.village}`, score: sorted[0][1] } : null,
    }
  }, [villages, catalog])
  const partLabel: Record<string, string> = { cohortYoung: '年輕人搬進來', share2534: '年輕人多不多', marriage: '結婚', income: '所得（購買力）', social: '淨流入' }

  return (
    <div id="guide-top" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{GUIDE_CSS}</style>

      {/* 1. 三張成績單 */}
      <section style={cardStyle}>
        <h2 style={{ ...h2, fontSize: 'var(--text-xl)' }}>每個里都有三張「想買房」成績單</h2>
        <p style={lead}>分數 0 到 100，越高代表這個里最近越多人可能要買房。</p>
        <div className="ig-grid">
          {RECIPES.map(r => (
            <div key={r.seg} style={{ background: SEG_SOFT[r.seg], borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <Persona seg={r.seg} />
              <div>
                <div style={{ fontWeight: 700, color: SEG_COLOR[r.seg], fontSize: 'var(--text-base)' }}>{SEG_NAME[r.seg]}指數</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>{r.who}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. 三步驟 */}
      <section style={cardStyle}>
        <h2 style={h2}>三個步驟算出分數</h2>
        <div className="ig-grid" style={{ marginTop: 10 }}>
          <Step n={1} title="量幾樣東西" text="每個里量：多少人搬進來、結婚生小孩、賺多少錢、學歷、新住宅。">
            <svg viewBox="0 0 200 64" style={{ width: '100%', height: 64 }}>
              {(['fb', 'nh', 'rs'] as Seg[]).map((s, i) => (
                <g key={s} transform={`translate(${10 + i * 66},6)`}>
                  <rect width="44" height="52" rx="6" fill={SEG_SOFT[s]} />
                  {[14, 24, 34].map((y, k) => <rect key={k} x="10" y={y} width={[22, 16, 20][(k + i) % 3]} height="4" rx="2" fill={SEG_COLOR[s]} />)}
                </g>
              ))}
            </svg>
          </Step>
          <Step n={2} title="全市排排站" text="每一樣把 650 個里排名次換成 0–100 分，贏過 83% 的里就是 83 分。">
            <svg viewBox="0 0 200 64" style={{ width: '100%', height: 64 }}>
              {[14, 22, 30, 38, 48, 56].map((h, i) => (
                <rect key={i} x={14 + i * 30} y={62 - h} width="22" height={h} rx="3" fill={i === 4 ? 'var(--accent)' : 'var(--border-control)'} />
              ))}
              <text x="145" y="10" fontSize="11" textAnchor="middle" fill="var(--accent)" fontFamily="var(--font-mono)" fontWeight="700">83</text>
            </svg>
          </Step>
          <Step n={3} title="照比重加起來" text="像學校算總成績，重要的科目比重大，加完就是那個里的分數。">
            <svg viewBox="0 0 200 64" style={{ width: '100%', height: 64 }}>
              <rect x="10" y="20" width="54" height="24" rx="5" fill="var(--ig-fb)" />
              <rect x="66" y="20" width="44" height="24" rx="5" fill="var(--ig-fb)" opacity=".7" />
              <rect x="112" y="20" width="44" height="24" rx="5" fill="var(--accent)" />
              <rect x="158" y="20" width="10" height="24" rx="5" fill="var(--ig-fb)" opacity=".45" />
              <text x="186" y="38" fontSize="18" textAnchor="middle" fill="var(--text-strong)" fontFamily="var(--font-mono)" fontWeight="700">=</text>
            </svg>
          </Step>
        </div>
      </section>

      {/* 3. 三份食譜 */}
      <section style={cardStyle}>
        <h2 style={h2}>三份「食譜」：每樣材料放多少</h2>
        <p style={lead}>換新屋看生小孩和新住宅入住，換二手看年輕戶長和學歷，兩者各自對應新屋和二手市場。</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {RECIPES.map(r => (
            <div key={r.seg}>
              <div style={{ fontWeight: 700, color: SEG_COLOR[r.seg], marginBottom: 6, fontSize: 'var(--text-sm)' }}>{SEG_NAME[r.seg]}指數</div>
              <div role="img" aria-label={`${SEG_NAME[r.seg]}指數：${r.parts.map(p => `${p.label} ${p.w}%`).join('、')}`}
                style={{ display: 'flex', height: 56, borderRadius: 'var(--radius-md)', overflow: 'hidden', gap: 3 }}>
                {r.parts.map((p, i) => (
                  <div key={p.label} style={{
                    flex: p.w, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 4px',
                    background: p.income ? 'var(--accent)' : SEG_COLOR[r.seg], opacity: p.income ? 1 : 1 - i * 0.14,
                    color: p.income ? 'var(--on-accent)' : 'var(--bg-app)', lineHeight: 1.2, textAlign: 'center',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{p.w}%</span>
                    <span style={{ fontSize: 'var(--text-3xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. 材料與來源 */}
      <section style={cardStyle}>
        <h2 style={h2}>每樣材料是什麼、從哪裡來</h2>
        <div className="ig-grid" style={{ marginTop: 10 }}>
          {INGREDIENTS.map(it => (
            <div key={it.key} style={{ background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 40, height: 40, flex: 'none', display: 'block' }} aria-hidden="true">{it.icon}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{it.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.entries(it.weights) as [Seg, number][]).map(([s, w]) => (
                  <span key={s} style={{ fontSize: 'var(--text-3xs)', fontWeight: 700, padding: '1px 8px', borderRadius: 'var(--radius-full)', background: SEG_SOFT[s], color: SEG_COLOR[s] }}>{SEG_NAME[s]} {w}%</span>
                ))}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)', lineHeight: 1.7 }}>{it.text}</div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-card)', paddingTop: 6, marginTop: 'auto' }}>
                來源：<a href={it.url} target="_blank" rel="noopener noreferrer" style={srcLink}>{it.source}</a>｜{it.freq}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. 算一次給你看（即時計算） */}
      <section style={cardStyle}>
        <h2 style={h2}>算一次給你看：{example.v.district} {example.v.village}・首購指數</h2>
        <p style={lead}>人口 {(example.v.raw.pop ?? 0).toLocaleString()} 人；下面數字依目前資料即時計算。</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {example.parts.map(({ c, p }) => (
            <div key={c.key} className="ig-row">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>{partLabel[c.key] ?? c.key}</span>
              <div style={{ height: 12, borderRadius: 'var(--radius-full)', background: 'var(--ig-fb-soft)', overflow: 'hidden' }}>
                <div style={{ width: `${p}%`, height: '100%', borderRadius: 'var(--radius-full)', background: c.key === 'income' ? 'var(--accent)' : 'var(--ig-fb)' }} />
              </div>
              <span className="ig-math" style={{ fontSize: 'var(--text-xs)', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {p.toFixed(1)} × {c.weight}% = <b style={{ color: 'var(--text-strong)' }}>{(p * c.weight / 100).toFixed(1)}</b>
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px solid var(--text-strong)', marginTop: 12, paddingTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            全市中間的里約 {example.median?.toFixed(1)} 分{example.min && `；最低是${example.min.name} ${example.min.score.toFixed(1)} 分`}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-3xl)', color: 'var(--ig-fb)', lineHeight: 1 }}>{example.score.toFixed(1)}</span>
        </div>
      </section>

      {/* 6. 小規則 */}
      <section style={cardStyle}>
        <h2 style={h2}>幾個小規則</h2>
        <div className="ig-grid" style={{ marginTop: 10 }}>
          <Rule title="只看最近 12 個月" text="人口、婚育、遷徙都取最近 12 個月，每月自動更新。">
            <svg viewBox="0 0 40 40"><rect x="4" y="8" width="32" height="28" rx="4" fill="var(--ig-fb-soft)" /><rect x="4" y="8" width="32" height="8" rx="4" fill="var(--ig-fb)" /><text x="20" y="31" fontSize="12" textAnchor="middle" fill="var(--ig-fb)" fontFamily="var(--font-mono)" fontWeight="700">12</text></svg>
          </Rule>
          <Rule title="小里不靠運氣" text="小里多 2 對結婚就會暴衝，所以結婚、出生會往同區平均拉一點，里越小拉越多。">
            <svg viewBox="0 0 40 40"><circle cx="10" cy="20" r="5" fill="var(--accent)" /><circle cx="30" cy="20" r="11" fill="var(--ig-fb-soft)" stroke="var(--ig-fb)" strokeWidth="2.5" /><path d="M16 20h6" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </Rule>
          <Rule title="沒資料就給 50 分" text="例如新設的里沒有去年人口，那一項給中間分，不加分也不扣分。">
            <svg viewBox="0 0 40 40"><rect x="4" y="12" width="32" height="16" rx="8" fill="var(--border-control)" /><text x="20" y="24.5" fontSize="11" textAnchor="middle" fill="var(--text-strong)" fontFamily="var(--font-mono)" fontWeight="700">50</text></svg>
          </Rule>
        </div>
      </section>

      {/* 7. 準不準 */}
      <section style={cardStyle}>
        <h2 style={h2}>準不準？</h2>
        <p style={lead}>把各里分數平均到 37 區，和實際交易量比排名，1 代表排名完全一樣。每個指數都和它該對應的交易比。</p>
        <div className="ig-grid">
          {VALIDATION.map(v => (
            <div key={v.seg} style={{ background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontWeight: 700, color: SEG_COLOR[v.seg] }}>{SEG_NAME[v.seg]}指數</span>
              {v.rows.map(([k, r], i) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '4.5em 1fr 2.6em', gap: 8, alignItems: 'center', fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: i === 0 ? 'var(--text-strong)' : 'var(--text-muted)' }}>{k}</span>
                  <div style={{ height: 10, borderRadius: 'var(--radius-full)', background: SEG_SOFT[v.seg], overflow: 'hidden' }}>
                    <div style={{ width: `${r * 100}%`, height: '100%', background: SEG_COLOR[v.seg], opacity: i === 0 ? 1 : 0.5, borderRadius: 'var(--radius-full)' }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-strong)' }}>{r.toFixed(2)}</span>
                </div>
              ))}
              <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>{v.note}</span>
            </div>
          ))}
        </div>
        <p style={{ ...lead, margin: '12px 0 0', fontSize: 'var(--text-xs)' }}>
          驗證資料：實價登錄（2026-10 分析）。預售成交還受建商在哪裡推案影響，人口數字看不到這部分。
        </p>
      </section>

      {/* 8. 不計分 */}
      <section id="field-guide" style={cardStyle}>
        <h2 style={h2}>看得到、但不算分的</h2>
        <p style={lead}>這些跟已經在算的材料太像，或跟實際交易沒有正向關係（老屋多、高齡戶長多的里多在偏鄉、交易少）。點村里後明細下半部就是這些數字，點欄位名稱也能看到同樣的說明。</p>
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

      {/* 9. 全部資料來源 */}
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

/* ── 小元件 ───────────────────────────────────────────────────── */
function Persona({ seg }: { seg: Seg }) {
  const c = SEG_COLOR[seg]
  return (
    <svg viewBox="0 0 48 48" style={{ width: 44, height: 44, flex: 'none' }} aria-hidden="true">
      {seg === 'fb' && <><circle cx="24" cy="15" r="7" fill={c} /><path d="M12 40c0-8 5-13 12-13s12 5 12 13" fill={c} /><path d="M36 10l4-4M38 16h5" stroke={c} strokeWidth="2.5" strokeLinecap="round" /></>}
      {seg === 'nh' && <><path d="M6 24 24 8l18 16" fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" /><rect x="12" y="22" width="24" height="18" rx="2" fill={c} /><path d="M38 6l1.5 3 3 1.5-3 1.5L38 15l-1.5-3-3-1.5 3-1.5z" fill="var(--accent)" /></>}
      {seg === 'rs' && <><path d="M6 24 24 8l18 16" fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" /><rect x="12" y="22" width="24" height="18" rx="2" fill="none" stroke={c} strokeWidth="3" /><rect x="20" y="30" width="8" height="10" fill={c} /><path d="M16 16v-6h4" fill="none" stroke={c} strokeWidth="2.5" /></>}
    </svg>
  )
}
function Step({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-sunken)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 'var(--text-xs)' }}>步驟 {n}</span>
      <div aria-hidden="true">{children}</div>
      <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{title}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>{text}</span>
    </div>
  )
}
function Rule({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ width: 40, height: 40, flex: 'none', display: 'block' }} aria-hidden="true">{children}</span>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>{text}</div>
      </div>
    </div>
  )
}

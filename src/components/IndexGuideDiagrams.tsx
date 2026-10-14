'use client'

/**
 * 指數說明頁的圖（依 diagram-design 編輯式圖解規範：https://github.com/cathrynlavery/diagram-design）
 *  - 一張圖只有 1–2 個重點色（brass accent），其餘只用 ink／muted 的深淺；不用陰影、不用彩虹配色
 *  - 連接線一律直角轉彎（圓角 r=8），箭頭畫在方塊之前；圖例放底部橫條
 *  - 幾何座標對齊 4px 格線；中文字最小 12px
 *  - SVG 以 viewBox 原寸顯示（寬度跟著站內字級縮放），窄螢幕在圖框內左右捲動，不把字縮小
 * 色彩 token（--dg-*）定義在 DIAGRAM_CSS，暗色為預設、亮色另設
 */
import { PRESET_INDICES } from '@/lib/buyerIndex'

export const DIAGRAM_CSS = `
  :root {
    --dg-paper: var(--surface-card); --dg-ink: var(--text-strong); --dg-muted: var(--text-muted); --dg-faint: var(--text-faint);
    --dg-rule: rgba(246,241,232,0.10); --dg-axis: rgba(246,241,232,0.22); --dg-conn: rgba(246,241,232,0.40);
    --dg-accent: var(--brass-500); --dg-accent-text: var(--brass-400); --dg-accent-tint: rgba(217,145,42,0.14);
  }
  :root[data-theme="light"] {
    --dg-rule: rgba(42,31,16,0.10); --dg-axis: rgba(42,31,16,0.25); --dg-conn: rgba(42,31,16,0.55);
    --dg-accent: var(--brass-600); --dg-accent-text: var(--brass-700); --dg-accent-tint: rgba(217,145,42,0.14);
  }
  .dg-fig { width: 100%; overflow-x: auto; margin: 4px 0 0; }
  .dg-fig svg { display: block; height: auto; max-width: none; margin: 0 auto; }
  .dg-hint { display: none; font-size: var(--text-3xs); color: var(--text-faint); text-align: center; margin-top: 4px; }
  @media (max-width: 760px) { .dg-hint { display: block } }
  @media print { .dg-fig { overflow-x: visible } .dg-fig svg { width: 100% !important } }
`

/* ── 共用：字型、外框 ─────────────────────────────────────────── */
const SANS = 'var(--font-sans)'
const MONO = 'var(--font-mono)'

/** 圖框：原寸（× 站內字級）顯示、窄螢幕在框內捲動；附無障礙 title／desc 與箭頭 marker */
function Figure({ id, w, h, title, desc, children }: {
  id: string; w: number; h: number; title: string; desc: string; children: React.ReactNode
}) {
  return (
    <>
      <div className="dg-fig">
        <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}
          style={{ width: `calc(${w}px * var(--font-scale))`, fontFamily: SANS }}>
          <title id={`${id}-title`}>{title}</title>
          <desc id={`${id}-desc`}>{desc}</desc>
          <defs>
            <marker id={`${id}-arrow`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--dg-muted)" />
            </marker>
            <marker id={`${id}-arrow-accent`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--dg-accent)" />
            </marker>
          </defs>
          {children}
        </svg>
      </div>
      <div className="dg-hint">← 圖可左右滑動 →</div>
    </>
  )
}

/** 方塊：先鋪一層紙色遮罩（避免線條透出），再畫外框 */
function Box({ x, y, w, h, focal }: { x: number; y: number; w: number; h: number; focal?: boolean }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="6" fill="var(--dg-paper)" />
      <rect x={x} y={y} width={w} height={h} rx="6"
        fill={focal ? 'var(--dg-accent-tint)' : 'var(--dg-paper)'}
        stroke={focal ? 'var(--dg-accent)' : 'var(--dg-axis)'} strokeWidth={focal ? 1.2 : 1} />
    </>
  )
}

/* ── A. 泳道圖：客群 vs 新屋熱度（為什麼搬進來的人不算客源） ─────────── */
/**
 * 兩條泳道＝兩個地方：原本住的里（客群指數量這裡）、新建案所在的里（新屋熱度量這裡）
 * 四個時間點：今天 → 簽約 → 施工 2–3 年 → 交屋後；跨泳道的那一步（買在新建案）是重點
 */
export function JourneyDiagram() {
  const W = 960, H = 300
  const col = [176, 368, 560, 752]           // 四欄方塊左緣（寬 160、間距 32）
  const NW = 160, NH = 56
  const lane = [{ y: 56, h: 96 }, { y: 152, h: 96 }]
  const ny = (l: number) => lane[l].y + 20  // 方塊在泳道內的上緣
  const nodes = [
    { l: 0, c: 0, name: '住在這裡的 25–34 歲', sub: '客群指數看得到' },
    { l: 0, c: 1, name: '看屋、簽約預售', sub: '人還住在原本的里' },
    { l: 1, c: 2, name: '建案施工中', sub: '2–3 年，戶籍還沒動' },
    { l: 1, c: 3, name: '交屋、遷入設籍', sub: '淨移入↑　宅數↑', focal: true },
  ]
  const times = ['今天', '簽約', '施工 2–3 年', '交屋後']
  const y1 = ny(0) + NH / 2, y2 = ny(1) + NH / 2
  // 跨泳道：從簽約方塊右緣出發，往右到施工方塊上方再往下（直角＋圓角 r=8）
  const hx = col[2] + 40
  return (
    <Figure id="ig-journey" w={W} h={H}
      title="客群指數與新屋熱度量的是不同階段"
      desc="一位 25–34 歲的人住在原本的里時會算進客群指數；簽約買新建案、等 2–3 年交屋並遷入戶籍後，才在新建案所在的里推高淨移入與宅數，也就是新屋熱度。">
      {/* 時間軸標題 */}
      {times.map((t, i) => (
        <text key={t} x={col[i] + NW / 2} y={40} fill="var(--dg-muted)" fontSize="12" fontWeight="500" textAnchor="middle">{t}</text>
      ))}
      {/* 泳道分隔線與左側標籤 */}
      {[56, 152, 248].map(y => <line key={y} x1="16" y1={y} x2={W - 16} y2={y} stroke="var(--dg-rule)" strokeWidth="1" />)}
      {[
        { y: y1, a: '原本住的里', b: '客群指數量這裡' },
        { y: y2, a: '新建案所在的里', b: '新屋熱度量這裡' },
      ].map(l => (
        <g key={l.a}>
          <text x="24" y={l.y - 4} fill="var(--dg-ink)" fontSize="14" fontWeight="600">{l.a}</text>
          <text x="24" y={l.y + 16} fill="var(--dg-muted)" fontSize="12">{l.b}</text>
        </g>
      ))}
      {/* 箭頭（先畫線，再畫方塊） */}
      <line x1={col[0] + NW} y1={y1} x2={col[1] - 2} y2={y1} stroke="var(--dg-muted)" strokeWidth="1" markerEnd="url(#ig-journey-arrow)" />
      <path d={`M${col[1] + NW},${y1} H${hx - 8} Q${hx},${y1} ${hx},${y1 + 8} V${ny(1) - 2}`}
        fill="none" stroke="var(--dg-accent)" strokeWidth="1.2" markerEnd="url(#ig-journey-arrow-accent)" />
      <rect x={hx + 8} y={128} width={76} height={16} rx="2" fill="var(--dg-paper)" />
      <text x={hx + 12} y={140} fill="var(--dg-accent-text)" fontSize="12" fontWeight="500">買在新建案</text>
      <line x1={col[2] + NW} y1={y2} x2={col[3] - 2} y2={y2} stroke="var(--dg-muted)" strokeWidth="1" markerEnd="url(#ig-journey-arrow)" />
      {/* 方塊 */}
      {nodes.map(n => {
        const x = col[n.c], y = ny(n.l)
        return (
          <g key={n.name}>
            <Box x={x} y={y} w={NW} h={NH} focal={n.focal} />
            <text x={x + NW / 2} y={y + 24} fill="var(--dg-ink)" fontSize="13" fontWeight="600" textAnchor="middle">{n.name}</text>
            <text x={x + NW / 2} y={y + 44} fill={n.focal ? 'var(--dg-accent-text)' : 'var(--dg-muted)'} fontSize="12" textAnchor="middle">{n.sub}</text>
          </g>
        )
      })}
      {/* 編輯註記 */}
      <text x={col[0]} y={284} fill="var(--dg-muted)" fontSize="12.5">
        等到戶籍數字動了，這批人早就買完房——所以「搬進來」放進新屋熱度，不當作下一批客源。
      </text>
    </Figure>
  )
}

/* ── B. 流程圖：一樣材料怎麼變成分數（即時數字） ─────────────────────── */
export function StepsDiagram({ village, rawLabel, rawValue, pct, weight }: {
  /** 範例村里名稱（例：國平里） */
  village: string
  /** 材料名稱（例：25–34 歲人口占比） */
  rawLabel: string
  /** 已格式化的原始數值（例：18.2%） */
  rawValue: string
  /** 全市百分位（0–100） */
  pct: number
  /** 這項材料的比重（%） */
  weight: number
}) {
  const W = 960, H = 168
  const xs = [32, 352, 672], NW = 256, NH = 120, Y = 24
  const contrib = pct * weight / 100
  const steps = [
    { tag: '步驟 1', title: '量原始數字', value: rawValue, note: `${village} ${rawLabel}` },
    { tag: '步驟 2', title: '全市 650 里排名次', value: `${pct.toFixed(1)} 分`, note: `這一項贏過全市 ${Math.round(pct)}% 的里`, focal: true },
    { tag: '步驟 3', title: '乘上比重', value: `× ${weight}% = ${contrib.toFixed(1)}`, note: '再和其他材料加起來（下圖）' },
  ]
  return (
    <Figure id="ig-steps" w={W} h={H}
      title={`${village}首購指數第一項的計算步驟`}
      desc={`${village} ${rawLabel}為 ${rawValue}，在全市排名換算為 ${pct.toFixed(1)} 分，乘上比重 ${weight}% 後貢獻 ${contrib.toFixed(1)} 分。`}>
      {[0, 1].map(i => (
        <line key={i} x1={xs[i] + NW} y1={Y + 60} x2={xs[i + 1] - 2} y2={Y + 60} stroke="var(--dg-muted)" strokeWidth="1" markerEnd="url(#ig-steps-arrow)" />
      ))}
      {steps.map((s, i) => {
        const x = xs[i]
        return (
          <g key={s.tag}>
            <Box x={x} y={Y} w={NW} h={NH} focal={s.focal} />
            <text x={x + 16} y={Y + 24} fill={s.focal ? 'var(--dg-accent-text)' : 'var(--dg-muted)'} fontSize="12" fontWeight="500">{s.tag}</text>
            <text x={x + 16} y={Y + 46} fill="var(--dg-ink)" fontSize="14" fontWeight="600">{s.title}</text>
            <text x={x + 16} y={Y + 82} fill={s.focal ? 'var(--dg-accent-text)' : 'var(--dg-ink)'} fontSize="22" fontWeight="700" fontFamily={MONO}>{s.value}</text>
            <text x={x + 16} y={Y + 106} fill="var(--dg-muted)" fontSize="12">{s.note}</text>
          </g>
        )
      })}
    </Figure>
  )
}

/* ── C. 矩陣（heatmap）：每個指數放哪些材料 ─────────────────────────── */
/** 材料列：與 PRESET_INDICES 的 component key 對應（年齡占比兩個 key 併成一列） */
const RECIPE_ROWS: { label: string; sub?: string; keys: string[] }[] = [
  { label: '年齡層占比', sub: '25–34／35–44 歲', keys: ['share2534', 'share3544'] },
  { label: '結婚', keys: ['marriage'] },
  { label: '生小孩', keys: ['birth'] },
  { label: '年輕戶長', sub: '26–45 歲', keys: ['head2645'] },
  { label: '大學以上學歷', keys: ['eduUnivPlus'] },
  { label: '所得（購買力）', keys: ['income'] },
]
const HEAT_PARTS: { label: string; key: string }[] = [
  { label: '年輕人搬進來', key: 'cohortYoung' }, { label: '家庭搬進來', key: 'cohortMid' },
  { label: '淨流入', key: 'social' }, { label: '新住宅入住', key: 'dwellingsGrowth' },
]
const RECIPE_COLS: { id: string; who: string }[] = [
  { id: 'firstBuyer', who: '25–34 歲・第一次買' },
  { id: 'newHome', who: '35–44 歲家庭・換新屋' },
  { id: 'resale', who: '成家家庭・換二手屋' },
]

export function RecipeHeatmap() {
  const W = 688
  const GX = 192, CW = 152, CH = 44, GAP = 4, TOP = 64
  const weightOf = (indexId: string, keys: string[]) =>
    PRESET_INDICES.find(p => p.id === indexId)?.components.filter(c => keys.includes(c.key)).reduce((s, c) => s + c.weight, 0) ?? 0
  const cells = RECIPE_ROWS.map(r => RECIPE_COLS.map(c => weightOf(c.id, r.keys)))
  // 重點格：全表最重的一格（目前是首購的年齡層占比），不參與深淺比例
  let fr = 0, fc = 0
  cells.forEach((row, i) => row.forEach((v, j) => { if (v > cells[fr][fc]) { fr = i; fc = j } }))
  const maxNonFocal = Math.max(...cells.flatMap((row, i) => row.filter((_, j) => !(i === fr && j === fc))))
  // 單一 ink 色階：比重越高越深；上限 0.36 讓格內文字維持足夠對比
  const ramp = (v: number) => 0.06 + 0.30 * Math.min(1, v / maxNonFocal)
  const gridBottom = TOP + RECIPE_ROWS.length * (CH + GAP) - GAP
  const heat = PRESET_INDICES.find(p => p.id === 'heat')!
  const heatW = (key: string) => heat.components.find(c => c.key === key)?.weight ?? 0
  const heatTotal = heat.components.reduce((s, c) => s + c.weight, 0)
  const stripY = gridBottom + 56, stripW = CW * 3 + GAP * 2
  const legendY = stripY + CH + 52
  const H = legendY + 28
  const indexName = (id: string) => PRESET_INDICES.find(p => p.id === id)?.name ?? id
  const focalName = `${indexName(RECIPE_COLS[fc].id)}的${RECIPE_ROWS[fr].label} ${cells[fr][fc]}%`
  // 熱度長條：依比重切段，段與段之間留 4px；x 由前面各段寬度累加
  const unit = (stripW - GAP * (HEAT_PARTS.length - 1)) / heatTotal
  const segs = HEAT_PARTS.map((p, i) => {
    const before = HEAT_PARTS.slice(0, i).reduce((s, q) => s + heatW(q.key) * unit + GAP, 0)
    return { ...p, w: heatW(p.key), x: GX + before, segW: heatW(p.key) * unit }
  })
  return (
    <Figure id="ig-recipe" w={W} h={H}
      title="三個客群指數與新屋熱度的材料比重"
      desc={`首購、換新屋、換二手三個客群指數各用不同的住戶條件材料，所得三個都有；最重的一項是${focalName}。新屋熱度用的是遷入與新住宅，和客群指數的材料完全不重疊。`}>
      {/* 欄標題 */}
      {RECIPE_COLS.map((c, j) => (
        <g key={c.id}>
          <text x={GX + j * (CW + GAP) + CW / 2} y={30} fill="var(--dg-ink)" fontSize="14" fontWeight="600" textAnchor="middle">{indexName(c.id)}</text>
          <text x={GX + j * (CW + GAP) + CW / 2} y={50} fill="var(--dg-muted)" fontSize="12" textAnchor="middle">{c.who}</text>
        </g>
      ))}
      {/* 列標題＋格子 */}
      {RECIPE_ROWS.map((r, i) => {
        const y = TOP + i * (CH + GAP)
        return (
          <g key={r.label}>
            <text x={GX - 16} y={r.sub ? y + 19 : y + 27} fill="var(--dg-ink)" fontSize="13" fontWeight="600" textAnchor="end">{r.label}</text>
            {r.sub && <text x={GX - 16} y={y + 36} fill="var(--dg-muted)" fontSize="12" textAnchor="end">{r.sub}</text>}
            {cells[i].map((v, j) => {
              const x = GX + j * (CW + GAP), focal = i === fr && j === fc
              if (!v) return (
                <g key={j}>
                  <rect x={x + 0.5} y={y + 0.5} width={CW - 1} height={CH - 1} rx="4" fill="none" stroke="var(--dg-rule)" strokeDasharray="3,3" />
                  <text x={x + CW / 2} y={y + 27} fill="var(--dg-faint)" fontSize="12" textAnchor="middle">—</text>
                </g>
              )
              return (
                <g key={j}>
                  <rect x={x} y={y} width={CW} height={CH} rx="4" fill="var(--dg-paper)" />
                  <rect x={x} y={y} width={CW} height={CH} rx="4" data-row={r.label} data-col={RECIPE_COLS[j].id} data-value={v} data-focal={focal || undefined}
                    fill={focal ? 'var(--dg-accent)' : 'var(--dg-ink)'} fillOpacity={focal ? 0.85 : ramp(v)}
                    stroke={focal ? 'var(--dg-accent)' : 'none'} strokeWidth="1.2" />
                  <text x={x + CW / 2} y={y + 27} fill={focal ? 'var(--on-accent)' : 'var(--dg-ink)'} fontSize="14" fontWeight="700" fontFamily={MONO} textAnchor="middle">{v}%</text>
                </g>
              )
            })}
          </g>
        )
      })}
      {/* 新屋熱度：另一組材料 */}
      <line x1="16" y1={gridBottom + 20} x2={W - 16} y2={gridBottom + 20} stroke="var(--dg-rule)" strokeWidth="1" />
      <text x={GX - 16} y={stripY + 19} fill="var(--dg-ink)" fontSize="13" fontWeight="600" textAnchor="end">新屋熱度</text>
      <text x={GX - 16} y={stripY + 36} fill="var(--dg-muted)" fontSize="12" textAnchor="end">另一組材料</text>
      <text x={GX} y={stripY - 12} fill="var(--dg-muted)" fontSize="12">量的是人往哪裡搬、新屋在哪裡交屋，和上面的材料完全不重疊</text>
      {segs.map(s => (
        <g key={s.key}>
          <rect x={s.x} y={stripY} width={s.segW} height={CH} rx="4" fill="var(--dg-paper)" />
          <rect x={s.x} y={stripY} width={s.segW} height={CH} rx="4" fill="var(--dg-ink)" fillOpacity={ramp(s.w)} data-row="新屋熱度" data-col={s.label} data-value={s.w} />
          <text x={s.x + s.segW / 2} y={stripY + 27} fill="var(--dg-ink)" fontSize="14" fontWeight="700" fontFamily={MONO} textAnchor="middle">{s.w}%</text>
          <text x={s.x + s.segW / 2} y={stripY + CH + 20} fill="var(--dg-muted)" fontSize="12" textAnchor="middle">{s.label}</text>
        </g>
      ))}
      {/* 圖例 */}
      <line x1="16" y1={legendY - 12} x2={W - 16} y2={legendY - 12} stroke="var(--dg-rule)" strokeWidth="1" />
      {[0.10, 0.20, 0.30, 0.36].map((o, k) => (
        <rect key={o} x={16 + k * 20} y={legendY} width="16" height="10" rx="2" fill="var(--dg-ink)" fillOpacity={o} />
      ))}
      <text x={100} y={legendY + 10} fill="var(--dg-muted)" fontSize="12">比重越高，色塊越明顯</text>
      <rect x={232} y={legendY} width="16" height="10" rx="2" fill="var(--dg-accent)" fillOpacity="0.85" />
      <text x={256} y={legendY + 10} fill="var(--dg-muted)" fontSize="12">最重的一項</text>
      <text x={348} y={legendY + 10} fill="var(--dg-muted)" fontSize="12">— 不採用</text>
      <text x={W - 16} y={legendY + 10} fill="var(--dg-muted)" fontSize="12" textAnchor="end">每個指數的比重加起來都是 100%</text>
    </Figure>
  )
}

/* ── D. 瀑布圖：三樣材料加起來就是總分（即時數字） ─────────────────────── */
export function ExampleWaterfall({ title, parts, total, median, p90 }: {
  title: string
  /** 各組成：標籤、百分位、權重占比（0–1） */
  parts: { label: string; pct: number; share: number; weight: number }[]
  total: number
  median: number | null
  p90: number | null
}) {
  const W = 800, H = 344
  const BASE = 252, K = 2.2                       // y 軸 0–100 分 → 220px
  const y = (v: number) => BASE - v * K
  const PITCH = 136, BW = 96, X0 = 88
  // 最大的一項是重點（accent），其他是一般加分
  const contribs = parts.map(p => p.pct * p.share)
  const focalIdx = contribs.indexOf(Math.max(...contribs))
  const running: number[] = []
  contribs.reduce((s, c) => { running.push(s + c); return s + c }, 0)
  const bars = [
    ...parts.map((p, i) => ({ kind: 'delta' as const, label: p.label, sub: `${p.pct.toFixed(1)} 分 × ${p.weight}%`, from: i ? running[i - 1] : 0, to: running[i], value: contribs[i], focal: i === focalIdx })),
    { kind: 'total' as const, label: title, sub: '0–100 分', from: 0, to: total, value: total, focal: false },
  ]
  const plotRight = X0 + PITCH * (bars.length - 1) + BW + 16
  // 參考線標籤：兩條太近時往上下推開，至少差 16px
  const refs = [
    median != null ? { v: median, label: `全市中位數 ${median.toFixed(1)}` } : null,
    p90 != null ? { v: p90, label: `前 10% 門檻 ${p90.toFixed(1)}` } : null,
  ].filter((r): r is { v: number; label: string } => r != null).sort((a, b) => b.v - a.v)
  const refLabelY = refs.map(r => y(r.v) + 4)
  if (refLabelY.length === 2 && refLabelY[1] - refLabelY[0] < 16) {
    const mid = (refLabelY[0] + refLabelY[1]) / 2
    refLabelY[0] = mid - 8; refLabelY[1] = mid + 8
  }
  return (
    <Figure id="ig-waterfall" w={W} h={H}
      title={`${title}的組成`}
      desc={`各項材料的排名分乘上比重後依序相加：${bars.slice(0, -1).map(b => `${b.label} +${b.value.toFixed(1)}`).join('、')}，總分 ${total.toFixed(1)}${median != null ? `；全市中位數 ${median.toFixed(1)}` : ''}${p90 != null ? `、前 10% 門檻 ${p90.toFixed(1)}` : ''}。`}>
      {/* 格線與 y 軸 */}
      {[0, 25, 50, 75, 100].map(t => (
        <g key={t}>
          <line x1="64" y1={y(t)} x2={plotRight} y2={y(t)} stroke={t === 0 ? 'var(--dg-axis)' : 'var(--dg-rule)'} strokeWidth={t === 0 ? 1 : 0.8} />
          <text x="56" y={y(t) + 4} fill="var(--dg-muted)" fontSize="11" fontFamily={MONO} textAnchor="end">{t}</text>
        </g>
      ))}
      {/* 參考線（先畫，柱子會蓋在上面） */}
      {refs.map((r, i) => (
        <g key={r.label}>
          <line x1="64" y1={y(r.v)} x2={plotRight} y2={y(r.v)} stroke="var(--dg-muted)" strokeWidth="1" strokeDasharray="5,4" />
          <text x={plotRight + 8} y={refLabelY[i]} fill="var(--dg-muted)" fontSize="12">{r.label}</text>
        </g>
      ))}
      {/* 承接線：把累計分數帶到下一根柱子 */}
      {bars.slice(0, -1).map((b, i) => (
        <line key={i} x1={X0 + i * PITCH + BW} y1={y(b.to)} x2={X0 + (i + 1) * PITCH} y2={y(b.to)} stroke="var(--dg-conn)" strokeWidth="1" data-carry={b.to.toFixed(1)} />
      ))}
      {/* 柱子 */}
      {bars.map((b, i) => {
        const x = X0 + i * PITCH, top = y(b.to), hgt = Math.max(1, y(b.from) - top)
        const fill = b.kind === 'total' ? 'var(--dg-ink)' : b.focal ? 'var(--dg-accent)' : 'var(--dg-muted)'
        const fillOp = b.kind === 'total' ? 0.10 : b.focal ? 0.22 : 0.16
        const stroke = b.kind === 'total' ? 'var(--dg-ink)' : b.focal ? 'var(--dg-accent)' : 'var(--dg-muted)'
        return (
          <g key={b.label}>
            <rect x={x} y={top} width={BW} height={hgt} fill="var(--dg-paper)" />
            <rect x={x} y={top} width={BW} height={hgt} fill={fill} fillOpacity={fillOp} stroke={stroke} strokeWidth="1"
              data-role={b.kind} data-value={b.kind === 'total' ? b.value.toFixed(1) : `+${b.value.toFixed(1)}`} data-name={b.label} />
            {/* 數值標籤底下墊紙色，參考線剛好穿過時不會糊掉 */}
            <rect x={x + 8} y={top - (b.kind === 'total' ? 30 : 24)} width={BW - 16} height={b.kind === 'total' ? 24 : 18} rx="2" fill="var(--dg-paper)" />
            <text x={x + BW / 2} y={top - 8} textAnchor="middle" fontFamily={MONO}
              fill={b.kind === 'total' ? 'var(--dg-ink)' : b.focal ? 'var(--dg-accent-text)' : 'var(--dg-muted)'}
              fontSize={b.kind === 'total' ? 20 : 13} fontWeight="700">
              {b.kind === 'total' ? b.value.toFixed(1) : `+${b.value.toFixed(1)}`}
            </text>
            <text x={x + BW / 2} y={BASE + 22} fill="var(--dg-ink)" fontSize="13" fontWeight="600" textAnchor="middle">{b.label}</text>
            <text x={x + BW / 2} y={BASE + 40} fill="var(--dg-muted)" fontSize="11" fontFamily={MONO} textAnchor="middle">{b.sub}</text>
          </g>
        )
      })}
      {/* 圖例 */}
      <line x1="16" y1={H - 40} x2={W - 16} y2={H - 40} stroke="var(--dg-rule)" strokeWidth="1" />
      {[
        { x: 16, fill: 'var(--dg-ink)', op: 0.10, stroke: 'var(--dg-ink)', label: '總分' },
        { x: 96, fill: 'var(--dg-muted)', op: 0.16, stroke: 'var(--dg-muted)', label: '各項加分' },
        { x: 208, fill: 'var(--dg-accent)', op: 0.22, stroke: 'var(--dg-accent)', label: '加最多的一項' },
      ].map(l => (
        <g key={l.label}>
          <rect x={l.x} y={H - 24} width="16" height="10" fill={l.fill} fillOpacity={l.op} stroke={l.stroke} strokeWidth="1" />
          <text x={l.x + 24} y={H - 14} fill="var(--dg-muted)" fontSize="12">{l.label}</text>
        </g>
      ))}
      <line x1="344" y1={H - 19} x2="368" y2={H - 19} stroke="var(--dg-muted)" strokeWidth="1" strokeDasharray="5,4" />
      <text x="376" y={H - 14} fill="var(--dg-muted)" fontSize="12">全市 650 里的參考線</text>
    </Figure>
  )
}

/* ── E. 啞鈴圖：跨期驗證（都市 18 區） ───────────────────────────── */
export function ValidationDumbbell({ rows }: {
  rows: { name: string; match: string; other: string; matchR: number; otherR: number }[]
}) {
  const W = 800
  const GX = 192, PX1 = 760
  const FLOOR = -0.2, CEIL = 1.0
  const x = (v: number) => Math.round(GX + (v - FLOOR) / (CEIL - FLOOR) * (PX1 - GX))
  const PITCH = 56, Y0 = 48
  const rowY = (i: number) => Y0 + i * PITCH
  const plotBottom = rowY(rows.length - 1) + 28
  const H = plotBottom + 104
  const ticks = [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0]
  return (
    <Figure id="ig-validation" w={W} h={H}
      title="指數對之後 24 個月交易的排名相關（都市 18 區）"
      desc={rows.map(r => `${r.name}：對應${r.match}交易 ${r.matchR.toFixed(2)}、${r.other}交易 ${r.otherR.toFixed(2)}`).join('；') + '。'}>
      {/* 格線：0 用軸線粗細，其他用細線 */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={x(t)} y1={Y0 - 24} x2={x(t)} y2={plotBottom} stroke={t === 0 ? 'var(--dg-axis)' : 'var(--dg-rule)'} strokeWidth={t === 0 ? 1 : 0.8} />
          <text x={x(t)} y={plotBottom + 20} fill="var(--dg-muted)" fontSize="11" fontFamily={MONO} textAnchor="middle">{t.toFixed(1)}</text>
        </g>
      ))}
      <text x={(GX + PX1) / 2} y={plotBottom + 42} fill="var(--dg-muted)" fontSize="12" textAnchor="middle">排名相關（1＝排名完全一樣，0＝沒有關係）</text>
      {rows.map((r, i) => {
        const cy = rowY(i)
        const xm = x(r.matchR), xo = x(r.otherR)
        const xl = Math.min(xm, xo), xr = Math.max(xm, xo)
        const lv = xm < xo ? r.matchR : r.otherR, rv = xm < xo ? r.otherR : r.matchR
        return (
          <g key={r.name}>
            <text x={GX - 16} y={cy - 2} fill="var(--dg-ink)" fontSize="14" fontWeight="600" textAnchor="end">{r.name}</text>
            <text x={GX - 16} y={cy + 16} fill="var(--dg-muted)" fontSize="12" textAnchor="end">對應{r.match}交易</text>
            <line x1={xl} y1={cy} x2={xr} y2={cy} stroke="var(--dg-conn)" strokeWidth="1" />
            <circle cx={xo} cy={cy} r="6" fill="var(--dg-paper)" stroke="var(--dg-muted)" strokeWidth="1.5" />
            <circle cx={xm} cy={cy} r="6" fill="var(--dg-accent)" stroke="var(--dg-ink)" strokeWidth="1" />
            <text x={xl - 12} y={cy + 4} fill="var(--dg-muted)" fontSize="12" fontFamily={MONO} textAnchor="end">{lv.toFixed(2)}</text>
            <text x={xr + 12} y={cy + 4} fill="var(--dg-muted)" fontSize="12" fontFamily={MONO}>{rv.toFixed(2)}</text>
          </g>
        )
      })}
      {/* 圖例 */}
      <line x1="16" y1={H - 40} x2={W - 16} y2={H - 40} stroke="var(--dg-rule)" strokeWidth="1" />
      <circle cx="24" cy={H - 19} r="6" fill="var(--dg-accent)" stroke="var(--dg-ink)" strokeWidth="1" />
      <text x="38" y={H - 14} fill="var(--dg-muted)" fontSize="12">對應的交易（越接近 1 越準）</text>
      <circle cx="232" cy={H - 19} r="6" fill="var(--dg-paper)" stroke="var(--dg-muted)" strokeWidth="1.5" />
      <text x="246" y={H - 14} fill="var(--dg-muted)" fontSize="12">另一種交易（越接近 0 越分得清客群）</text>
      <text x={W - 16} y={H - 14} fill="var(--dg-muted)" fontSize="12" textAnchor="end">列順序：依指數</text>
    </Figure>
  )
}

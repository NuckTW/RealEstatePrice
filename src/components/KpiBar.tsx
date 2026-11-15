export interface KpiData {
  total?: number
  avg_unit_price?: number
  avg_area?: number
  avg_total?: number
  avg_parking?: number
  parking_count?: number
  total_sales?: number
  // 中位數與實際納入筆數（統一口徑：首頁預設看中位數，平均數放小字對照）
  median_unit_price?: number
  median_area?: number
  median_total?: number
  median_parking?: number
  unit_price_n?: number
  area_n?: number
  total_price_n?: number
}

type NumKey = keyof KpiData

interface CardDef {
  key: NumKey          // 主數字（中位數）
  avgKey?: NumKey      // 小字對照的平均數；中位數欄位缺漏時也拿它當主數字
  nKey?: NumKey        // 納入計算的筆數
  label: string
  icon: string
  format: (v: number) => string
  unit: string
  tone: string
}

const CARDS: CardDef[] = [
  {
    key: 'total',
    label: '成交戶數', icon: '◳',
    format: v => v.toLocaleString(),
    unit: '戶', tone: 'var(--series-1)',
  },
  {
    key: 'median_unit_price', avgKey: 'avg_unit_price', nKey: 'unit_price_n',
    label: '中位單價', icon: '◰',
    format: v => String(v),
    unit: '萬/坪', tone: 'var(--series-3)',
  },
  {
    key: 'median_area', avgKey: 'avg_area', nKey: 'area_n',
    label: '中位坪數', icon: '◆',
    format: v => String(v),
    unit: '坪', tone: 'var(--series-6)',
  },
  {
    key: 'median_total', avgKey: 'avg_total', nKey: 'total_price_n',
    label: '中位總價', icon: '◆',
    format: v => v.toLocaleString(),
    unit: '萬', tone: 'var(--clay-400)',
  },
  {
    key: 'median_parking', avgKey: 'avg_parking', nKey: 'parking_count',
    label: '中位車位價', icon: '◲',
    format: v => v.toLocaleString(),
    unit: '萬', tone: 'var(--series-4)',
  },
  {
    key: 'total_sales',
    label: '總銷售額', icon: '▦',
    format: v => v.toLocaleString(),
    unit: '億', tone: 'var(--series-8)',
  },
]

/** 卡片底部小字樣式 */
const footStyle = {
  fontSize: 'var(--text-3xs)', color: 'var(--text-faint)',
  fontFamily: 'var(--font-sans)', lineHeight: 1.4,
} as const

/**
 * 期間膠囊。從 KpiBar 抽出來獨立匯出，讓 Dashboard 能把它與
 * ActiveFilterTags 排在同一列 —— 兩者都是「目前套用的條件」，
 * 分成兩行閱讀時會被誤認為不同層級的資訊。
 */
export function DateBadge({ dateRange }: { dateRange: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 'var(--text-xs)', color: 'var(--accent-tint)',
      background: 'var(--accent-wash)',
      border: '1px solid var(--accent-wash-border)',
      borderRadius: 'var(--radius-full)',
      padding: '3px 12px',
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--accent)', flexShrink: 0,
        animation: 'blink 1.8s ease-in-out infinite',
      }} />
      {dateRange}
    </span>
  )
}

export default function KpiBar({ data, showBackfillWarning }: { data: KpiData; showBackfillWarning?: boolean }) {
  return (
    <div style={{ padding: '4px 20px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* KPI cards */}
      {/* 卡片最小寬度跟著字級縮放：大字級時 auto-fit 會自然讓每列排下更少張卡、卡片變寬，
          避免 --text-xl 放大到 30px 後數字被卡片邊界裁掉 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(calc(128px * var(--font-scale)), 1fr))',
        gap: 8,
      }}>
        {CARDS.map(card => {
          // 中位數欄位缺漏（舊版 API 快取）時退回平均數，避免整張卡變 0
          const raw = data[card.key] ?? (card.avgKey ? data[card.avgKey] : undefined)
          const value = raw != null ? raw : 0
          const avg = card.avgKey ? data[card.avgKey] : undefined
          const n = card.nKey ? data[card.nKey] : undefined
          return (
            <div
              key={card.key}
              style={{
                position: 'relative', overflow: 'hidden',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-card)',
                background: 'var(--surface-card)',
                padding: '9px 12px',
                display: 'flex', flexDirection: 'column', gap: 4,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* Left accent rail */}
              <span style={{
                position: 'absolute', left: 0, top: 8, bottom: 8,
                width: 3, borderRadius: '0 3px 3px 0',
                background: card.tone,
              }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: 'var(--text-3xs)', color: 'var(--text-muted)',
                  fontWeight: 'var(--weight-medium)',
                  letterSpacing: 'var(--tracking-caps)',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-sans)',
                }}>{card.label}</span>
                <span style={{ fontSize: 'var(--text-sm)', opacity: 0.45, color: card.tone }}>{card.icon}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
                  letterSpacing: 'var(--tracking-tight)',
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: 'var(--font-mono)',
                  color: card.tone,
                  lineHeight: 1.05,
                }}>
                  {card.format(value)}
                </span>
                <span style={{
                  fontSize: 'var(--text-xs)', color: 'var(--text-faint)',
                  fontFamily: 'var(--font-sans)',
                }}>{card.unit}</span>
              </div>

              {/* 車位價的分母與其他卡不同：只計「有拆出車位價」的交易。
                  多數交易的車位價併入房價未拆分，不標註會讓人以為是全體統計。 */}
              {card.key === 'median_parking' && data.parking_count != null && data.total ? (
                <span style={footStyle}>
                  僅計 {data.parking_count.toLocaleString()} 筆有拆出車位價者
                  （{Math.round(data.parking_count / data.total * 100)}%）
                  {avg != null ? ` · 平均 ${card.format(avg)}` : ''}
                </span>
              ) : card.nKey && n != null ? (
                // 其他中位數卡：標示納入筆數 n 與平均數，讓使用者知道口徑
                <span style={footStyle}>
                  n={n.toLocaleString()}{avg != null ? ` · 平均 ${card.format(avg)}` : ''}
                </span>
              ) : null}

              {/* 補登警示：只在「成交戶數」卡片、且迄月落在最新資料月往前 2 個月內才顯示 */}
              {card.key === 'total' && showBackfillWarning && (
                <span style={footStyle}>
                  最近 2 個月仍在補登，戶數會被低估
                </span>
              )}
            </div>
          )
        })}
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
    </div>
  )
}

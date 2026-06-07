interface KpiData {
  total?: number
  avg_unit_price?: number
  avg_area?: number
  avg_total?: number
  total_sales?: number
}

const CARDS = [
  {
    key: 'total' as const,
    label: '成交戶數', icon: '◳',
    format: (v: number) => v.toLocaleString(),
    unit: '戶', tone: 'var(--series-1)',
  },
  {
    key: 'avg_unit_price' as const,
    label: '均單價', icon: '◰',
    format: (v: number) => String(v),
    unit: '萬/坪', tone: 'var(--series-3)',
  },
  {
    key: 'avg_area' as const,
    label: '均坪數', icon: '◆',
    format: (v: number) => String(v),
    unit: '坪', tone: 'var(--series-6)',
  },
  {
    key: 'avg_total' as const,
    label: '均總價', icon: '◆',
    format: (v: number) => v.toLocaleString(),
    unit: '萬', tone: 'var(--clay-400)',
  },
  {
    key: 'total_sales' as const,
    label: '總銷售額', icon: '▦',
    format: (v: number) => v.toLocaleString(),
    unit: '億', tone: 'var(--series-8)',
  },
]

export default function KpiBar({ data, dateRange }: { data: KpiData; dateRange: string }) {
  return (
    <div style={{ padding: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Date badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 'var(--text-xs)', color: 'var(--accent-tint)',
          background: 'var(--accent-wash)',
          border: '1px solid var(--accent-wash-border)',
          borderRadius: 'var(--radius-full)',
          padding: '3px 12px',
          fontFamily: 'var(--font-mono)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)', flexShrink: 0,
            animation: 'blink 1.8s ease-in-out infinite',
          }} />
          {dateRange}
        </span>
      </div>

      {/* KPI cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
      }}>
        {CARDS.map(card => {
          const raw = data[card.key]
          const value = raw != null ? raw : 0
          return (
            <div
              key={card.key}
              style={{
                position: 'relative', overflow: 'hidden',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-card)',
                background: 'var(--surface-card)',
                padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 8,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* Left accent rail */}
              <span style={{
                position: 'absolute', left: 0, top: 12, bottom: 12,
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
                <span style={{ fontSize: 14, opacity: 0.45, color: card.tone }}>{card.icon}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{
                  fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
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
            </div>
          )
        })}
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
    </div>
  )
}

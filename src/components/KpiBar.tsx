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
    label: '成交戶數',
    icon: '🏠',
    format: (v: number) => `${v.toLocaleString()}`,
    unit: '戶',
    color: 'from-violet-500/10 to-violet-500/5',
    border: 'border-violet-500/20',
    accent: 'bg-violet-500',
    text: 'text-violet-300',
  },
  {
    key: 'avg_unit_price' as const,
    label: '均單價',
    icon: '📐',
    format: (v: number) => `${v}`,
    unit: '萬/坪',
    color: 'from-cyan-500/10 to-cyan-500/5',
    border: 'border-cyan-500/20',
    accent: 'bg-cyan-500',
    text: 'text-cyan-300',
  },
  {
    key: 'avg_area' as const,
    label: '均坪數',
    icon: '📏',
    format: (v: number) => `${v}`,
    unit: '坪',
    color: 'from-teal-500/10 to-teal-500/5',
    border: 'border-teal-500/20',
    accent: 'bg-teal-500',
    text: 'text-teal-300',
  },
  {
    key: 'avg_total' as const,
    label: '均總價',
    icon: '💰',
    format: (v: number) => `${v.toLocaleString()}`,
    unit: '萬',
    color: 'from-amber-500/10 to-amber-500/5',
    border: 'border-amber-500/20',
    accent: 'bg-amber-500',
    text: 'text-amber-300',
  },
  {
    key: 'total_sales' as const,
    label: '總銷售額',
    icon: '📊',
    format: (v: number) => `${v.toLocaleString()}`,
    unit: '億',
    color: 'from-emerald-500/10 to-emerald-500/5',
    border: 'border-emerald-500/20',
    accent: 'bg-emerald-500',
    text: 'text-emerald-300',
  },
]

export default function KpiBar({ data, dateRange }: { data: KpiData; dateRange: string }) {
  return (
    <div className="px-5 py-4 space-y-3">
      {/* Date badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-violet-300/80 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          {dateRange}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CARDS.map(card => {
          const raw = data[card.key]
          const value = raw != null ? raw : 0
          return (
            <div
              key={card.key}
              className={`
                relative overflow-hidden rounded-xl border ${card.border}
                bg-gradient-to-br ${card.color}
                p-4 flex flex-col gap-2
              `}
            >
              {/* Left accent bar */}
              <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r ${card.accent}`} />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400 font-medium tracking-wide uppercase">{card.label}</span>
                <span className="text-base opacity-60">{card.icon}</span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold tracking-tight ${card.text}`}>
                  {card.format(value)}
                </span>
                <span className="text-xs text-gray-500">{card.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

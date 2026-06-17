'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, CartesianGrid,
} from 'recharts'

interface ProjectStat {
  project_name: string
  district: string
  count: number
  unit_price: number
  avg_total: number
  first_date: string
  last_date: string
}

interface TrendRow {
  project_name: string
  month: string
  unit_price: number
  count: number
}

interface SearchResult {
  project_name: string
  district: string
  count: number
}

const COLORS = [
  '#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#a78bfa',
]

const MAX_SELECT = 10

interface Props {
  selected: string[]
  onRemove: (key: string) => void
  onAdd: (key: string) => void
}

export default function AreaAnalysisPanel({ selected, onRemove, onAdd }: Props) {
  const [stats,   setStats]   = useState<ProjectStat[]>([])
  const [trend,   setTrend]   = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* 分析資料 */
  useEffect(() => {
    if (!selected.length) { setStats([]); setTrend([]); return }
    setLoading(true)
    fetch(`/api/area-analysis?projects=${selected.map(encodeURIComponent).join(',')}`)
      .then(r => r.json())
      .then(d => { setStats(d.stats ?? []); setTrend(d.trend ?? []) })
      .finally(() => setLoading(false))
  }, [selected])

  /* 搜尋 */
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return }
    fetch(`/api/area-analysis?search=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => setResults(d.results ?? []))
  }, [])

  const onSearchChange = (v: string) => {
    setSearch(v)
    setShowDrop(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 300)
  }

  /* 走勢圖資料：pivot to { month, [project]: price } */
  const trendData = (() => {
    const months = [...new Set(trend.map(r => r.month))].sort()
    return months.map(mo => {
      const row: Record<string, string | number> = { month: mo.slice(2) } // 去年份前兩碼 → YY-MM
      trend.filter(r => r.month === mo).forEach(r => {
        row[r.project_name] = r.unit_price
      })
      return row
    })
  })()

  /* 摘要 */
  const avgPrice = stats.length
    ? Math.round(stats.reduce((s, r) => s + r.unit_price, 0) / stats.length * 10) / 10
    : 0
  const totalCount = stats.reduce((s, r) => s + r.count, 0)

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">

      {/* 搜尋加入 */}
      <div className="relative">
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          onFocus={() => search && setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 200)}
          placeholder="搜尋建案名稱加入…"
          className="w-full px-3 py-2 rounded-lg text-xs bg-[#1e293b] border border-white/10 text-gray-200 placeholder-gray-500 outline-none focus:border-amber-500/50"
        />
        {showDrop && results.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#1e293b] border border-white/10 rounded-lg overflow-hidden shadow-xl max-h-52 overflow-y-auto">
            {results.map(r => (
              <button
                key={r.project_name}
                disabled={selected.includes(r.project_name) || selected.length >= MAX_SELECT}
                onClick={() => { onAdd(r.project_name); setSearch(''); setShowDrop(false) }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed flex justify-between"
              >
                <span className="text-gray-200">{r.project_name}</span>
                <span className="text-gray-500">{r.district} · {r.count}戶</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 選取 chips */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((key, i) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: COLORS[i % COLORS.length] + '22', color: COLORS[i % COLORS.length], border: `1px solid ${COLORS[i % COLORS.length]}44` }}
            >
              {key}
              <button onClick={() => onRemove(key)} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center py-4">在地圖上框選建案或搜尋加入</p>
      )}

      {loading && (
        <div className="text-xs text-gray-500 text-center py-2 animate-pulse">分析中…</div>
      )}

      {stats.length > 0 && !loading && (
        <>
          {/* 摘要卡 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '建案數', value: `${stats.length} 案` },
              { label: '平均單價', value: `${avgPrice} 萬/坪` },
              { label: '總戶數', value: `${totalCount.toLocaleString()} 戶` },
            ].map(c => (
              <div key={c.label} className="bg-[#1e293b] rounded-lg px-3 py-2 text-center border border-white/5">
                <div className="text-[10px] text-gray-500 mb-0.5">{c.label}</div>
                <div className="text-sm font-bold text-amber-400">{c.value}</div>
              </div>
            ))}
          </div>

          {/* 均單價長條圖 */}
          <div>
            <div className="text-[10px] text-gray-500 mb-1">均單價對比（萬/坪）</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="project_name" tick={{ fontSize: 9, fill: '#9ca3af' }} width={72} />
                <Tooltip
                  contentStyle={{ background: '#0d1420', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: unknown) => [`${v} 萬/坪`, '均單價']}
                />
                <Bar dataKey="unit_price" radius={[0, 4, 4, 0]}>
                  {stats.map((r, i) => (
                    <Cell key={i} fill={COLORS[selected.indexOf(r.project_name) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 月度走勢 */}
          {trendData.length > 1 && (
            <div>
              <div className="text-[10px] text-gray-500 mb-1">月度成交均單價走勢（萬/坪）</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6b7280' }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} width={32} />
                  <Tooltip
                    contentStyle={{ background: '#0d1420', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: unknown, name: unknown) => [`${v} 萬/坪`, String(name)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                  {selected.map((key, i) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 明細表 */}
          <div>
            <div className="text-[10px] text-gray-500 mb-1">建案明細</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-gray-500 border-b border-white/10">
                    <th className="text-left pb-1 font-normal">建案</th>
                    <th className="text-right pb-1 font-normal">行政區</th>
                    <th className="text-right pb-1 font-normal">均單價</th>
                    <th className="text-right pb-1 font-normal">均總價</th>
                    <th className="text-right pb-1 font-normal">戶數</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((r, i) => (
                    <tr key={r.project_name} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-1.5 pr-2">
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5 flex-shrink-0"
                          style={{ background: COLORS[selected.indexOf(r.project_name) % COLORS.length], display: 'inline-block' }} />
                        {r.project_name}
                      </td>
                      <td className="text-right text-gray-400">{r.district}</td>
                      <td className="text-right text-amber-400 font-medium">{r.unit_price}</td>
                      <td className="text-right text-gray-300">{r.avg_total?.toLocaleString()}</td>
                      <td className="text-right text-gray-400">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

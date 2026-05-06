'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

interface MonthlyData {
  district: string
  month: string
  transaction_count: number
  avg_unit_price: number
  avg_total_price: number
}

interface YearlyData {
  year: number
  total_transactions: number
  avg_unit_price: number
  avg_total_price_wan: number
}

interface BuildingType {
  name: string
  value: number
}

type PresaleMode = 'false' | 'true' | 'all'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const TOP_DISTRICTS = ['東區', '永康區', '仁德區', '北區', '安南區', '歸仁區']

export default function Dashboard() {
  const [monthly, setMonthly] = useState<MonthlyData[]>([])
  const [yearly, setYearly] = useState<YearlyData[]>([])
  const [types, setTypes] = useState<BuildingType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDistrict, setSelectedDistrict] = useState('東區')
  const [presale, setPresale] = useState<PresaleMode>('false')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/charts?presale=${presale}`)
      .then(r => r.json())
      .then(d => {
        setMonthly(d.monthlyData || [])
        setYearly(d.yearlyData || [])
        setTypes(d.buildingTypes || [])
      })
      .finally(() => setLoading(false))
  }, [presale])

  const districtData = monthly
    .filter(d => d.district === selectedDistrict)
    .map(d => ({
      ...d,
      avg_unit_price_wan_ping: parseFloat(((d.avg_unit_price * 3.3058) / 10000).toFixed(1)),
    }))

  const PRESALE_TABS: { label: string; value: PresaleMode }[] = [
    { label: '成屋', value: 'false' },
    { label: '預售屋', value: 'true' },
    { label: '全部', value: 'all' },
  ]

  return (
    <div className="space-y-8">
      {/* 切換成屋 / 預售屋 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400 mr-1">資料類型：</span>
        {PRESALE_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setPresale(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              presale === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {loading && (
          <span className="text-xs text-gray-500 ml-2 animate-pulse">載入中...</span>
        )}
      </div>

      {/* 年度交易量 */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">📊 台南市年度交易量</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={yearly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={v => `${(Number(v) / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              formatter={(v) => [`${Number(v ?? 0).toLocaleString()} 筆`, '交易量']}
            />
            <Bar dataKey="total_transactions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 年度均價趨勢 */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">📈 全市年度均價趨勢（萬元/坪）</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={yearly.map(d => ({
            ...d,
            avg_wan_ping: parseFloat(((d.avg_unit_price * 3.3058) / 10000).toFixed(1)),
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              formatter={(v) => [`${v ?? 0} 萬/坪`, '平均單價']}
            />
            <Line type="monotone" dataKey="avg_wan_ping" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 行政區月均價 */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">🏘 行政區月均價趨勢</h2>
          <select
            value={selectedDistrict}
            onChange={e => setSelectedDistrict(e.target.value)}
            className="bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-600"
          >
            {TOP_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={districtData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              formatter={(v) => [`${v ?? 0} 萬/坪`, '平均單價']}
            />
            <Line type="monotone" dataKey="avg_unit_price_wan_ping" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="均價(萬/坪)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 建物型態分佈 */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">🏠 建物型態分佈</h2>
        <div className="flex items-center gap-8">
          <ResponsiveContainer width="50%" height={240}>
            <PieChart>
              <Pie
                data={types}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {types.map((t, i) => (
              <div key={t.name} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-300 truncate">{t.name}</span>
                <span className="text-gray-400 ml-auto">{t.value.toLocaleString()} 筆</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface KpiData {
  total?: number
  avg_unit_price?: number
  avg_area?: number
  avg_total?: number
  total_sales?: number
}

const MONTHS_LABEL: Record<string, string> = {
  '1': '近 1 個月', '3': '近 3 個月', '6': '近 6 個月',
  '12': '近 1 年', '0': '全部資料',
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-3 border-r border-gray-700/60 last:border-0">
      <span className="text-[11px] text-gray-400 mb-1 whitespace-nowrap">{label}</span>
      <span className={`text-lg font-bold tracking-tight ${color}`}>{value}</span>
    </div>
  )
}

export default function KpiBar({ data, months }: { data: KpiData; months: string }) {
  return (
    <div className="flex items-center bg-gray-800/40 border-b border-gray-700/60 px-6 flex-wrap">
      <div className="flex items-center py-3 pr-5 border-r border-gray-700/60 mr-2">
        <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-700/50 rounded-full px-3 py-1 whitespace-nowrap">
          {MONTHS_LABEL[months] ?? ''}
        </span>
      </div>
      <div className="flex flex-wrap">
        <KpiCard label="總戶數"   value={`${(data.total ?? 0).toLocaleString()} 戶`} color="text-purple-400" />
        <KpiCard label="均單價"   value={`${data.avg_unit_price ?? 0} 萬/坪`}        color="text-cyan-400" />
        <KpiCard label="均坪數"   value={`${data.avg_area ?? 0} 坪`}                  color="text-teal-400" />
        <KpiCard label="均總價"   value={`${(data.avg_total ?? 0).toLocaleString()} 萬`} color="text-amber-400" />
        <KpiCard label="總銷"     value={`${data.total_sales ?? 0} 億`}               color="text-green-400" />
      </div>
    </div>
  )
}

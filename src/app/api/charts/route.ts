import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 分頁抓取所有資料（繞過 Supabase 1000 筆上限）
async function fetchAll(fields: string, filter?: { col: string; gte?: string; lt?: string }) {
  const PAGE = 1000   // Supabase 每頁上限
  const all: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    let q = supabaseAdmin
      .from('transactions')
      .select(fields)
      .not('unit_price_sqm', 'is', null)
      .gt('unit_price_sqm', 0)
      .gt('total_price', 0)
    if (filter?.gte) q = q.gte('transaction_date', filter.gte)
    if (filter?.lt)  q = q.lt('transaction_date', filter.lt)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break   // 最後一頁
    from += PAGE
  }
  return all
}

export async function GET() {
  try {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // 並行取得：全期（年度統計）+ 近12個月（行政區月統計）
    const [allData, recentData] = await Promise.all([
      fetchAll('transaction_date,total_price,unit_price_sqm,building_type'),
      fetchAll('district,transaction_date,total_price,unit_price_sqm', { gte: cutoff }),
    ])

    // --- 年度概況 ---
    const yearMap: Record<number, { count: number; priceSum: number; unitPriceSum: number }> = {}
    allData.forEach(r => {
      const y = new Date(r.transaction_date as string).getFullYear()
      if (y < 2021) return
      if (!yearMap[y]) yearMap[y] = { count: 0, priceSum: 0, unitPriceSum: 0 }
      yearMap[y].count++
      yearMap[y].priceSum += r.total_price as number
      yearMap[y].unitPriceSum += r.unit_price_sqm as number
    })
    const yearlyData = Object.entries(yearMap).map(([year, v]) => ({
      year: Number(year),
      total_transactions: v.count,
      avg_unit_price: Math.round(v.unitPriceSum / v.count),
      avg_total_price_wan: Math.round(v.priceSum / v.count / 10000),
    })).sort((a, b) => a.year - b.year)

    // --- 行政區月統計 ---
    const monthMap: Record<string, Record<string, { count: number; unitPriceSum: number; priceSum: number }>> = {}
    recentData.forEach(r => {
      const month = (r.transaction_date as string)?.slice(0, 7)
      const d = r.district as string
      if (!month || !d) return
      if (!monthMap[d]) monthMap[d] = {}
      if (!monthMap[d][month]) monthMap[d][month] = { count: 0, unitPriceSum: 0, priceSum: 0 }
      monthMap[d][month].count++
      monthMap[d][month].unitPriceSum += r.unit_price_sqm as number
      monthMap[d][month].priceSum += r.total_price as number
    })
    const monthlyData = Object.entries(monthMap).flatMap(([district, months]) =>
      Object.entries(months).map(([month, v]) => ({
        district, month,
        transaction_count: v.count,
        avg_unit_price: Math.round(v.unitPriceSum / v.count),
        avg_total_price: Math.round(v.priceSum / v.count),
      }))
    ).sort((a, b) => a.month.localeCompare(b.month))

    // --- 建物型態分佈 ---
    const typeCounts: Record<string, number> = {}
    allData.forEach(r => {
      const t = (r.building_type as string)?.trim()
      if (t) typeCounts[t] = (typeCounts[t] || 0) + 1
    })
    const buildingTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, value]) => ({ name, value }))

    return NextResponse.json({ monthlyData, yearlyData, buildingTypes })
  } catch (err) {
    console.error('[/api/charts]', err)
    return NextResponse.json({ error: '資料查詢失敗' }, { status: 500 })
  }
}

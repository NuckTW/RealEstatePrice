import { NextResponse } from 'next/server'
import {
  fetchPermitTrend, fetchUnsoldTrend, fetchUnsoldByDistrict, fetchMonthlyTxCount,
} from '@/lib/queries/supply'

/** '11504' → '115/04' */
function ymLabel(ym: string): string {
  return `${ym.slice(0, -2)}/${ym.slice(-2)}`
}

/** '2026-04' → '11504'（民國年月） */
function isoMonthToRoc(month: string): string {
  const [y, m] = month.split('-')
  return `${parseInt(y) - 1911}${m}`
}

export async function GET() {
  try {
    const [permitRows, unsoldTrendRows, unsoldDistrictRows, txRows] = await Promise.all([
      fetchPermitTrend(),
      fetchUnsoldTrend(),
      fetchUnsoldByDistrict(),
      fetchMonthlyTxCount(),
    ])

    // 建照/使照按月合併 + 實價登錄成交量疊圖
    const txByYm = new Map(txRows.map(r => [isoMonthToRoc(String(r.month)), Number(r.count)]))
    const byYm = new Map<string, Record<string, unknown>>()
    for (const r of permitRows) {
      const ym = String(r.source_period)
      if (!byYm.has(ym)) {
        byYm.set(ym, { ym, label: ymLabel(ym), txCount: txByYm.get(ym) ?? null })
      }
      const entry = byYm.get(ym)!
      const prefix = r.permit_type === 'building' ? 'building' : 'usage'
      // 來源偶有「已發布但全為 0」的缺口月份（如 11412），以 null 呈現缺資料而非 0 件
      const isGap = Number(r.permits) === 0 && Number(r.floor_area_m2 ?? 0) === 0
      entry[prefix]            = isGap ? null : Number(r.permits)
      entry[`${prefix}Area`]   = isGap ? null : (r.floor_area_m2 != null ? Number(r.floor_area_m2) : null)
      entry[`${prefix}Cost`]   = isGap ? null : (r.cost_thousand != null ? Number(r.cost_thousand) : null)
    }

    const unsoldTrend = unsoldTrendRows.map(r => ({
      quarter: String(r.source_period),
      total:   Number(r.unsold_units),
    }))

    const latestQuarter = unsoldDistrictRows.length ? String(unsoldDistrictRows[0].source_period) : null
    const unsoldByDistrict = {
      quarter: latestQuarter,
      rows: unsoldDistrictRows.map(r => ({
        district: String(r.district),
        units:    Number(r.unsold_units),
      })),
    }

    return NextResponse.json({
      permits: Array.from(byYm.values()),
      unsoldTrend,
      unsoldByDistrict,
    })
  } catch (err) {
    console.error('[/api/supply]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

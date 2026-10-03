import { NextResponse } from 'next/server'
import {
  fetchVillageBuyerIndicators, fetchDistrictRentVsPrice, fetchSouthParkEmployees,
  fetchMarketSeries, fetchLowUsageByDistrict, fetchStockAgeByDistrict,
  fetchTransfersByDistrict, fetchTransfersCitySeries,
} from '@/lib/queries/potentialBuyers'
import type { Row } from '@/lib/queries/client'

/**
 * 戶政資料的村里名含造字區字元，前端字型無法顯示 → 換成通用字
 * U+FB56F = 塭（安南區 塭南里、公塭里）
 */
const PUA_CHARS: Record<string, string> = { '\u{FB56F}': '塭' }
function fixName(s: string): string {
  return Array.from(s).map(c => PUA_CHARS[c] ?? c).join('')
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))

/** 附加資訊查詢失敗（如資料表尚未建立）時回傳空陣列，不影響主頁面 */
const optional = (label: string, p: Promise<Row[]>) =>
  p.catch(err => { console.error(`[/api/potential-buyers] ${label}`, err); return [] as Row[] })

/** 房屋稅籍屋齡十級 → 五級（與 HouseAgeChart 的分級一致） */
const AGE_BANDS: Record<string, string[]> = {
  pctLt10:  ['stock_age_0_1', 'stock_age_1_5', 'stock_age_5_10'],
  pct10_20: ['stock_age_10_15', 'stock_age_15_20'],
  pct20_30: ['stock_age_20_25', 'stock_age_25_30'],
  pct30_40: ['stock_age_30_40'],
  pctGe40:  ['stock_age_40_50', 'stock_age_50p'],
}

export async function GET() {
  try {
    const [rows, rentRows, parkRows, seriesRows, lowRows, stockRows, transferRows, transferCity] = await Promise.all([
      fetchVillageBuyerIndicators(),
      fetchDistrictRentVsPrice(),
      optional('南科', fetchSouthParkEmployees()),
      optional('市場序列', fetchMarketSeries()),
      optional('低度使用', fetchLowUsageByDistrict()),
      optional('稅籍屋齡', fetchStockAgeByDistrict()),
      optional('建物移轉', fetchTransfersByDistrict()),
      optional('建物移轉序列', fetchTransfersCitySeries()),
    ])

    // 房屋稅籍屋齡：每區一列，十級合併為五級百分比
    const stockByArea = new Map<string, Record<string, number>>()
    for (const r of stockRows) {
      const key = String(r.area)
      const m = stockByArea.get(key) ?? {}
      m[String(r.indicator)] = Number(r.value)
      stockByArea.set(key, m)
    }
    const stockPeriod = stockRows.length ? String(stockRows[0].period) : null
    const houseAgeRows = [...stockByArea.entries()]
      .filter(([area]) => area !== '臺南市')
      .map(([area, m]) => {
        const units = m.stock_units ?? 0
        const pct = Object.fromEntries(Object.entries(AGE_BANDS).map(([k, cols]) =>
          [k, units ? cols.reduce((s, c) => s + (m[c] ?? 0), 0) / units * 100 : 0]))
        return { district: area, n: units, avgAge: m.stock_avg_age ?? null, ...pct }
      })
    const cityStock = stockByArea.get('臺南市')
    const villages = rows.map(r => ({
      code:     String(r.village_code),
      district: String(r.district),
      village:  fixName(String(r.village)),
      firstBuyer: Number(r.first_buyer_index),
      upgrader:   Number(r.upgrader_index),
      // 各指標全市百分位（0–100）
      p: {
        cohortYoung: Number(r.p_cohort_young), cohortMid: Number(r.p_cohort_mid),
        share2534:   Number(r.p_share_25_34),  share3544: Number(r.p_share_35_44),
        marriage:    Number(r.p_marriage),     birth:     Number(r.p_birth),
        income:      Number(r.p_income),       social:    Number(r.p_social),
      },
      // 原始值（率皆為每千人・年；所得單位千元）
      raw: {
        pop: Number(r.pop_total), households: Number(r.households),
        share2534: num(r.share_25_34), share3544: num(r.share_35_44),
        cohortYoung: num(r.cohort_young_k), cohortMid: num(r.cohort_mid_k),
        marriage: num(r.marriage_k), birth: num(r.birth_k),
        social: num(r.social_k), income: num(r.income_median),
        hhSize: num(r.hh_size), splitSpeed: num(r.split_speed_pct),
        netOtherCity: num(r.net_other_city_k), netOtherTown: num(r.net_other_town_k),
        netSameTown: num(r.net_same_town_k),
        women1549: num(r.women_15_49), women1549Share: num(r.women_15_49_share),
        divorces: num(r.divorces), divorceKDistrict: num(r.divorce_k_district),
        // 戶政年資料（edu_year／hh_year）、平台村里季資料（hhq_period）
        eduUnivPlus: num(r.edu_univ_plus_share), eduGrad: num(r.edu_grad_share),
        singleHh: num(r.single_hh_share),
        headAvgAge: num(r.head_avg_age), head2645: num(r.head_26_45_share), head2645Chg: num(r.head_26_45_share_chg),
        head65p: num(r.head_65p_share),
        multiHh: num(r.multi_hh_share), multiHhChg: num(r.multi_hh_share_chg),
        soloDwelling: num(r.solo_dwelling_share), dwellingsGrowth: num(r.dwellings_growth_pct),
      },
      lowConfidence:    Boolean(r.low_confidence),
      cohortMissing:    Boolean(r.cohort_missing),
      incomeFromParent: Boolean(r.income_from_parent),
    }))

    return NextResponse.json({
      meta: {
        dataMonth:     rows.length ? String(rows[0].data_month) : null,       // 人口資料月份（西元 YYYY-MM）
        incomeTaxYear: rows.length ? Number(rows[0].income_tax_year) : null,  // 所得年度（民國）
        eduYear:   rows.find(r => r.edu_year != null)?.edu_year ?? null,      // 教育程度年度（民國）
        hhYear:    rows.find(r => r.hh_year != null)?.hh_year ?? null,        // 戶數結構年度
        hhqPeriod: rows.find(r => r.hhq_period != null)?.hhq_period ?? null,  // 戶長年齡等季別
      },
      villages,
      // 行政區每坪租金／房價中位數；月付比由前端依利率假設計算
      rent: {
        rentPeriod: rentRows.length ? `${rentRows[0].rent_from}～${rentRows[0].rent_to}` : null,
        salePeriod: rentRows.length ? `${rentRows[0].sale_from}～${rentRows[0].sale_to}` : null,
        rows: rentRows.map(r => ({
          district:  String(r.district),
          btype:     String(r.btype) as '大樓華廈' | '透天',
          nRent:     Number(r.n_rent),
          rentPing:  num(r.rent_ping),   // 元／坪・月
          nSale:     Number(r.n_sale),
          pricePing: num(r.price_ping),  // 元／坪
        })),
      },
      // 行政區住宅存量屋齡（房屋稅籍，最新一季）
      houseAge: {
        period: stockPeriod,
        cityAvgAge: cityStock?.stock_avg_age ?? null,
        rows: houseAgeRows,
      },
      // 縣市級市場序列（臺南市 vs 全國）：indicator → [{ period, area, value }]
      market: seriesRows.map(r => ({
        indicator: String(r.indicator), area: String(r.area), period: String(r.period), value: Number(r.value),
      })),
      // 低度使用（用電）住宅：最新一期 vs 前一年同期
      lowUsage: lowRows.map(r => ({
        indicator: String(r.indicator), level: String(r.area_level), area: String(r.area),
        period: String(r.period), isLatest: Boolean(r.is_latest), value: Number(r.value),
      })),
      // 建物移轉：各區近 12 月 vs 前 12 月；全市月序列
      transfers: {
        latestMonth: transferRows.length ? String(transferRows[0].latest_month) : null,
        rows: transferRows.map(r => ({
          district: String(r.area),
          first12m: num(r.first_12m), firstPrev12m: num(r.first_prev_12m),
          sale12m: num(r.sale_12m), salePrev12m: num(r.sale_prev_12m),
        })),
        city: transferCity.map(r => ({
          period: String(r.period), first: num(r.first_transfer), sale: num(r.sale_transfer),
        })),
      },
      // 南科從業員工：sub_park = '合計' 為園區總數，其餘為子園區（臺南園區、高雄園區…）
      southPark: parkRows.map(r => ({
        ym:       String(r.ym),
        subPark:  String(r.sub_park),
        total:    Number(r.total),
        phd:      num(r.phd),
        master:   num(r.master),
      })),
    })
  } catch (err) {
    console.error('[/api/potential-buyers]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

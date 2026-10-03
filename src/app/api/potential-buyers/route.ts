import { NextResponse } from 'next/server'
import {
  fetchVillageBuyerIndicators, fetchDistrictRentVsPrice, fetchSouthParkEmployees, fetchDistrictHouseAge,
} from '@/lib/queries/potentialBuyers'

/**
 * 戶政資料的村里名含造字區字元，前端字型無法顯示 → 換成通用字
 * U+FB56F = 塭（安南區 塭南里、公塭里）
 */
const PUA_CHARS: Record<string, string> = { '\u{FB56F}': '塭' }
function fixName(s: string): string {
  return Array.from(s).map(c => PUA_CHARS[c] ?? c).join('')
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))

export async function GET() {
  try {
    const [rows, rentRows, parkRows, ageRows] = await Promise.all([
      fetchVillageBuyerIndicators(),
      fetchDistrictRentVsPrice(),
      // 南科是附加資訊：查詢失敗（如資料表尚未建立）不影響主頁面
      fetchSouthParkEmployees().catch(err => { console.error('[/api/potential-buyers] 南科', err); return [] }),
      fetchDistrictHouseAge(),
    ])
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
      },
      lowConfidence:    Boolean(r.low_confidence),
      cohortMissing:    Boolean(r.cohort_missing),
      incomeFromParent: Boolean(r.income_from_parent),
    }))

    return NextResponse.json({
      meta: {
        dataMonth:     rows.length ? String(rows[0].data_month) : null,       // 人口資料月份（西元 YYYY-MM）
        incomeTaxYear: rows.length ? Number(rows[0].income_tax_year) : null,  // 所得年度（民國）
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
      // 行政區成交成屋屋齡結構（近 24 個月）
      houseAge: {
        period: ageRows.length ? `${ageRows[0].period_from}～${ageRows[0].period_to}` : null,
        rows: ageRows.map(r => ({
          district: String(r.district), n: Number(r.n), medianAge: num(r.median_age),
          pctLt10: Number(r.pct_lt10), pct10_20: Number(r.pct_10_20), pct20_30: Number(r.pct_20_30),
          pct30_40: Number(r.pct_30_40), pctGe40: Number(r.pct_ge40),
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

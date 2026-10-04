/**
 * 村里潛在客群指數查詢（/api/potential-buyers）
 * 來源：materialized view village_buyer_indicators
 *   定義見 supabase/migrations/20261003_village_buyer_indicators.sql
 *   由 scripts/fetch_ris_village.py、fetch_fia_income.py 匯入後自動 refresh
 * ⚠️ 此 view 已收回 anon 權限，只能經後端（service role）讀取
 */
import { cachedQuery, type Row } from './client'

/** 村里指標 SQL；v4 MV 尚未執行時改用不含新指數欄位的版本 */
const villageIndicatorSql = (v4: boolean) => `
    SELECT
      village_code, district, village, data_month, income_tax_year,
      first_buyer_index::float AS first_buyer_index,
      ${v4 ? 'new_home_index::float AS new_home_index, resale_index::float AS resale_index,' : ''}
      pop_total, households,
      share_25_34::float AS share_25_34, share_35_44::float AS share_35_44,
      cohort_young_k::float AS cohort_young_k, cohort_mid_k::float AS cohort_mid_k,
      marriage_k::float AS marriage_k, birth_k::float AS birth_k,
      social_k::float AS social_k, income_median,
      hh_size::float AS hh_size, split_speed_pct::float AS split_speed_pct,
      net_other_city_k::float AS net_other_city_k,
      net_other_town_k::float AS net_other_town_k,
      net_same_town_k::float  AS net_same_town_k,
      women_15_49, women_15_49_share::float AS women_15_49_share,
      divorces, divorce_k_district::float AS divorce_k_district,
      edu_year, edu_univ_plus_share::float AS edu_univ_plus_share, edu_grad_share::float AS edu_grad_share,
      hh_year, single_hh_share::float AS single_hh_share,
      hhq_period, head_avg_age::float AS head_avg_age,
      head_26_45_share::float AS head_26_45_share, head_26_45_share_chg::float AS head_26_45_share_chg,
      head_65p_share::float AS head_65p_share,
      multi_hh_share::float AS multi_hh_share, multi_hh_share_chg::float AS multi_hh_share_chg,
      solo_dwelling_share::float AS solo_dwelling_share, dwellings_growth_pct::float AS dwellings_growth_pct,
      low_confidence, cohort_missing, income_from_parent
    FROM village_buyer_indicators
    ORDER BY village_code
  `

/**
 * 村里潛在客群指標（MV）
 * 新版 MV（v4，含換新屋／換二手指數）尚未執行時自動退回舊欄位，避免部署順序造成頁面全掛；
 * 前端會以相同公式自行計算三個指數，所以退回時畫面仍正常
 */
export async function fetchVillageBuyerIndicators(): Promise<Row[]> {
  try {
    return await cachedQuery(villageIndicatorSql(true))
  } catch (err) {
    console.warn('[fetchVillageBuyerIndicators] v4 欄位不存在，改用舊版查詢', err)
    return cachedQuery(villageIndicatorSql(false))
  }
}

/**
 * 行政區 租金 vs 房價（每坪中位數）→ 前端依利率假設換算「租金／房貸月付比」
 * - 租金：rentals 整棟(戶)出租、住家用、不含車位；排除社會住宅包租代管（租金約低於市價 10–20%）
 *   一般市場租賃樣本少 → 取 24 個月
 * - 房價：transactions 成屋（不含預售）、排除特殊關係交易，取 12 個月
 * - 兩者都以「最新日期所在月的前一個月」為終點，避開最近月份申報未完整
 * - 房屋類型分「大樓華廈」（住宅大樓 + 華廈）與「透天」
 */
export function fetchDistrictRentVsPrice(): Promise<Row[]> {
  return cachedQuery(`
    WITH
    rw AS (SELECT (date_trunc('month', max(rental_date)) - interval '1 month')::date AS end_d FROM rentals),
    tw AS (SELECT (date_trunc('month', max(transaction_date)) - interval '1 month')::date AS end_d FROM transactions),
    rent AS (
      SELECT r.district,
             CASE WHEN r.building_type LIKE '透天%' THEN '透天' ELSE '大樓華廈' END AS btype,
             r.monthly_rent / (r.building_area_sqm / 3.3058) AS rent_ping
      FROM rentals r, rw
      WHERE r.rental_date >= rw.end_d - interval '24 months' AND r.rental_date < rw.end_d
        AND r.rental_type = '整棟(戶)出租'
        AND r.main_use IN ('住家用', '集合住宅')
        AND (r.building_type LIKE '住宅大樓%' OR r.building_type LIKE '華廈%' OR r.building_type LIKE '透天%')
        AND coalesce(r.rental_service, '') NOT LIKE '社會住宅%'
        AND coalesce(r.parking_type, '') = ''
        AND r.monthly_rent > 0 AND r.building_area_sqm >= 10
    ),
    sale AS (
      SELECT t.district,
             CASE WHEN t.building_type LIKE '透天%' THEN '透天' ELSE '大樓華廈' END AS btype,
             t.unit_price_sqm * 3.3058 AS price_ping
      FROM transactions t, tw
      WHERE t.transaction_date >= tw.end_d - interval '12 months' AND t.transaction_date < tw.end_d
        AND NOT t.is_presale
        AND (t.building_type LIKE '住宅大樓%' OR t.building_type LIKE '華廈%' OR t.building_type LIKE '透天%')
        AND coalesce(t.notes, '') NOT LIKE '%特殊關係%'
        AND t.unit_price_sqm > 0
    ),
    r_agg AS (
      SELECT district, btype, count(*) AS n_rent,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY rent_ping) AS rent_ping
      FROM rent GROUP BY 1, 2
    ),
    s_agg AS (
      SELECT district, btype, count(*) AS n_sale,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY price_ping) AS price_ping
      FROM sale GROUP BY 1, 2
    )
    SELECT coalesce(r.district, s.district) AS district,
           coalesce(r.btype, s.btype)       AS btype,
           coalesce(r.n_rent, 0)            AS n_rent,
           round(r.rent_ping::numeric, 0)::float  AS rent_ping,
           coalesce(s.n_sale, 0)            AS n_sale,
           round(s.price_ping::numeric, 0)::float AS price_ping,
           (SELECT to_char(end_d - interval '24 months', 'YYYY-MM') FROM rw) AS rent_from,
           (SELECT to_char(end_d - interval '1 day', 'YYYY-MM') FROM rw)     AS rent_to,
           (SELECT to_char(end_d - interval '12 months', 'YYYY-MM') FROM tw) AS sale_from,
           (SELECT to_char(end_d - interval '1 day', 'YYYY-MM') FROM tw)     AS sale_to
    FROM r_agg r FULL JOIN s_agg s USING (district, btype)
    WHERE coalesce(r.district, s.district) <> ''
    ORDER BY 1, 2
  `)
}

/**
 * 南科從業員工數（月）：園區合計（統計資料庫，105/11 起）＋ 子園區（開放資料，逐月累積）
 * 資料表 science_park_employees_monthly 由 scripts/fetch_science_park.py 匯入
 */
export function fetchSouthParkEmployees(): Promise<Row[]> {
  return cachedQuery(`
    SELECT ym, sub_park, total, phd, master, bachelor
    FROM science_park_employees_monthly
    WHERE park = '南部科學園區'
    ORDER BY ym_date, sub_park
  `)
}

/* ── 住宅市場統計（housing_market_stats，由 scripts/fetch_housing_stats.py 匯入） ── */

/** 縣市級時間序列：負擔能力、新增房貸條件、五大銀行房貸利率、家庭收支（臺南市與全國） */
export function fetchMarketSeries(): Promise<Row[]> {
  return cachedQuery(`
    SELECT indicator, area, period, value::float AS value
    FROM housing_market_stats
    WHERE indicator IN ('price_income_ratio', 'mortgage_burden_pct', 'new_mortgage_rate',
                        'new_mortgage_ltv', 'new_mortgage_term', 'bank5_mortgage_rate',
                        'fies_disposable_income', 'fies_consumption')
      AND area_level IN ('nation', 'city')
    ORDER BY period_date, indicator, area
  `)
}

/** 行政區低度使用（用電）住宅：最新一期與前一年同期（上下半年用電季節不同，只能同期比） */
export function fetchLowUsageByDistrict(): Promise<Row[]> {
  return cachedQuery(`
    WITH p AS (
      SELECT max(period_date) AS d FROM housing_market_stats WHERE indicator = 'low_usage_rate'
    )
    SELECT h.indicator, h.area_level, h.area, h.period,
           (h.period_date = p.d) AS is_latest, h.value::float AS value
    FROM housing_market_stats h, p
    WHERE h.indicator IN ('low_usage_rate', 'low_usage_units')
      AND h.period_date IN (p.d, (p.d - interval '1 year')::date)
    ORDER BY h.area
  `)
}

/** 行政區住宅存量屋齡（房屋稅籍，最新一季） */
export function fetchStockAgeByDistrict(): Promise<Row[]> {
  return cachedQuery(`
    WITH p AS (
      SELECT max(period_date) AS d FROM housing_market_stats WHERE indicator = 'stock_units'
    )
    SELECT h.indicator, h.area_level, h.area, h.period, h.value::float AS value
    FROM housing_market_stats h, p
    WHERE h.indicator LIKE 'stock\\_%' AND h.period_date = p.d
      AND h.area_level IN ('city', 'district')
  `)
}

/**
 * 建物移轉（台南開放資料，行政區・月）
 * - 各區近 12 個月與前 12 個月合計：新屋交屋（第一次移轉，六層以下 + 七層以上）、買賣移轉建物件數
 * - 全市月序列：各區加總（資料集沒有全市合計列）
 */
export function fetchTransfersByDistrict(): Promise<Row[]> {
  return cachedQuery(`
    WITH p AS (
      SELECT max(period_date) AS d FROM housing_market_stats WHERE indicator = 'sale_transfer_buildings'
    )
    SELECT h.area,
           sum(h.value) FILTER (WHERE h.indicator IN ('first_transfer_low', 'first_transfer_high')
                                  AND h.period_date > (p.d - interval '12 months'))::float AS first_12m,
           sum(h.value) FILTER (WHERE h.indicator IN ('first_transfer_low', 'first_transfer_high')
                                  AND h.period_date <= (p.d - interval '12 months')
                                  AND h.period_date > (p.d - interval '24 months'))::float AS first_prev_12m,
           sum(h.value) FILTER (WHERE h.indicator = 'sale_transfer_buildings'
                                  AND h.period_date > (p.d - interval '12 months'))::float AS sale_12m,
           sum(h.value) FILTER (WHERE h.indicator = 'sale_transfer_buildings'
                                  AND h.period_date <= (p.d - interval '12 months')
                                  AND h.period_date > (p.d - interval '24 months'))::float AS sale_prev_12m,
           (SELECT to_char(d, 'YYYY-MM') FROM p) AS latest_month
    FROM housing_market_stats h, p
    WHERE h.area_level = 'district'
      AND h.indicator IN ('first_transfer_low', 'first_transfer_high', 'sale_transfer_buildings')
      AND h.period_date > (p.d - interval '24 months')
    GROUP BY h.area
    ORDER BY h.area
  `)
}

export function fetchTransfersCitySeries(): Promise<Row[]> {
  return cachedQuery(`
    SELECT period,
           sum(value) FILTER (WHERE indicator IN ('first_transfer_low', 'first_transfer_high'))::float AS first_transfer,
           sum(value) FILTER (WHERE indicator = 'sale_transfer_buildings')::float AS sale_transfer
    FROM housing_market_stats
    WHERE area_level = 'district'
      AND indicator IN ('first_transfer_low', 'first_transfer_high', 'sale_transfer_buildings')
    GROUP BY period, period_date
    ORDER BY period_date
  `)
}

/** 南科產業別從業員工（年；science_park_industry_yearly，由 fetch_science_park.py 匯入） */
export function fetchSouthParkIndustry(): Promise<Row[]> {
  return cachedQuery(`
    SELECT year, industry, employees
    FROM science_park_industry_yearly
    WHERE park = '南部科學園區'
    ORDER BY year, industry
  `)
}

/**
 * 臺南市人口推估（最新版次；population_projection，由 fetch_population_projection.py 匯入）
 * ⚠️ 官方只以出生、死亡推估，未計入遷徙
 */
export function fetchPopulationProjection(): Promise<Row[]> {
  return cachedQuery(`
    WITH e AS (
      SELECT max(edition) AS edition FROM population_projection
    ), y0 AS (
      SELECT min(year) AS y FROM population_projection, e WHERE population_projection.edition = e.edition
    )
    SELECT p.edition, p.scope, p.area, p.year, p.pop_total,
           p.age_25_34, p.age_35_44, p.age_65_plus
    FROM population_projection p, e, y0
    WHERE p.edition = e.edition
      -- 全市保留每一年（畫趨勢）；各區只取基準年與 +5、+10、+20 年（表格用），減少傳輸量
      AND (p.area = '臺南市' OR p.year IN (y0.y, y0.y + 5, y0.y + 10, y0.y + 20))
    ORDER BY p.area, p.scope, p.year
  `)
}

/**
 * 國中小學生數（school_students_yearly，由 fetch_school_poi.py 匯入）
 * 行政區 × 學年 × 學制：入學年級學生數（國小 1 年級、國中 7 年級）、總學生數、校數
 */
export function fetchSchoolByDistrict(): Promise<Row[]> {
  return cachedQuery(`
    SELECT school_year, level, district,
           sum(entry_students)::int AS entry, sum(total_students)::int AS total, count(*)::int AS schools
    FROM school_students_yearly
    WHERE district IS NOT NULL
    GROUP BY school_year, level, district
    ORDER BY school_year, level, district
  `)
}

/** 各校最新學年與 5 年前的入學年級學生數（找新生成長最多的學校） */
export function fetchSchoolGrowth(): Promise<Row[]> {
  return cachedQuery(`
    WITH y AS (SELECT level, max(school_year) AS y1 FROM school_students_yearly GROUP BY level)
    SELECT s.level, s.school_code, s.school_name, s.district, s.is_public,
           y.y1 AS year_now, y.y1 - 5 AS year_then,
           max(s.entry_students) FILTER (WHERE s.school_year = y.y1)     AS entry_now,
           max(s.entry_students) FILTER (WHERE s.school_year = y.y1 - 5) AS entry_then,
           max(s.total_students) FILTER (WHERE s.school_year = y.y1)     AS total_now
    FROM school_students_yearly s JOIN y USING (level)
    WHERE s.school_year IN (y.y1, y.y1 - 5)
    GROUP BY s.level, s.school_code, s.school_name, s.district, s.is_public, y.y1
    HAVING max(s.entry_students) FILTER (WHERE s.school_year = y.y1) IS NOT NULL
  `)
}

/** 生活機能點位（OSM 最新批次）：村里 × 類別點數 */
export function fetchPoiByVillage(): Promise<Row[]> {
  return cachedQuery(`
    SELECT village_code, category, count(*)::int AS n
    FROM poi_points
    WHERE village_code IS NOT NULL
      AND fetched_at = (SELECT max(fetched_at) FROM poi_points)
    GROUP BY village_code, category
  `)
}

/**
 * 產業與就業（housing_market_stats，由 fetch_industry_census.py 匯入）
 * - 110 年工業及服務業普查：各行業從業員工、全行業場所單位數與生產總額、職員（監督及專技人員）
 * - SEGIS 行政區工商家數：只取最新一期
 */
export function fetchIndustryStats(): Promise<Row[]> {
  // 明確列出指標（走主鍵索引）；LIKE + OR 在 6 萬筆上會全表掃描而逾時
  const census = ['all', ...INDUSTRY_KEYS].map(k => `'census_employees:${k}'`)
    .concat(["'census_units:all'", "'census_output:all'", "'census_officers'"])
  const biz = ['all', ...INDUSTRY_KEYS, 'agriculture', 'mining', 'public'].map(k => `'biz_count:${k}'`)
  return cachedQuery(`
    SELECT indicator, area_level, area, period, value::float AS value
    FROM housing_market_stats
    WHERE indicator IN (${census.join(', ')})
    UNION ALL
    SELECT indicator, area_level, area, period, value::float AS value
    FROM housing_market_stats
    WHERE indicator IN (${biz.join(', ')})
      AND period_date = (SELECT max(period_date) FROM housing_market_stats WHERE indicator = 'biz_count:all')
  `)
}

/** 普查與工商家數共同的大行業代號（對應 scripts/fetch_industry_census.py） */
const INDUSTRY_KEYS = ['mfg', 'electricity', 'water', 'construction', 'trade', 'transport', 'accommodation',
  'ict', 'finance', 'realestate', 'professional', 'support', 'education', 'health', 'arts', 'other']

/**
 * 住宅供給（臺南市工務局，由 fetch_housing_stats.py --only construction 匯入）
 * - construction_start_units：住宅開工戶數（行政區・年，112 年起）
 * - usage_permit_units：住宅使用執照戶數（行政區・年，100～111 年；官方逐案資料停在 112 年 4 月）
 */
export function fetchConstructionStats(): Promise<Row[]> {
  return cachedQuery(`
    SELECT indicator, area_level, area, period, value::float AS value
    FROM housing_market_stats
    WHERE indicator IN ('construction_start_units', 'usage_permit_units')
    ORDER BY period_date
  `)
}

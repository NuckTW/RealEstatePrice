/**
 * 村里潛在客群指數查詢（/api/potential-buyers）
 * 來源：materialized view village_buyer_indicators
 *   定義見 supabase/migrations/20261003_village_buyer_indicators.sql
 *   由 scripts/fetch_ris_village.py、fetch_fia_income.py 匯入後自動 refresh
 * ⚠️ 此 view 已收回 anon 權限，只能經後端（service role）讀取
 */
import { cachedQuery, type Row } from './client'

export function fetchVillageBuyerIndicators(): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      village_code, district, village, data_month, income_tax_year,
      first_buyer_index::float AS first_buyer_index,
      upgrader_index::float    AS upgrader_index,
      p_cohort_young::float AS p_cohort_young, p_cohort_mid::float AS p_cohort_mid,
      p_share_25_34::float  AS p_share_25_34,  p_share_35_44::float AS p_share_35_44,
      p_marriage::float     AS p_marriage,     p_birth::float       AS p_birth,
      p_income::float       AS p_income,       p_social::float      AS p_social,
      pop_total, households,
      share_25_34::float AS share_25_34, share_35_44::float AS share_35_44,
      cohort_young_k::float AS cohort_young_k, cohort_mid_k::float AS cohort_mid_k,
      marriage_k::float AS marriage_k, birth_k::float AS birth_k,
      social_k::float AS social_k, income_median,
      hh_size::float AS hh_size, split_speed_pct::float AS split_speed_pct,
      net_other_city_k::float AS net_other_city_k,
      net_other_town_k::float AS net_other_town_k,
      net_same_town_k::float  AS net_same_town_k,
      low_confidence, cohort_missing, income_from_parent
    FROM village_buyer_indicators
    ORDER BY village_code
  `)
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

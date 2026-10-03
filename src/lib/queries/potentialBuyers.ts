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

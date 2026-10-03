-- ============================================================
-- 潛在客群分析｜村里潛在客群指數（首購／換屋）
-- ⚠️ 請在 Supabase SQL Editor 手動執行（確認後再跑）
-- 前置：20261002_potential_buyers.sql 已執行且資料已匯入
-- 每月匯入後執行：SELECT refresh_village_buyer_indicators();
-- 規劃文件：docs/potential-buyer-analysis-plan.md §7.1
--
-- 計分方式：各指標轉全市百分位（0–100）後加權相加
--   首購指數 = 世代淨移入(25–34) 30 + 25–34 占比 20 + 結婚率 20 + 所得 20 + 社會增加 10
--   換屋指數 = 世代淨移入(35–44) 20 + 35–44 占比 20 + 出生率 20 + 所得 30 + 社會增加 10
-- 時間窗：最新月份往前 12 個月
-- 分戶速度、戶量、跨縣市／市內他區淨移入：僅供前端顯示，不計分
-- v2（2026-10-03）：新增育齡婦女（15–49 歲女性）、離婚數（僅顯示，不計分）
--   離婚率村里間差異經檢定全為隨機雜訊（村里間變異 ≤ Poisson 雜訊）→ 只提供村里離婚對數與行政區離婚率
--   本檔可重複執行（DROP 後重建）
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS village_buyer_indicators;

CREATE MATERIALIZED VIEW village_buyer_indicators AS
WITH
-- 時間窗：(start_date, end_date]，共 12 個月
win AS (
  SELECT max(ym_date) AS end_date,
         (max(ym_date) - interval '12 months')::date AS start_date
  FROM village_population_monthly
),
cur AS (   -- 最新月份的人口快照（= 目前存在的村里）
  SELECT p.* FROM village_population_monthly p, win WHERE p.ym_date = win.end_date
),
prev AS (  -- 12 個月前的人口快照（新設里沒有 → 世代指標為 NULL）
  SELECT p.* FROM village_population_monthly p, win WHERE p.ym_date = win.start_date
),
pop_w AS ( -- 時間窗內平均人口（作為率的分母，單位：人年）
  SELECT p.village_code, avg(p.pop_total)::numeric AS avg_pop, count(*) AS n_months
  FROM village_population_monthly p, win
  WHERE p.ym_date > win.start_date AND p.ym_date <= win.end_date
  GROUP BY p.village_code
),
vital_w AS (
  SELECT v.village_code, sum(v.births) AS births, sum(v.marriages) AS marriages,
         sum(v.divorces) AS divorces, count(*) AS n_months
  FROM village_vital_monthly v, win
  WHERE v.ym_date > win.start_date AND v.ym_date <= win.end_date
  GROUP BY v.village_code
),
mig_w AS (
  SELECT m.village_code,
         -- 村里社會增加 = 跨區淨移入 + 同區跨里淨移入（in_total 不含同區跨里，需加回）
         sum(m.in_total - m.out_total + coalesce(m.in_same_town, 0) - coalesce(m.out_same_town, 0)) AS net_social,
         sum(m.in_other_city - m.out_other_city) AS net_other_city,
         sum(m.in_other_town - m.out_other_town) AS net_other_town,
         sum(coalesce(m.in_same_town, 0) - coalesce(m.out_same_town, 0)) AS net_same_town,
         count(*) AS n_months
  FROM village_migration_monthly m, win
  WHERE m.ym_date > win.start_date AND m.ym_date <= win.end_date
  GROUP BY m.village_code
),
-- 世代淨移入：同一批人一年後的人數變化（死亡在此年齡層可忽略，差額 ≈ 淨遷移）
-- ⚠️ Postgres 陣列從 1 起算：ages[a + 1] = a 歲
cohort AS (
  SELECT c.village_code,
         (SELECT sum(c.ages_m[i] + c.ages_f[i]) FROM generate_series(27, 36) i)   -- 今年 26–35 歲
       - (SELECT sum(p.ages_m[i] + p.ages_f[i]) FROM generate_series(26, 35) i)   -- 去年 25–34 歲
         AS young_net,
         (SELECT sum(p.ages_m[i] + p.ages_f[i]) FROM generate_series(26, 35) i) AS young_base,
         (SELECT sum(c.ages_m[i] + c.ages_f[i]) FROM generate_series(37, 46) i)   -- 今年 36–45 歲
       - (SELECT sum(p.ages_m[i] + p.ages_f[i]) FROM generate_series(36, 45) i)   -- 去年 35–44 歲
         AS mid_net,
         (SELECT sum(p.ages_m[i] + p.ages_f[i]) FROM generate_series(36, 45) i) AS mid_base
  FROM cur c JOIN prev p USING (village_code)
),
-- 所得：最新年度；已分割的新里沿用母里數值（官田區 東西庄里 → 東庄里、西庄里）
inc_latest AS (
  SELECT max(tax_year) AS tax_year FROM village_income_yearly WHERE village_code IS NOT NULL
),
inc_parent(village_code, district, parent_village) AS (
  VALUES ('67000100017', '官田區', '東西庄里'),
         ('67000100018', '官田區', '東西庄里')
),
inc AS (
  SELECT i.village_code, i.income_median, i.tax_year, false AS income_from_parent
  FROM village_income_yearly i JOIN inc_latest l USING (tax_year)
  WHERE i.village_code IS NOT NULL
  UNION ALL
  SELECT ip.village_code, i.income_median, i.tax_year, true
  FROM inc_parent ip
  JOIN village_income_yearly i ON i.district = ip.district AND i.village = ip.parent_village
  JOIN inc_latest l USING (tax_year)
),
-- 原始指標（率皆為「每千人・年」，月份不足 12 個月者年化）
base AS (
  SELECT
    c.village_code, vg.district, vg.village,
    c.pop_total, c.households,
    round(c.pop_total::numeric / nullif(c.households, 0), 3)                       AS hh_size,
    -- 育齡婦女：15–49 歲女性（ages_f[a + 1] = a 歲）
    (SELECT sum(c.ages_f[i]) FROM generate_series(16, 50) i)                       AS women_15_49,
    round((SELECT sum(c.ages_f[i]) FROM generate_series(16, 50) i)::numeric
          / nullif(c.pop_total, 0) * 100, 2)                                       AS women_15_49_share,
    round((c.households::numeric / nullif(p.households, 0)
         - c.pop_total::numeric / nullif(p.pop_total, 0)) * 100, 3)               AS split_speed_pct,
    round(c.age_25_34::numeric / nullif(c.pop_total, 0) * 100, 2)                  AS share_25_34,
    round(c.age_35_44::numeric / nullif(c.pop_total, 0) * 100, 2)                  AS share_35_44,
    round(co.young_net::numeric / nullif(co.young_base, 0) * 1000, 2)              AS cohort_young_k,
    round(co.mid_net::numeric   / nullif(co.mid_base, 0)   * 1000, 2)              AS cohort_mid_k,
    co.young_net AS cohort_young_n, co.mid_net AS cohort_mid_n,
    vw.marriages, vw.births, vw.divorces,
    -- 人年曝露量：平均人口 × 月數 / 12
    pw.avg_pop * vw.n_months / 12.0                                                AS exposure_vital,
    round(mw.net_social     / nullif(pw.avg_pop, 0) * 1000 * 12.0 / mw.n_months, 2) AS social_k,
    round(mw.net_other_city / nullif(pw.avg_pop, 0) * 1000 * 12.0 / mw.n_months, 2) AS net_other_city_k,
    round(mw.net_other_town / nullif(pw.avg_pop, 0) * 1000 * 12.0 / mw.n_months, 2) AS net_other_town_k,
    round(mw.net_same_town  / nullif(pw.avg_pop, 0) * 1000 * 12.0 / mw.n_months, 2) AS net_same_town_k,
    inc.income_median, inc.tax_year AS income_tax_year, coalesce(inc.income_from_parent, false) AS income_from_parent
  FROM cur c
  JOIN villages vg USING (village_code)
  LEFT JOIN prev p     USING (village_code)
  LEFT JOIN cohort co  USING (village_code)
  LEFT JOIN pop_w pw   USING (village_code)
  LEFT JOIN vital_w vw USING (village_code)
  LEFT JOIN mig_w mw   USING (village_code)
  LEFT JOIN inc        USING (village_code)
),
-- 結婚率、出生率：Empirical Bayes 往行政區平均收縮
--   收縮後率 = (事件數 + M × 行政區率) / (人年 + M)
--   M ≈ 7,000 人年：由 11409–11508 資料以動差法估計（結婚 6,642、出生 7,540），
--   代表村里間差異多半是隨機雜訊，人口 2,000 的里約只保留 22% 自身訊號
dist_rate AS (
  SELECT district,
         sum(marriages)::numeric / nullif(sum(exposure_vital), 0) AS marr_rate,
         sum(births)::numeric    / nullif(sum(exposure_vital), 0) AS birth_rate,
         sum(divorces)::numeric  / nullif(sum(exposure_vital), 0) AS divorce_rate
  FROM base GROUP BY district
),
shrunk AS (
  SELECT b.*,
         round((b.marriages + 7000 * d.marr_rate)  / (b.exposure_vital + 7000) * 1000, 3) AS marriage_k,
         round((b.births    + 7000 * d.birth_rate) / (b.exposure_vital + 7000) * 1000, 3) AS birth_k,
         round(d.divorce_rate * 1000, 3) AS divorce_k_district
  FROM base b JOIN dist_rate d USING (district)
),
-- 百分位（0–100）：NULL 不參與排名，給中性值 50
pct AS (
  SELECT s.*,
    CASE WHEN cohort_young_k IS NULL THEN 50
         ELSE percent_rank() OVER (PARTITION BY cohort_young_k IS NULL ORDER BY cohort_young_k) * 100 END AS p_cohort_young,
    CASE WHEN cohort_mid_k IS NULL THEN 50
         ELSE percent_rank() OVER (PARTITION BY cohort_mid_k IS NULL ORDER BY cohort_mid_k) * 100 END     AS p_cohort_mid,
    percent_rank() OVER (ORDER BY share_25_34) * 100                                                     AS p_share_25_34,
    percent_rank() OVER (ORDER BY share_35_44) * 100                                                     AS p_share_35_44,
    percent_rank() OVER (ORDER BY marriage_k) * 100                                                      AS p_marriage,
    percent_rank() OVER (ORDER BY birth_k) * 100                                                         AS p_birth,
    CASE WHEN social_k IS NULL THEN 50
         ELSE percent_rank() OVER (PARTITION BY social_k IS NULL ORDER BY social_k) * 100 END             AS p_social,
    CASE WHEN income_median IS NULL THEN 50
         ELSE percent_rank() OVER (PARTITION BY income_median IS NULL ORDER BY income_median) * 100 END   AS p_income
  FROM shrunk s
)
SELECT
  village_code, district, village,
  (SELECT to_char(end_date, 'YYYY-MM') FROM win) AS data_month,   -- 人口資料月份（西元）
  income_tax_year,                                                -- 所得資料年度（民國，落後約 2–3 年）
  -- 指數
  round((0.30 * p_cohort_young + 0.20 * p_share_25_34 + 0.20 * p_marriage
       + 0.20 * p_income + 0.10 * p_social)::numeric, 1)          AS first_buyer_index,
  round((0.20 * p_cohort_mid + 0.20 * p_share_35_44 + 0.20 * p_birth
       + 0.30 * p_income + 0.10 * p_social)::numeric, 1)          AS upgrader_index,
  -- 各指標百分位
  round(p_cohort_young::numeric, 1) AS p_cohort_young, round(p_cohort_mid::numeric, 1) AS p_cohort_mid,
  round(p_share_25_34::numeric, 1)  AS p_share_25_34,  round(p_share_35_44::numeric, 1) AS p_share_35_44,
  round(p_marriage::numeric, 1)     AS p_marriage,     round(p_birth::numeric, 1)       AS p_birth,
  round(p_income::numeric, 1)       AS p_income,       round(p_social::numeric, 1)      AS p_social,
  -- 原始值
  pop_total, households, share_25_34, share_35_44,
  cohort_young_k, cohort_mid_k, cohort_young_n, cohort_mid_n,
  marriages, births, marriage_k, birth_k,
  social_k, income_median,
  -- 僅顯示、不計分
  hh_size, split_speed_pct, net_other_city_k, net_other_town_k, net_same_town_k,
  women_15_49, women_15_49_share,                      -- 育齡婦女人數、占總人口 %
  divorces, divorce_k_district,                        -- 近 12 個月離婚對數；所屬行政區離婚率（每千人・年）
  -- 品質旗標
  pop_total < 1000                AS low_confidence,   -- 小里：指標雜訊大，前端需提示
  cohort_young_k IS NULL          AS cohort_missing,   -- 12 個月內新設的里，世代指標以 50 代入
  income_from_parent,                                  -- 所得沿用分割前母里
  income_median IS NULL           AS income_missing
FROM pct;

-- REFRESH ... CONCURRENTLY 需要 unique index
CREATE UNIQUE INDEX idx_vbi_village ON village_buyer_indicators (village_code);

-- ------------------------------------------------------------
-- 權限：materialized view 不受 RLS 保護，PostgREST 預設會開放給 anon
-- → 明確收回，與其他潛在客群資料表一致（只能走後端 service role）
-- ------------------------------------------------------------
REVOKE ALL ON village_buyer_indicators FROM anon, authenticated;

-- 每月匯入後由腳本呼叫（service role）
CREATE OR REPLACE FUNCTION refresh_village_buyer_indicators()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY village_buyer_indicators;
$$;
REVOKE ALL ON FUNCTION refresh_village_buyer_indicators() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_village_buyer_indicators() TO service_role;

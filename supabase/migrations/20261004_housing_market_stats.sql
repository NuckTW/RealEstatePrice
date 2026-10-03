-- ============================================================
-- 潛在客群分析 第二期｜住宅市場統計（長格式通用表）
-- ⚠️ 請在 Supabase SQL Editor 手動執行（確認後再跑），執行後：
--   python3 scripts/fetch_housing_stats.py --backfill
-- 規劃文件：docs/potential-buyer-analysis-plan.md §7.3
--
-- 一列 = 一個指標 × 一個地區 × 一個期別；新指標不需改表
-- 目前收錄（只存臺南市與全國）：
--   內政部不動產資訊平台 pip.moi.gov.tw
--     price_income_ratio     房價所得比（倍）            縣市・季   E2010Data group03
--     mortgage_burden_pct    貸款負擔率（%）             縣市・季   E2010Data group04
--     bank5_mortgage_rate    五大銀行平均房貸利率（%）   全國・月   E2010Data group06
--     new_mortgage_rate      新增購置住宅貸款平均利率（%）縣市・季   E3030 5-3-2
--     new_mortgage_ltv       新增購置住宅貸款平均成數    縣市・季   E3030 5-3-3
--     new_mortgage_term      新增購置住宅貸款平均期數    縣市・季   E3030 5-3-4
--     low_usage_units / low_usage_rate  低度使用（用電）住宅 宅數／比率  行政區・半年  E1040 DataGroup3
--     stock_units / stock_avg_age / stock_age_*  房屋稅籍住宅數、平均屋齡、屋齡分級宅數  行政區・季  E4041 K02/T13
--   臺南市政府資料開放平台 data.tainan.gov.tw
--     first_transfer_low / first_transfer_high (+ _area)  建物第一次移轉 六層以下／七層以上 筆數、面積  行政區・月
--     sale_transfer_buildings (+ _area)                    不動產買賣 建物件數、面積                    行政區・月
-- ============================================================

CREATE TABLE IF NOT EXISTS housing_market_stats (
  indicator    text NOT NULL,
  area_level   text NOT NULL CHECK (area_level IN ('nation', 'city', 'district')),
  area         text NOT NULL,          -- '全國'／'臺南市'／行政區名（如 '東區'）
  period       text NOT NULL,          -- 季 '115Q1'、半年 '114H2'、月 '11508'（皆民國）
  period_type  text NOT NULL CHECK (period_type IN ('M', 'Q', 'H')),
  period_date  date NOT NULL,          -- 期別起始日（西元），排序與時間運算用
  value        numeric NOT NULL,
  source       text NOT NULL,          -- 'pip' | 'tainan_opendata'
  updated_at   timestamptz DEFAULT now(),
  PRIMARY KEY (indicator, area_level, area, period)
);
CREATE INDEX IF NOT EXISTS idx_hms_lookup ON housing_market_stats (indicator, area_level, period_date);

-- 與其他潛在客群資料表一致：啟用 RLS、不設公開 policy，前端只能經後端 API 讀取
ALTER TABLE housing_market_stats ENABLE ROW LEVEL SECURITY;

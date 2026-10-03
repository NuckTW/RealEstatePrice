-- ============================================================
-- 潛在客群分析｜村里戶政年資料 + 村里戶長年齡／宅內人口數／宅內戶數（季）
-- ⚠️ 請在 Supabase SQL Editor 手動執行（確認後再跑），執行後：
--   1. python3 scripts/fetch_village_household.py --backfill
--   2. 重建 village_buyer_indicators（20261003_village_buyer_indicators.sql v3 會讀這兩張表）
-- 規劃文件：docs/potential-buyer-analysis-plan.md §7.3
-- ============================================================

-- ------------------------------------------------------------
-- 戶政年資料（每年底；village_code = 戶政 district_code）
--   ODRP020 村里 15 歲以上教育程度（106 年起）
--   ODRP025 戶數結構：單獨生活戶、共同生活戶依人數（106 年起，113 年官方缺；106 年無代碼以里名對照）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS village_annual_stats (
  year            int  NOT NULL,          -- 民國年，如 114（114 年底資料）
  village_code    text NOT NULL REFERENCES villages(village_code),
  -- 教育程度（15 歲以上，畢業人數；肄業另計於 raw）
  edu_15up_total  int,
  edu_doctor      int,
  edu_master      int,
  edu_university  int,
  edu_college     int,                    -- 專科（二專 + 五專後二年）
  edu_senior      int,                    -- 高中 + 高職
  -- 戶數結構
  hh_single       int,                    -- 單獨生活戶
  hh_size_2       int,                    -- 共同生活戶 2 人
  hh_size_3       int,
  hh_size_4       int,
  hh_size_5       int,
  hh_size_6up     int,                    -- 6 人以上（6–9 人 + 10 人以上）
  hh_business     int,                    -- 共同事業戶
  raw_edu         jsonb,                  -- ODRP020 原始欄位（男女分列、含肄業），保留以利重算
  raw_hh          jsonb,                  -- ODRP025 原始欄位
  PRIMARY KEY (year, village_code)
);
CREATE INDEX IF NOT EXISTS idx_vannual_village ON village_annual_stats (village_code, year);

-- ------------------------------------------------------------
-- 內政部不動產資訊平台 E4041 主題下載（村里・季；平台 104Q3 起，匯入 105Q1 起）
--   K01/T06 戶數依戶長年齡區分(村里)
--   K01/T02 設有戶籍宅數依宅內人口數區分(村里)
--   K01/T04 設有戶籍宅數依宅內戶數區分(村里)
-- 平台以「臺南市＋區＋里」名稱標示 → 匯入時對 villages（含 name_aliases）換成 village_code；
-- 107 年整併前已消失的舊里對不上代碼，只略過那些里
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS village_household_quarterly (
  period          text NOT NULL,          -- '115Q2'
  period_date     date NOT NULL,          -- 季初（西元）
  village_code    text NOT NULL REFERENCES villages(village_code),
  -- 戶長年齡（T06）
  heads_total     int,                    -- 總戶長數
  head_avg_age    numeric(5,2),
  head_le25       int,                    -- 25 歲（含）以下
  head_25_35      int,                    -- 26–35 歲
  head_35_45      int,                    -- 36–45 歲
  head_45_55      int,
  head_55_65      int,
  head_65p        int,                    -- 65 歲以上
  -- 宅內人口數（T02）：設有戶籍的住宅
  dwellings       int,                    -- 設有戶籍宅數
  dw_avg_persons  numeric(5,2),
  dw_p1           int,                    -- 1 人一宅
  dw_p2           int,
  dw_p3           int,
  dw_p4           int,
  dw_p5           int,
  dw_p6p          int,                    -- 6 人以上一宅
  -- 宅內戶數（T04）：一宅多戶 ≈ 潛在分戶購屋需求
  dw_avg_hh       numeric(5,2),
  dw_h1           int,                    -- 1 戶一宅
  dw_h2           int,
  dw_h3           int,
  dw_h4           int,
  dw_h5           int,
  dw_h6p          int,                    -- 6 戶以上一宅
  PRIMARY KEY (period, village_code)
);
CREATE INDEX IF NOT EXISTS idx_vhq_village ON village_household_quarterly (village_code, period_date);

-- 與其他潛在客群資料表一致：啟用 RLS、不設公開 policy
ALTER TABLE village_annual_stats        ENABLE ROW LEVEL SECURITY;
ALTER TABLE village_household_quarterly ENABLE ROW LEVEL SECURITY;

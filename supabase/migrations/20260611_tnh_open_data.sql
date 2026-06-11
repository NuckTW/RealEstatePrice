-- ============================================================
-- 任務 7｜台南市不動產公會開放資料（https://tnh.org.tw/open_gov.asp）
-- 請在 Supabase SQL Editor 手動執行，執行後跑：
--   python3 scripts/fetch_tnh_opendata.py --backfill
--
-- 資料集：
--   建造執照／使用執照：月資料（民國年月期別，11401 起可取得）
--   新建餘屋：季資料（民國年+季期別，113Q1 起可取得）
--   交易資料集不入庫（無逐筆 rows、僅保留最新一期，
--   供需對照改用自家實價登錄 transactions 表）
-- ============================================================

-- 建照 + 使照（同 schema，用 permit_type 區分）
CREATE TABLE IF NOT EXISTS supply_permits (
  id            bigserial PRIMARY KEY,
  permit_type   text    NOT NULL,  -- 'building'（建造執照）| 'usage'（使用執照）
  source_period text    NOT NULL,  -- 民國年月，如 '11504'
  period_date   date    NOT NULL,  -- 對應西元月初
  city          text    NOT NULL,  -- 22 縣市（全存，以臺南市為主要查詢對象）
  permits       int     NOT NULL,  -- 住宅類核發件數
  floor_area_m2 numeric,           -- 總樓地板面積（平方公尺）
  cost_thousand numeric,           -- 工程造價（千元）
  UNIQUE (permit_type, source_period, city)
);

CREATE INDEX IF NOT EXISTS idx_supply_permits_city_date
  ON supply_permits (city, permit_type, period_date);

-- 新建餘屋（臺南市各行政區，季資料）
CREATE TABLE IF NOT EXISTS unsold_new_houses (
  id            bigserial PRIMARY KEY,
  source_period text NOT NULL,  -- 民國年+季，如 '114Q2'
  period_date   date NOT NULL,  -- 季首月月初
  district      text NOT NULL,  -- 行政區（含 '全區' 合計列）
  unsold_units  int  NOT NULL,  -- 待售宅數
  UNIQUE (source_period, district)
);

CREATE INDEX IF NOT EXISTS idx_unsold_district_date
  ON unsold_new_houses (district, period_date);

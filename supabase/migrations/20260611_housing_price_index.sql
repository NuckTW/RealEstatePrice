-- ============================================================
-- 任務 6｜住宅價格指數資料表
-- 請在 Supabase SQL Editor 手動執行，執行後跑：
--   python3 scripts/import_housing_price_index.py
-- 資料來源：臺南市實價登錄大數據輔助區段地價平衡之研究（第六期）
-- 基期：110年1月 = 100
-- ============================================================

CREATE TABLE IF NOT EXISTS housing_price_index (
  id          bigserial    PRIMARY KEY,
  ym          text         NOT NULL,  -- 民國年月，如 '11503'
  ym_date     date         NOT NULL,  -- 對應西元月初（2026-03-01），排序/YoY 用
  series      text         NOT NULL,  -- '全市' | '大廈' | '透天厝' | 行政區名
  index_value numeric(6,2) NOT NULL,  -- 指數值
  UNIQUE (ym, series)
);

CREATE INDEX IF NOT EXISTS idx_hpi_series_date
  ON housing_price_index (series, ym_date);

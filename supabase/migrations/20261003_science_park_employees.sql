-- ============================================================
-- 潛在客群分析 第二期｜科學園區從業員工數（月）
-- ⚠️ 請在 Supabase SQL Editor 手動執行（確認後再跑），執行後：
--   python3 scripts/fetch_science_park.py --backfill   # 105 年 11 月起
-- 規劃文件：docs/potential-buyer-analysis-plan.md §7.3
--
-- 兩個來源寫進同一張表，以 sub_park 區分粒度：
--   source = 'wsts'      國科會統計資料庫（園區級，105/11 起有歷史）→ sub_park = '合計'
--   source = 'opendata'  data.gov.tw 7599 開放 CSV（子園區級，只有最新一期）→ 每月累積
-- 開放 CSV 沒有日期欄：以「南科合計 = 統計資料庫最新月份南科總數」比對後才寫入，對不上就跳過
-- ============================================================

CREATE TABLE IF NOT EXISTS science_park_employees_monthly (
  ym           text NOT NULL,          -- 民國年月，如 '11508'
  ym_date      date NOT NULL,          -- 西元月初
  park         text NOT NULL,          -- 園區別：新竹科學園區／中部科學園區／南部科學園區
  sub_park     text NOT NULL,          -- 子園區（臺南園區、高雄園區…）；園區合計為 '合計'
  phd          int,                    -- 博士
  master       int,                    -- 碩士
  bachelor     int,                    -- 大學
  associate    int,                    -- 專科
  high_school  int,                    -- 高中
  other        int,                    -- 其他
  total        int  NOT NULL,          -- 總人數
  source       text NOT NULL,          -- 'wsts' | 'opendata'
  updated_at   timestamptz DEFAULT now(),
  PRIMARY KEY (ym, park, sub_park)
);
CREATE INDEX IF NOT EXISTS idx_spe_park_date ON science_park_employees_monthly (park, sub_park, ym_date);

-- 與其他潛在客群資料表一致：啟用 RLS、不設公開 policy，前端只能經後端 API 讀取
ALTER TABLE science_park_employees_monthly ENABLE ROW LEVEL SECURITY;

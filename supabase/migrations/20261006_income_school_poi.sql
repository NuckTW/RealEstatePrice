-- ============================================================
-- 潛在客群分析｜家庭收支（縣市・年）、國中小學生數（學校・學年）、生活機能點位（OSM）
-- ⚠️ 請在 Supabase SQL Editor 手動執行（確認後再跑），執行後：
--   python3 scripts/fetch_housing_stats.py --only fies     # 家庭收支
--   python3 scripts/fetch_school_poi.py --backfill         # 學生數 + 生活機能點位
-- 規劃文件：docs/potential-buyer-analysis-plan.md §7.3
-- ============================================================

-- ------------------------------------------------------------
-- 1. housing_market_stats 允許「年」資料（家庭收支調查為年資料）
-- ------------------------------------------------------------
ALTER TABLE housing_market_stats DROP CONSTRAINT IF EXISTS housing_market_stats_period_type_check;
ALTER TABLE housing_market_stats
  ADD CONSTRAINT housing_market_stats_period_type_check CHECK (period_type IN ('M', 'Q', 'H', 'Y'));

-- ------------------------------------------------------------
-- 2. 國中小學生數（教育部統計處校別資料；只存臺南市）
--    國小：data.gov.tw 6240（每學年一檔）；國中：data.gov.tw 6239（104 學年起單一檔）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_students_yearly (
  school_year     int  NOT NULL,          -- 學年度（民國），如 114
  school_code     text NOT NULL,          -- 教育部學校代碼
  level           text NOT NULL CHECK (level IN ('國小', '國中')),
  school_name     text NOT NULL,
  district        text,                   -- 行政區（國小 114 學年起官方提供；其餘以學校代碼對最新年度補）
  is_public       boolean,                -- 公立（市立／國立）
  entry_students  int,                    -- 入學年級學生數：國小 1 年級、國中 7 年級（≈ 當年新生）
  total_students  int,
  classes         int,
  PRIMARY KEY (school_year, school_code, level)
);
CREATE INDEX IF NOT EXISTS idx_school_district ON school_students_yearly (district, school_year);

-- ------------------------------------------------------------
-- 3. 生活機能點位（OpenStreetMap，© OpenStreetMap contributors，ODbL）
--    匯入時以 public/geo/tainan_villages.json 做 point-in-polygon 指定 village_code
--    只收覆蓋率較可信的類別；便利商店、診所在 OSM 明顯不完整，不收
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS poi_points (
  osm_id        text PRIMARY KEY,          -- 'node/123'、'way/456'
  category      text NOT NULL,             -- park／station／hospital／supermarket／mall／library／school
  name          text,
  lat           double precision NOT NULL,
  lon           double precision NOT NULL,
  village_code  text REFERENCES villages(village_code),   -- 落在哪一里（市界外或邊界誤差為 NULL）
  tags          jsonb,
  fetched_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poi_village ON poi_points (village_code, category);

-- 與其他潛在客群資料表一致：啟用 RLS、不設公開 policy
ALTER TABLE school_students_yearly ENABLE ROW LEVEL SECURITY;
ALTER TABLE poi_points             ENABLE ROW LEVEL SECURITY;

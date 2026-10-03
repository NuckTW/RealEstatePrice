-- ============================================================
-- 潛在客群分析｜南科產業別從業員工（年）＋ 臺南市人口推估（行政區・年）
-- ⚠️ 請在 Supabase SQL Editor 手動執行（確認後再跑），執行後：
--   python3 scripts/fetch_science_park.py              # 會一併匯入產業別
--   python3 scripts/fetch_population_projection.py
-- 規劃文件：docs/potential-buyer-analysis-plan.md §7.3
-- ============================================================

-- ------------------------------------------------------------
-- 南科管理局從業員工產業別統計（data.gov.tw 101986，年資料）
-- 開放資料目前只有 107～113 年；105～106 年僅見於南科年報（PDF）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS science_park_industry_yearly (
  year        int  NOT NULL,          -- 民國年
  park        text NOT NULL,          -- '南部科學園區'
  industry    text NOT NULL,          -- 半導體／光電／生技／通訊／精密機械／電腦週邊／其他／合計
  employees   int  NOT NULL,
  updated_at  timestamptz DEFAULT now(),
  PRIMARY KEY (year, park, industry)
);

-- ------------------------------------------------------------
-- 臺南市人口推估（臺南市政府，data.gov.tw 134546；參考國發會中華民國人口推估）
-- ⚠️ 只以出生、死亡推估，未計入遷徙 → 淨移入多的區（如善化、新市、安平）會被低估
-- 原始資料為單一年齡 × 高中低推估，匯入時彙整成購屋相關年齡級距；area = '臺南市' 為各區加總
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS population_projection (
  edition      text NOT NULL,          -- 推估版次，如 '2025-2070'
  scope        text NOT NULL CHECK (scope IN ('高推估', '中推估', '低推估')),
  area         text NOT NULL,          -- 行政區名，或 '臺南市'
  year         int  NOT NULL,          -- 西元年
  pop_total    int  NOT NULL,
  age_0_14     int,
  age_15_24    int,
  age_25_34    int,                    -- 首購主力
  age_35_44    int,                    -- 換屋主力
  age_45_64    int,
  age_65_plus  int,
  updated_at   timestamptz DEFAULT now(),
  PRIMARY KEY (edition, scope, area, year)
);
CREATE INDEX IF NOT EXISTS idx_popproj_lookup ON population_projection (edition, scope, year);

-- 與其他潛在客群資料表一致：啟用 RLS、不設公開 policy
ALTER TABLE science_park_industry_yearly ENABLE ROW LEVEL SECURITY;
ALTER TABLE population_projection        ENABLE ROW LEVEL SECURITY;

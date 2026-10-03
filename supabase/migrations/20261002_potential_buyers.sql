-- ============================================================
-- 潛在客群分析 第一期｜村里人口、戶籍動態、遷徙、所得、租賃
-- ⚠️ 請在 Supabase SQL Editor 手動執行（確認後再跑），執行後依序：
--   python3 scripts/fetch_ris_village.py --backfill   # 戶政：村里月資料
--   python3 scripts/fetch_fia_income.py --backfill    # 財政部：村里所得
--   python3 scripts/fetch_rentals.py --backfill       # 實價登錄：租賃
-- 規劃文件：docs/potential-buyer-analysis-plan.md
-- ============================================================

-- ------------------------------------------------------------
-- 村里主檔：所有村里級資料的對齊鍵
-- village_code = 戶政 district_code（11 碼，如 67000010001）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villages (
  village_code  text PRIMARY KEY,
  district      text NOT NULL,          -- 行政區，如 '東區'（不含「臺南市」）
  village       text NOT NULL,          -- 村里名（以戶政寫法為準）
  name_aliases  text[] DEFAULT '{}',    -- 其他來源的異體字／舊名（如 '𥂁埕里'）
  first_seen_ym text,                   -- 最早出現的民國年月
  last_seen_ym  text,                   -- 最近出現的民國年月（停止更新 = 已裁併）
  updated_at    timestamptz DEFAULT now()
);
-- 不設 UNIQUE(district, village)：里名變更／代碼重編時同名可能對應多個代碼
CREATE INDEX IF NOT EXISTS idx_villages_name ON villages (district, village);

-- ------------------------------------------------------------
-- 戶政 ODRP014：村里戶數、單一年齡人口（月）
-- 年齡已彙整成購屋相關級距；完整單一年齡保留於 ages_m / ages_f
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS village_population_monthly (
  ym            text NOT NULL,          -- 民國年月，如 '11508'
  ym_date       date NOT NULL,          -- 西元月初
  village_code  text NOT NULL REFERENCES villages(village_code),
  households    int  NOT NULL,
  pop_total     int  NOT NULL,
  pop_m         int,
  pop_f         int,
  age_0_14      int,
  age_15_24     int,
  age_25_34     int,                    -- 首購主力
  age_35_44     int,                    -- 換屋主力
  age_45_64     int,
  age_65_plus   int,
  ages_m        int[],                  -- index 0..100（100 = 100 歲以上）
  ages_f        int[],
  PRIMARY KEY (ym, village_code)
);
CREATE INDEX IF NOT EXISTS idx_vpop_village_date ON village_population_monthly (village_code, ym_date);

-- ------------------------------------------------------------
-- 戶政 ODRP060：村里出生、死亡、結婚、離婚（月，含同婚）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS village_vital_monthly (
  ym            text NOT NULL,
  ym_date       date NOT NULL,
  village_code  text NOT NULL REFERENCES villages(village_code),
  births        int,
  deaths        int,
  marriages     int,                    -- 結婚對數（異性 + 同性）
  divorces      int,                    -- 離婚／終止結婚對數
  PRIMARY KEY (ym, village_code)
);
CREATE INDEX IF NOT EXISTS idx_vvital_village_date ON village_vital_monthly (village_code, ym_date);

-- ------------------------------------------------------------
-- 戶政 ODRP011：村里遷入遷出（月）
-- 已驗證（11508 全台南 650 里）：in_total = 各縣市 + 市內他區 + 國外 + 初設戶籍 + 其他
-- 同區內跨里遷移（in_migrants / out_migrants）不計入 in_total，另存
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS village_migration_monthly (
  ym                  text NOT NULL,
  ym_date             date NOT NULL,
  village_code        text NOT NULL REFERENCES villages(village_code),
  in_total            int,              -- 遷入人數合計
  out_total           int,              -- 遷出人數合計
  in_other_city       int,              -- 自外縣市遷入（不含國外）
  out_other_city      int,              -- 遷往外縣市
  in_other_town       int,              -- 自本市其他區遷入
  out_other_town      int,              -- 遷往本市其他區
  in_same_town        int,              -- 同區其他里遷入（來源欄位 in_migrants，語意待官方確認）
  out_same_town       int,
  in_foreign          int,
  out_foreign         int,
  in_by_city          jsonb,            -- 依來源縣市：{"ntp":n,"tp":n,"ty":n,"tc":n,"kh":n,"tw":n,"fu":n,"other":n}
  out_by_city         jsonb,
  raw                 jsonb,            -- 原始欄位（男女合計），保留以利日後重算
  PRIMARY KEY (ym, village_code)
);
CREATE INDEX IF NOT EXISTS idx_vmig_village_date ON village_migration_monthly (village_code, ym_date);

-- ------------------------------------------------------------
-- 財政部 綜稅綜合所得總額各村里統計（年，金額單位：千元）
-- 課稅資料：不含政府移轉、免稅、分離課稅所得 → 只做相對排名
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS village_income_yearly (
  tax_year      int  NOT NULL,          -- 民國年度，如 112
  district      text NOT NULL,
  village       text NOT NULL,          -- 來源原始村里名
  village_code  text REFERENCES villages(village_code),  -- 對不到時為 NULL（如已分割的舊里）
  tax_units     int,                    -- 納稅單位（戶）
  income_total  bigint,                 -- 綜合所得總額（千元）
  income_mean   int,
  income_median int,
  income_q1     int,
  income_q3     int,
  income_sd     numeric(12,2),
  income_cv     numeric(8,2),
  PRIMARY KEY (tax_year, district, village)
);
CREATE INDEX IF NOT EXISTS idx_vincome_code ON village_income_yearly (village_code, tax_year);

-- ------------------------------------------------------------
-- 實價登錄 租賃（d_lvr_land_c.csv）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rentals (
  id                  bigserial PRIMARY KEY,
  serial_number       text NOT NULL,
  source_season       text NOT NULL,    -- 最後一次出現的發布季，如 '115S2'
  district            text,
  rental_target       text,             -- 交易標的（租賃房屋／租賃房地…）
  address             text,
  rental_date         date,             -- 租賃年月日
  floor               text,
  total_floors        smallint,
  building_type       text,
  main_use            text,
  completion_date     text,             -- 民國年月日原值
  building_area_sqm   numeric(12,2),
  rooms               smallint,
  living_rooms        smallint,
  bathrooms           smallint,
  has_management      boolean,
  has_furniture       boolean,
  has_elevator        boolean,
  monthly_rent        int,              -- 總額元（月租）
  unit_rent_sqm       numeric(10,2),    -- 單價元/平方公尺
  parking_type        text,
  parking_rent        int,
  rental_type         text,             -- 出租型態（整棟／獨立套房…）
  rental_period       text,
  equipment           text,
  rental_service      text,             -- 租賃住宅服務（包租／代管）
  notes               text,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (serial_number)              -- 編號全國唯一；同一案出現在不同發布季時只留一筆
);
CREATE INDEX IF NOT EXISTS idx_rentals_district_date ON rentals (district, rental_date);

-- ------------------------------------------------------------
-- 啟用 RLS、不設公開 policy：前端 anon key 無法讀寫；
-- 後端 API 與匯入腳本使用 service role（不受 RLS 限制），行為不變
-- ------------------------------------------------------------
ALTER TABLE villages                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE village_population_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE village_vital_monthly      ENABLE ROW LEVEL SECURITY;
ALTER TABLE village_migration_monthly  ENABLE ROW LEVEL SECURITY;
ALTER TABLE village_income_yearly      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals                    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 台南市實價登錄 AI 分析助手 — Supabase 資料庫 Schema
-- ============================================================

-- 啟用 UUID 擴充
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ------------------------------------------------------------
-- Table 1: districts (行政區參考表)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS districts (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(20) NOT NULL UNIQUE,  -- e.g. 中西區、東區、南區
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 預填台南市 37 個行政區
INSERT INTO districts (name) VALUES
  ('中西區'),('東區'),('南區'),('北區'),('安平區'),('安南區'),
  ('永康區'),('歸仁區'),('新化區'),('左鎮區'),('玉井區'),('楠西區'),
  ('南化區'),('仁德區'),('關廟區'),('龍崎區'),('官田區'),('麻豆區'),
  ('佳里區'),('西港區'),('七股區'),('將軍區'),('學甲區'),('北門區'),
  ('新營區'),('後壁區'),('白河區'),('東山區'),('六甲區'),('下營區'),
  ('柳營區'),('鹽水區'),('善化區'),('大內區'),('山上區'),('新市區'),
  ('安定區')
ON CONFLICT (name) DO NOTHING;


-- ------------------------------------------------------------
-- Table 2: transactions (實價登錄買賣主表)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- 識別
  serial_number             VARCHAR(30),          -- 編號（來源檔案流水號）
  source_season             VARCHAR(10) NOT NULL, -- 資料來源季別，e.g. '113S4'

  -- 地點
  district                  VARCHAR(20),          -- 鄉鎮市區
  address                   TEXT,                 -- 土地區段位置或建物區段門牌

  -- 交易基本
  transaction_date          DATE,                 -- 交易年月日（民國轉西元）
  transaction_target        VARCHAR(30),          -- 交易標的（土地/房地/建物+車位）
  transaction_pen_count     VARCHAR(20),          -- 交易筆棟數

  -- 土地
  land_area_sqm             NUMERIC(12,2),        -- 土地移轉總面積（平方公尺）
  urban_land_use            VARCHAR(20),          -- 都市土地使用分區
  non_urban_land_use        VARCHAR(20),          -- 非都市土地使用分區

  -- 建物
  building_type             VARCHAR(30),          -- 建物型態（住宅大樓/透天厝/公寓等）
  main_use                  VARCHAR(30),          -- 主要用途
  main_material             VARCHAR(30),          -- 主要建材
  completion_date           VARCHAR(10),          -- 建築完成年月（民國格式保留）
  building_area_sqm         NUMERIC(12,2),        -- 建物移轉總面積（平方公尺）
  main_building_area_sqm    NUMERIC(12,2),        -- 主建物面積
  auxiliary_building_area   NUMERIC(12,2),        -- 附屬建物面積
  balcony_area_sqm          NUMERIC(12,2),        -- 陽台面積

  -- 樓層
  floor                     VARCHAR(20),          -- 移轉層次
  total_floors              SMALLINT,             -- 總樓層數
  has_elevator              BOOLEAN,              -- 電梯

  -- 格局
  rooms                     SMALLINT,             -- 房
  living_rooms              SMALLINT,             -- 廳
  bathrooms                 SMALLINT,             -- 衛
  has_management            BOOLEAN,              -- 有無管理組織

  -- 車位
  parking_type              VARCHAR(20),          -- 車位類別
  parking_area_sqm          NUMERIC(10,2),        -- 車位面積
  parking_price             BIGINT,               -- 車位總價（元）

  -- 價格
  total_price               BIGINT,               -- 總價（元）
  unit_price_sqm            NUMERIC(12,2),        -- 單價（元/平方公尺）

  -- 備註
  notes                     TEXT,

  -- 系統欄位
  created_at                TIMESTAMPTZ DEFAULT NOW(),

  -- 防重複：同一季別 + 同一編號
  UNIQUE (source_season, serial_number)
);

-- 常用查詢索引
CREATE INDEX IF NOT EXISTS idx_transactions_district        ON transactions(district);
CREATE INDEX IF NOT EXISTS idx_transactions_date            ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_building_type   ON transactions(building_type);
CREATE INDEX IF NOT EXISTS idx_transactions_total_price     ON transactions(total_price);
CREATE INDEX IF NOT EXISTS idx_transactions_district_date   ON transactions(district, transaction_date);


-- ------------------------------------------------------------
-- Table 3: scrape_logs (爬蟲執行紀錄)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrape_logs (
  id            SERIAL PRIMARY KEY,
  season        VARCHAR(10) NOT NULL,   -- 抓取的季別，e.g. '113S4'
  status        VARCHAR(10) NOT NULL,   -- 'success' | 'failed'
  rows_inserted INTEGER DEFAULT 0,      -- 本次新增筆數
  rows_skipped  INTEGER DEFAULT 0,      -- 跳過（重複）筆數
  error_message TEXT,
  executed_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- View: district_monthly_stats (行政區月度統計，供圖表使用)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW district_monthly_stats AS
SELECT
  district,
  DATE_TRUNC('month', transaction_date)          AS month,
  COUNT(*)                                        AS transaction_count,
  ROUND(AVG(unit_price_sqm)::NUMERIC, 0)         AS avg_unit_price,
  ROUND(AVG(total_price)::NUMERIC, 0)            AS avg_total_price,
  ROUND(AVG(building_area_sqm)::NUMERIC, 1)      AS avg_building_area,
  MIN(total_price)                                AS min_total_price,
  MAX(total_price)                                AS max_total_price
FROM transactions
WHERE
  transaction_date IS NOT NULL
  AND unit_price_sqm > 0
  AND total_price > 0
  AND building_area_sqm > 0
  AND transaction_target LIKE '%建物%'   -- 只統計含建物的交易
GROUP BY district, DATE_TRUNC('month', transaction_date)
ORDER BY month DESC, district;


-- ------------------------------------------------------------
-- View: yearly_overview (全市年度概況，供 AI 查詢參考)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW yearly_overview AS
SELECT
  EXTRACT(YEAR FROM transaction_date)::INTEGER   AS year,
  COUNT(*)                                        AS total_transactions,
  ROUND(AVG(unit_price_sqm)::NUMERIC, 0)         AS avg_unit_price,
  ROUND(AVG(total_price)::NUMERIC / 10000, 1)    AS avg_total_price_wan,  -- 萬元
  ROUND(AVG(building_area_sqm)::NUMERIC, 1)      AS avg_building_area
FROM transactions
WHERE
  transaction_date IS NOT NULL
  AND unit_price_sqm > 0
  AND total_price > 0
  AND transaction_target LIKE '%建物%'
GROUP BY EXTRACT(YEAR FROM transaction_date)
ORDER BY year DESC;

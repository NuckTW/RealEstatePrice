-- ============================================================
-- 索引建議（任務 2 大型重構產出）
-- ⚠️ 請勿自動執行：先確認後手動在 Supabase SQL Editor 逐條執行。
--
-- 現有索引（見 supabase/schema.sql）：
--   district / transaction_date / building_type / total_price
--   (district, transaction_date)
--
-- 注意：資料量大時建議改用 CREATE INDEX CONCURRENTLY（需逐條單獨執行，
-- 不能包在交易裡）；目前資料量（~30 萬筆內）直接執行即可。
-- ============================================================

-- 1. 預售屋建案聚合（/api/map 預售標記、/api/charts 建案排行、/api/case-detail）
--    查詢模式：WHERE is_presale = true AND project_name = ... / GROUP BY project_name
--    部分索引只涵蓋預售列，比全表索引小很多
CREATE INDEX IF NOT EXISTS idx_transactions_presale_project
  ON transactions (project_name, transaction_date)
  WHERE is_presale = true;

-- 2. 成屋「去樓層地址」聚合（/api/map 成屋標記、/api/charts 建案排行、/api/case-detail）
--    查詢都以 REGEXP_REPLACE(address, ...) 為 JOIN / GROUP BY / 等值比對鍵，
--    表達式索引可讓這些查詢免去全表掃描＋每列重算正則
CREATE INDEX IF NOT EXISTS idx_transactions_addr_base
  ON transactions ((REGEXP_REPLACE(address, '[0-9零一二三四五六七八九十百千]+樓.*$', '')))
  WHERE is_presale = false;

-- 3. building_locations JOIN 鍵（/api/map 兩個查詢的 JOIN 條件）
CREATE INDEX IF NOT EXISTS idx_building_locations_type_key
  ON building_locations (location_type, location_key);

-- 4. 預售/成屋 + 日期複合條件（buildWhere 幾乎所有查詢都同時帶這兩個條件）
CREATE INDEX IF NOT EXISTS idx_transactions_presale_date
  ON transactions (is_presale, transaction_date);

-- 未建議的索引（理由）：
--   rooms：基數低（0~5+），規劃器通常不會選用
--   unit_price_sqm / total_price > 0：幾乎所有列都符合，選擇性太低

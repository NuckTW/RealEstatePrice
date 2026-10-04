-- ============================================================
-- 潛在客群分析｜手動資料與自訂指數
-- ⚠️ 請在 Supabase SQL Editor 或 supabase CLI 手動執行（確認後再跑）
-- 用途：/potential-buyers「自訂指數」頁籤
--   custom_datasets / custom_dataset_values：使用者手動加入的村里或行政區資料
--   custom_indices：使用者自訂的指數配方（組成指標 + 權重），可由 AI 建議後調整
-- 存取：只走後端 API（service role），API 以 AI 問答同一組密碼（CHAT_PASSWORD）保護
-- 本檔可重複執行
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_datasets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  unit        text CHECK (char_length(unit) <= 20),
  level       text NOT NULL CHECK (level IN ('village', 'district')),   -- 村里 or 行政區
  description text CHECK (char_length(description) <= 500),
  source      text CHECK (char_length(source) <= 200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 數值：村里層級 area_key = village_code（11 碼）；行政區層級 area_key = 行政區名稱（如「永康區」）
CREATE TABLE IF NOT EXISTS custom_dataset_values (
  dataset_id uuid NOT NULL REFERENCES custom_datasets(id) ON DELETE CASCADE,
  area_key   text NOT NULL CHECK (char_length(area_key) <= 20),
  value      numeric NOT NULL,
  PRIMARY KEY (dataset_id, area_key)
);

-- 指數配方：components = [{ "key": "income", "weight": 30, "invert": false }, ...]
--   key 為前端指標目錄的代號；手動資料為 "custom:<dataset_id>"
CREATE TABLE IF NOT EXISTS custom_indices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  description text CHECK (char_length(description) <= 500),
  components  jsonb NOT NULL CHECK (jsonb_typeof(components) = 'array'),
  ai_note     text CHECK (char_length(ai_note) <= 4000),               -- AI 建議的理由（保留供日後參考）
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS 開啟、不建任何 policy → anon / authenticated 一律讀寫不到，只有 service role 可用
ALTER TABLE custom_datasets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_dataset_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_indices        ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON custom_datasets, custom_dataset_values, custom_indices FROM anon, authenticated;

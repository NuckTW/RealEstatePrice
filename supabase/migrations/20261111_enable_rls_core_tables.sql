-- ============================================================
-- 核心資料表補開 RLS，並收回 anon / authenticated 的權限
-- ⚠️ 請在 Supabase SQL Editor 或 supabase CLI 手動執行（確認後再跑）
-- 本檔可重複執行
--
-- 為什麼：這幾張表的建表 SQL 都沒有 ENABLE ROW LEVEL SECURITY。Supabase 預設會把 public schema
--   的表開放給 anon / authenticated，RLS 沒開時，拿到 anon key 的人可以直接經 PostgREST 讀寫
--   （包含 INSERT / UPDATE / DELETE）。anon key 設計上是公開金鑰，不能當成祕密。
-- 影響：
--   - 網站後端（service role 呼叫 execute_query）與排程腳本（service role）不受影響：
--     service_role 與 postgres 都有 BYPASSRLS。潛在客群那批表（villages 等）早就開了 RLS，
--     走的是同一條路，運作正常。
--   - AI 問答的 chat_reader 靠 20261029 建的 chat_reader_select policy 讀 transactions，
--     所以要先跑過 20261029_chat_query_readonly.sql（本檔會檢查，沒有就中止）。
--   - 前端沒有直接用 anon key 連 Supabase（一律經 /api 路由），不受影響。
-- ============================================================

-- ------------------------------------------------------------
-- 0. 前置檢查：transactions 必須已有 chat_reader 的 SELECT policy，否則開 RLS 後 AI 問答會查不到資料
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'chat_reader_select'
  ) THEN
    RAISE EXCEPTION '找不到 chat_reader_select policy，請先執行 20261029_chat_query_readonly.sql';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. 開 RLS + 收回 anon / authenticated 權限（表不存在就跳過）
--    不建立任何給 anon 的 policy：這些表只允許 service role 與 chat_reader 存取
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions', 'districts', 'scrape_logs', 'building_locations',
    'presale_projects', 'supply_permits', 'unsold_new_houses', 'housing_price_index'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    ELSE
      RAISE NOTICE '略過不存在的表：%', t;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 2. 檢查（執行完看結果）
--    a. public schema 還沒開 RLS 的表：應該是空的
--    b. anon / authenticated 還有權限的表：應該是空的
-- ------------------------------------------------------------
SELECT '尚未開 RLS 的表' AS check_item, c.relname AS name
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
UNION ALL
SELECT 'anon/authenticated 仍有權限：' || g.grantee || ' ' || g.privilege_type, g.table_name
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public' AND g.grantee IN ('anon', 'authenticated')
ORDER BY 1, 2;

-- ------------------------------------------------------------
-- 回滾（需要時手動執行）
-- ------------------------------------------------------------
-- ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;   -- 其餘表比照
-- GRANT SELECT ON public.transactions TO anon, authenticated;   -- 只在確定要開放時才執行

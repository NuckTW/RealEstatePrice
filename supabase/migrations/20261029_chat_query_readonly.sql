-- ============================================================
-- AI 問答｜LLM 產生的 SQL 改走專用唯讀函式 chat_query
-- ⚠️ 請在 Supabase SQL Editor 或 supabase CLI 手動執行（確認後再跑）
-- 本檔可重複執行
--
-- 為什麼：/api/chat 會執行 Gemini 產生的 SQL。原本走 execute_query（service role 呼叫、
--   通常是 SECURITY DEFINER），提示詞注入（prompt injection）就可能讀到 auth.users、
--   潛在客群自訂資料等其他表，或用 pg_sleep / 大表交叉 join 拖垮資料庫。
-- 做法：
--   1. 建 NOLOGIN 的 chat_reader role，只能 SELECT transactions（與正式庫有建的統計 view）
--   2. chat_query 的 owner 設成 chat_reader + SECURITY DEFINER → 函式內一律以 chat_reader 身分執行
--   3. 函式層級 statement_timeout（PostgREST 12.2+ 會在交易層級套用）、最多回 10001 筆
--   4. 查詢包成子查詢執行：多語句、DDL/DML、資料修改型 CTE 都會變成語法錯誤
--   5. 收回 execute_query 的 PUBLIC / anon / authenticated 執行權，避免 chat_reader 繞道呼叫
-- 部署順序：先跑本檔，再部署改用 chat_query 的程式（否則 AI 問答會找不到函式）
-- ============================================================

-- ------------------------------------------------------------
-- 1. 專用唯讀 role
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chat_reader') THEN
    CREATE ROLE chat_reader NOLOGIN NOINHERIT;
  END IF;
END $$;

-- 讓 postgres 能把函式 owner 設成 chat_reader、之後也能 CREATE OR REPLACE（PG16 起建立者預設沒有 SET 權）
GRANT chat_reader TO postgres;

GRANT USAGE ON SCHEMA public TO chat_reader;
GRANT SELECT ON transactions TO chat_reader;

-- AI 提示詞提到的兩個統計 view：schema.sql 有定義但正式庫不一定有建，存在才授權
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['district_monthly_stats', 'yearly_overview'] LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON public.%I TO chat_reader', v);
    END IF;
  END LOOP;
END $$;

-- transactions 若有開 RLS，chat_reader 需要 policy 才讀得到；沒開 RLS 時這條不生效、無害
DROP POLICY IF EXISTS chat_reader_select ON transactions;
CREATE POLICY chat_reader_select ON transactions FOR SELECT TO chat_reader USING (true);

-- ------------------------------------------------------------
-- 2. chat_query
--   - 回傳 json（不是 jsonb）：jsonb 會重排物件 key，欄位順序會亂掉（前端靠欄位順序判斷圖表）
--   - 子查詢後面接換行：LLM 的 SQL 結尾若有 -- 註解，不會把右括號一起註解掉
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_query(query_text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '8s'
AS $$
DECLARE
  q      text := regexp_replace(btrim(query_text), ';\s*$', '');
  result json;
BEGIN
  IF q !~* '^(select|with)\s' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed' USING ERRCODE = 'P0001';
  END IF;

  EXECUTE format(
    E'SELECT coalesce(json_agg(t), ''[]''::json) FROM (SELECT * FROM (%s\n) q LIMIT 10001) t',
    q
  ) INTO result;

  RETURN result;
END
$$;

-- owner 必須對 schema 有 CREATE 權才能接手函式；轉完立刻收回
GRANT CREATE ON SCHEMA public TO chat_reader;
ALTER FUNCTION public.chat_query(text) OWNER TO chat_reader;
REVOKE CREATE ON SCHEMA public FROM chat_reader;

REVOKE ALL ON FUNCTION public.chat_query(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_query(text) TO service_role;

-- ------------------------------------------------------------
-- 3. execute_query：只留給 service role（網站後端與排程腳本都用 service role）
--    沒寫參數型別：execute_query 沒有 overload，這樣不用猜它宣告的是 text 還是 varchar
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.execute_query FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_query TO service_role;

-- ------------------------------------------------------------
-- 4. 檢查（執行完看結果）
--    可讀的表：應該只有 transactions（加上存在的統計 view）
--    可執行的 SECURITY DEFINER 函式：應該只剩 chat_query；有其他的就要比照第 3 段收回 PUBLIC 執行權
-- ------------------------------------------------------------
SELECT 'chat_reader 可讀的表' AS check_item, c.oid::regclass::text AS name
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind IN ('r', 'v', 'm', 'p')
  AND has_table_privilege('chat_reader', c.oid, 'SELECT')
UNION ALL
SELECT 'chat_reader 可執行的 SECURITY DEFINER 函式', p.oid::regprocedure::text
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.prosecdef
  AND has_function_privilege('chat_reader', p.oid, 'EXECUTE');

-- ------------------------------------------------------------
-- 回滾（需要時手動執行；程式要先退回用 execute_query 的版本）
-- ------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.chat_query(text);
-- DROP POLICY IF EXISTS chat_reader_select ON transactions;
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM chat_reader;
-- REVOKE USAGE ON SCHEMA public FROM chat_reader;
-- DROP ROLE IF EXISTS chat_reader;

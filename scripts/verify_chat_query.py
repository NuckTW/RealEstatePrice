"""
AI 問答 chat_query 安全檢查（唯讀，不寫 DB）

對應 supabase/migrations/20261029_chat_query_readonly.sql，跑完 migration 後執行，確認：
  - 正常的 SELECT / WITH 查得到資料、欄位順序不變
  - 讀不到 transactions 與統計 view 以外的表（auth.users、自訂指數等）
  - 不能透過 chat_query 呼叫 execute_query 繞道
  - 多語句、DML、資料修改型 CTE 都被擋（測試語句都帶 WHERE false，就算防線失效也不會刪到資料）
  - 8 秒逾時、10001 筆上限
  - anon key 呼叫不到 execute_query / chat_query

用法（執行路徑：專案根目錄）：
  python3 scripts/verify_chat_query.py

需要環境變數 NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、NEXT_PUBLIC_SUPABASE_ANON_KEY（會自動讀 .env.local）
"""

from __future__ import annotations

import os
import sys


def load_env() -> None:
    """讀 .env.local（若有 python-dotenv）；已存在的環境變數不覆蓋"""
    try:
        from dotenv import load_dotenv
        load_dotenv('.env.local', override=False)
    except ImportError:
        pass


def call(sb, fn: str, sql: str):
    """回傳 (rows, 錯誤訊息)；錯誤時 rows 為 None"""
    try:
        return sb.rpc(fn, {'query_text': sql}).execute().data, None
    except Exception as e:  # postgrest.APIError 等
        return None, str(getattr(e, 'message', None) or e)


def main() -> int:
    load_env()
    from supabase import create_client
    url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
    admin = create_client(url, os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    anon = create_client(url, os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'])

    failures = 0

    def expect_ok(name: str, sql: str, check=None) -> None:
        nonlocal failures
        rows, err = call(admin, 'chat_query', sql)
        ok = err is None and (check is None or check(rows))
        failures += not ok
        print(f"{'✅' if ok else '❌'} 應成功｜{name}：{err or f'{len(rows)} 筆'}")

    def expect_fail(name: str, sql: str, client=admin, fn: str = 'chat_query') -> None:
        nonlocal failures
        rows, err = call(client, fn, sql)
        ok = err is not None
        failures += not ok
        print(f"{'✅' if ok else '❌'} 應被擋｜{name}：{err or f'竟然成功，回傳 {len(rows)} 筆'}")

    print('── 正常查詢')
    expect_ok('各區筆數', 'SELECT district, count(*) AS cnt FROM transactions GROUP BY district ORDER BY cnt DESC',
              lambda r: len(r) > 0 and list(r[0].keys()) == ['district', 'cnt'])
    expect_ok('WITH 查詢', 'WITH t AS (SELECT district FROM transactions LIMIT 5) SELECT * FROM t')
    expect_ok('中位數（聚合函式）',
              'SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY unit_price_sqm) AS m FROM transactions WHERE unit_price_sqm > 0')
    expect_ok('結尾分號', 'SELECT 1 AS a; ')
    expect_ok('結尾單行註解', 'SELECT 1 AS a -- 註解')
    expect_ok('筆數上限 10001', 'SELECT generate_series(1, 20000) AS n', lambda r: len(r) == 10001)

    print('── 權限')
    expect_fail('auth.users', 'SELECT count(*) FROM auth.users')
    expect_fail('自訂指數表', 'SELECT count(*) FROM custom_indices')
    expect_fail('繞道 execute_query', "SELECT execute_query('SELECT 1')")

    print('── 語句型態（都帶 WHERE false，不會動到資料）')
    expect_fail('DELETE', 'DELETE FROM transactions WHERE false')
    expect_fail('多語句', 'SELECT 1; DELETE FROM transactions WHERE false')
    expect_fail('資料修改型 CTE', 'WITH d AS (DELETE FROM transactions WHERE false RETURNING *) SELECT * FROM d')

    print('── 逾時（約 8 秒）')
    expect_fail('pg_sleep(12)', 'SELECT pg_sleep(12)')

    print('── anon key')
    expect_fail('anon 呼叫 execute_query', 'SELECT 1', client=anon, fn='execute_query')
    expect_fail('anon 呼叫 chat_query', 'SELECT 1', client=anon, fn='chat_query')

    print(f"\n{'全部通過' if not failures else f'{failures} 項不符預期'}")
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())

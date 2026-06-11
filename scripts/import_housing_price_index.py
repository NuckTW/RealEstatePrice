"""
匯入台南市住宅價格指數 CSV 到 Supabase housing_price_index 表（任務 6）

前置：先在 Supabase SQL Editor 執行
  supabase/migrations/20260611_housing_price_index.sql

用法：
  python3 scripts/import_housing_price_index.py

資料來源：data/housing_price_index.csv
  欄位：年月（民國YYYMM）、全市、大廈、透天厝、14 個行政區/區域
  基期：110年1月 = 100
"""

import csv
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'housing_price_index.csv')
BATCH_SIZE = 500


def roc_ym_to_date(ym: str) -> str:
    """民國年月 '11503' → '2026-03-01'"""
    year = int(ym[:-2]) + 1911
    month = int(ym[-2:])
    return f'{year}-{month:02d}-01'


def main():
    sb = create_client(
        os.environ['NEXT_PUBLIC_SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    )

    rows = []
    with open(CSV_PATH, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        series_names = [c for c in reader.fieldnames if c != '年月']
        for line in reader:
            ym = line['年月'].strip()
            if not ym:
                continue
            for series in series_names:
                val = (line[series] or '').strip()
                if not val:
                    continue
                rows.append({
                    'ym': ym,
                    'ym_date': roc_ym_to_date(ym),
                    'series': series,
                    'index_value': float(val),
                })

    print(f'CSV 解析：{len(rows)} 筆（{len(series_names)} 個數列）')

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        sb.table('housing_price_index').upsert(batch, on_conflict='ym,series').execute()
        print(f'  upsert {i + len(batch)}/{len(rows)}')

    r = sb.rpc('execute_query', {'query_text':
        'SELECT COUNT(*)::int AS cnt, MIN(ym) AS first, MAX(ym) AS last FROM housing_price_index'
    }).execute()
    print('資料庫驗證：', r.data)


if __name__ == '__main__':
    sys.exit(main())

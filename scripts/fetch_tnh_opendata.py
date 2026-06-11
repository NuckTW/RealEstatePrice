"""
抓取台南市不動產公會開放資料（任務 7）
https://tnh.org.tw/open_gov.asp

資料集（直接 JSON URL：https://tnh.org.tw/open_gov/<檔名>.json）：
  building_permit-11504.json    建造執照（民國年月，月資料，11401 起）
  usage_permit-11504.json       使用執照（民國年月，月資料，11401 起）
  unsold_new_house-114Q2.json   新建餘屋（民國年+季，季資料，113Q1 起）

交易資料集（transactions-YYYYMMDD.json）不入庫：無逐筆 rows、
伺服器僅保留最新一期，供需對照改用自家實價登錄 transactions 表。

用法：
  python3 scripts/fetch_tnh_opendata.py             # 抓最近期別（月排程用）
  python3 scripts/fetch_tnh_opendata.py --backfill  # 回補全部可取得的歷史期別

前置：先在 Supabase SQL Editor 執行
  supabase/migrations/20260611_tnh_open_data.sql
"""

from __future__ import annotations

import os
import sys
import time
from datetime import date

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

BASE_URL = 'https://tnh.org.tw/open_gov'
EARLIEST_YM = '11401'   # 建照/使照最早可取得期別
EARLIEST_QUARTER = '113Q1'  # 餘屋最早可取得期別
RECENT_MONTHS = 4       # 非 backfill 模式往回抓幾個月（官方約落後 2 個月發布）
RECENT_QUARTERS = 3


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({'User-Agent': 'Mozilla/5.0 (tainan-realestate-ai data fetcher)'})
    return s


def roc_ym_to_date(ym: str) -> str:
    """'11504' → '2026-04-01'"""
    return f'{int(ym[:-2]) + 1911}-{int(ym[-2:]):02d}-01'


def quarter_to_date(q: str) -> str:
    """'114Q2' → '2025-04-01'"""
    year = int(q.split('Q')[0]) + 1911
    month = (int(q.split('Q')[1]) - 1) * 3 + 1
    return f'{year}-{month:02d}-01'


def month_range(start_ym: str, end_ym: str) -> list[str]:
    """民國年月期別序列（含頭尾）"""
    out = []
    y, m = int(start_ym[:-2]), int(start_ym[-2:])
    ey, em = int(end_ym[:-2]), int(end_ym[-2:])
    while (y, m) <= (ey, em):
        out.append(f'{y}{m:02d}')
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def quarter_range(start_q: str, end_q: str) -> list[str]:
    out = []
    y, q = int(start_q.split('Q')[0]), int(start_q.split('Q')[1])
    ey, eq = int(end_q.split('Q')[0]), int(end_q.split('Q')[1])
    while (y, q) <= (ey, eq):
        out.append(f'{y}Q{q}')
        q += 1
        if q > 4:
            y, q = y + 1, 1
    return out


def current_roc_ym() -> tuple[int, int]:
    today = date.today()
    return today.year - 1911, today.month


def shift_months(y: int, m: int, delta: int) -> tuple[int, int]:
    idx = y * 12 + (m - 1) + delta
    return idx // 12, idx % 12 + 1


def fetch_json(session: requests.Session, filename: str) -> dict | None:
    """抓單一期別 JSON，404 / 解析失敗回傳 None（優雅跳過）"""
    url = f'{BASE_URL}/{filename}'
    try:
        r = session.get(url, timeout=30)
        if r.status_code != 200:
            print(f'  {filename}: HTTP {r.status_code}，跳過')
            return None
        return r.json()
    except Exception as e:
        print(f'  {filename}: 抓取失敗（{e}），跳過')
        return None


def upsert_permits(sb, permit_type: str, period: str, data: dict) -> int:
    rows = data.get('rows') or []
    # 來源偶有「已發布但全為 0」的缺口期別（如 11412），視為尚無資料跳過
    if rows and all((r.get('residential_permits') or 0) == 0 for r in rows):
        print(f'  {period}: 全縣市皆為 0（來源缺口），跳過')
        return 0
    records = [{
        'permit_type': permit_type,
        'source_period': period,
        'period_date': roc_ym_to_date(period),
        'city': r['city'],
        'permits': r.get('residential_permits') or 0,
        'floor_area_m2': r.get('residential_floor_area_m2'),
        'cost_thousand': r.get('residential_construction_cost_thousand'),
    } for r in rows if r.get('city')]
    if records:
        sb.table('supply_permits').upsert(
            records, on_conflict='permit_type,source_period,city').execute()
    return len(records)


def upsert_unsold(sb, period: str, data: dict) -> int:
    rows = data.get('rows') or []
    records = [{
        'source_period': period,
        'period_date': quarter_to_date(period),
        'district': r['district'],
        'unsold_units': r.get('unsold_units') or 0,
    } for r in rows if r.get('district')]
    if records:
        sb.table('unsold_new_houses').upsert(
            records, on_conflict='source_period,district').execute()
    return len(records)


def main():
    backfill = '--backfill' in sys.argv
    session = make_session()
    sb = create_client(
        os.environ['NEXT_PUBLIC_SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    )

    y, m = current_roc_ym()

    # ── 建照 / 使照（月資料） ─────────────────────────────
    if backfill:
        months = month_range(EARLIEST_YM, f'{y}{m:02d}')
    else:
        sy, sm = shift_months(y, m, -(RECENT_MONTHS - 1))
        months = month_range(f'{sy}{sm:02d}', f'{y}{m:02d}')

    for permit_type, category in (('building', 'building_permit'), ('usage', 'usage_permit')):
        print(f'=== {category}（{months[0]} ~ {months[-1]}）===')
        for ym in months:
            data = fetch_json(session, f'{category}-{ym}.json')
            if data is None:
                continue
            n = upsert_permits(sb, permit_type, ym, data)
            print(f'  {ym}: upsert {n} 縣市')
            time.sleep(0.5)

    # ── 新建餘屋（季資料） ────────────────────────────────
    cur_q = f'{y}Q{(m - 1) // 3 + 1}'
    if backfill:
        quarters = quarter_range(EARLIEST_QUARTER, cur_q)
    else:
        all_q = quarter_range(EARLIEST_QUARTER, cur_q)
        quarters = all_q[-RECENT_QUARTERS:]

    print(f'=== unsold_new_house（{quarters[0]} ~ {quarters[-1]}）===')
    for q in quarters:
        data = fetch_json(session, f'unsold_new_house-{q}.json')
        if data is None:
            continue
        n = upsert_unsold(sb, q, data)
        print(f'  {q}: upsert {n} 行政區')
        time.sleep(0.5)

    # ── 驗證 ─────────────────────────────────────────────
    r = sb.rpc('execute_query', {'query_text': """
        SELECT 'supply_permits' AS tbl, permit_type AS grp,
               COUNT(*)::int AS cnt, MIN(source_period) AS first, MAX(source_period) AS last
        FROM supply_permits GROUP BY permit_type
        UNION ALL
        SELECT 'unsold_new_houses', 'quarterly',
               COUNT(*)::int, MIN(source_period), MAX(source_period)
        FROM unsold_new_houses
    """.strip()}).execute()
    print('資料庫驗證：')
    for row in r.data or []:
        print(' ', row)


if __name__ == '__main__':
    main()

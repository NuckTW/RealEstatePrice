"""
月度更新腳本（每月 1日、11日、21日 由 GitHub Actions 觸發）
抓取最新季別資料寫入 Supabase（upsert，避免重複）。

執行路徑：/Users/nuck/AI/RealEstatePrice
執行方式：python3 scripts/fetch_latest.py
"""

import os
import sys
from datetime import date

from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.dirname(__file__))
from fetch_history import (
    make_session, get_seasons, process_season, log_scrape
)

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_latest_season() -> str:
    today = date.today()
    roc_year = today.year - 1911
    q = (today.month - 1) // 3 + 1
    return f'{roc_year}S{q}'


def main():
    season = get_latest_season()
    print(f'月度更新 — 執行日期：{date.today()}，目標季別：{season}')
    session = make_session()
    process_season(session, season)
    print('✅ 月度更新完成！')


if __name__ == '__main__':
    main()

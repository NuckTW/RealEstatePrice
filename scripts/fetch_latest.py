"""
月度更新腳本（每月 1日、11日、21日 由 GitHub Actions 觸發）

更新策略（依序執行）：
  1. 季批次   — DownloadSeason?season=115S2（季末才有，無資料時跳過）
  2. 前期批次  — DownloadHistory?type=history&fileName=YYYYMMDD（每10天一批，自動補缺）
  3. 本期     — Download?fileName=d_lvr_land_a/b.csv（最新10天）
"""

import io
import os
import re
import sys
import time
import zipfile
from datetime import date

import pandas as pd
import requests
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.dirname(__file__))
from fetch_history import (
    make_session, process_season, process_df_auto_season, log_scrape,
)

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

HISTORY_LIST_URL  = 'https://plvr.land.moi.gov.tw/DownloadHistory_ajax_list'
HISTORY_DL_URL    = 'https://plvr.land.moi.gov.tw/DownloadHistory?type=history&fileName={date_str}'
CURRENT_DL_URL    = 'https://plvr.land.moi.gov.tw/Download?fileName={fname}'
DELAY_SEC         = 2.0


# ── 工具 ──────────────────────────────────────────────────────────

def get_latest_season() -> str:
    today = date.today()
    roc_year = today.year - 1911
    q = (today.month - 1) // 3 + 1
    return f'{roc_year}S{q}'


def get_last_db_date() -> str:
    """查詢 DB 最新 transaction_date，做為補缺起點。"""
    try:
        result = supabase.rpc('execute_query', {
            'query_text': "SELECT MAX(transaction_date)::text AS d FROM transactions"
        }).execute()
        rows = result.data or []
        if rows and rows[0].get('d'):
            return rows[0]['d']          # e.g. '2026-03-04'
    except Exception as e:
        print(f'  [警告] 查詢最新日期失敗：{e}')
    return '2021-01-01'


def get_available_batches(session: requests.Session) -> list:
    """從頁面解析可用的前期批次日期列表（YYYYMMDD），依日期排序。"""
    try:
        resp = session.get(HISTORY_LIST_URL, timeout=15)
        dates = re.findall(r"downloadLast\('(\d{8})'\)", resp.text)
        return sorted(set(dates))
    except Exception as e:
        print(f'  [警告] 取得批次清單失敗：{e}')
        return []


def read_tainan_csv(raw_bytes: bytes, is_presale: bool):
    """解析 CSV bytes → DataFrame（跳過英文說明行）。"""
    raw = raw_bytes.decode('utf-8-sig', errors='replace')
    lines = raw.splitlines()
    if len(lines) < 3:
        return None
    # 第2行為英文說明，跳過
    if len(lines) > 1 and not lines[1][:2].strip().isdigit() and lines[1].startswith(('The ', 'Build')):
        raw = '\n'.join([lines[0]] + lines[2:])
    try:
        df = pd.read_csv(io.StringIO(raw), dtype=str, low_memory=False)
        return df if not df.empty else None
    except Exception:
        return None


# ── 下載函數 ──────────────────────────────────────────────────────

def fetch_current_period(session: requests.Session) -> list:
    """下載本期台南 CSV，回傳 [(DataFrame, is_presale), ...]。"""
    results = []
    for fname, is_presale in [('d_lvr_land_a.csv', False), ('d_lvr_land_b.csv', True)]:
        url = CURRENT_DL_URL.format(fname=fname)
        try:
            resp = session.get(url, timeout=30)
            if resp.status_code != 200 or len(resp.content) < 500:
                continue
            df = read_tainan_csv(resp.content, is_presale)
            if df is not None:
                results.append((df, is_presale))
        except Exception as e:
            print(f'  [警告] 本期 {fname} 下載失敗：{e}')
    return results


def fetch_history_batch(session: requests.Session, date_str: str) -> list:
    """下載前期 ZIP，解壓取出台南 a/b 檔，回傳 [(DataFrame, is_presale), ...]。"""
    url = HISTORY_DL_URL.format(date_str=date_str)
    try:
        resp = session.get(url, timeout=60)
        if resp.status_code != 200 or len(resp.content) < 500:
            return []
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        results = []
        for name in zf.namelist():
            lower = name.lower()
            if 'd_lvr_land_a' in lower:
                is_presale = False
            elif 'd_lvr_land_b' in lower:
                is_presale = True
            else:
                continue
            df = read_tainan_csv(zf.read(name), is_presale)
            if df is not None:
                results.append((df, is_presale))
        return results
    except Exception as e:
        print(f'  [警告] 批次 {date_str} 下載失敗：{e}')
        return []


def process_dfs(dfs: list, label: str):
    """處理多個 (DataFrame, is_presale)，回傳 (inserted, skipped)。"""
    total_ins = total_skip = 0
    for df, is_presale in dfs:
        i, s = process_df_auto_season(df, is_presale)
        total_ins += i
        total_skip += s
    return total_ins, total_skip


# ── 主流程 ────────────────────────────────────────────────────────

def main():
    today = date.today()
    season = get_latest_season()
    print(f'月度更新 — 執行日期：{today}，當前季別：{season}')
    print('=' * 55)

    session = make_session()

    # ── 1. 嘗試季批次 ────────────────────────────────────────────
    print(f'\n[1/3] 季批次 {season}')
    process_season(session, season)

    # ── 2. 前期批次（補缺）──────────────────────────────────────
    print('\n[2/3] 前期批次補缺')
    last_date = get_last_db_date()
    print(f'  DB 最新日期：{last_date}')

    all_batches = get_available_batches(session)
    print(f'  可用批次：{all_batches}')

    # 批次日期 YYYYMMDD → ISO：20260401 → 2026-04-01
    def batch_to_iso(d: str) -> str:
        return f'{d[:4]}-{d[4:6]}-{d[6:]}'

    missing = [b for b in all_batches if batch_to_iso(b) > last_date]
    print(f'  需補缺批次：{missing}')

    for batch_date in missing:
        print(f'  ▶ 批次 {batch_date}', end='  ', flush=True)
        dfs = fetch_history_batch(session, batch_date)
        if not dfs:
            print('無資料')
        else:
            ins, skip = process_dfs(dfs, batch_date)
            print(f'寫入 {ins} 筆，跳過 {skip} 筆')
        time.sleep(DELAY_SEC)

    # ── 3. 本期（最新10天）──────────────────────────────────────
    print('\n[3/3] 本期下載（最新10天）')
    dfs = fetch_current_period(session)
    if not dfs:
        print('  本期無資料或下載失敗')
    else:
        ins, skip = process_dfs(dfs, 'current')
        print(f'  寫入 {ins} 筆，跳過 {skip} 筆')

    print('\n✅ 月度更新完成！')


if __name__ == '__main__':
    main()

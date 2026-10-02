"""
實價登錄 租賃資料匯入（潛在客群分析 第一期：租轉買）
來源：內政部不動產交易實價查詢服務網 季資料 d_lvr_land_c.csv（台南市 = d）

用法（執行路徑：專案根目錄）：
  python3 scripts/fetch_rentals.py                   # 最近 2 季（排程用）
  python3 scripts/fetch_rentals.py --backfill        # 110S1 起全部（與買賣資料起點一致）
  python3 scripts/fetch_rentals.py --seasons 115S2
  python3 scripts/fetch_rentals.py --seasons 115S2 --dry-run

前置：先在 Supabase SQL Editor 執行 supabase/migrations/20261002_potential_buyers.sql
"""

from __future__ import annotations

import argparse
import io
import os
import sys
import time
from datetime import date

import pandas as pd
import requests
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from gov_http import gov_session  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

URL = 'https://plvr.land.moi.gov.tw/DownloadSeason?season={season}&fileName=d_lvr_land_c.csv'
BACKFILL_START = (110, 1)
BATCH_SIZE = 500
DELAY_SEC = 1.5


def make_session() -> requests.Session:
    s = gov_session('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    Referer='https://plvr.land.moi.gov.tw/DownloadOpenData')
    try:
        s.get('https://plvr.land.moi.gov.tw/DownloadOpenData', timeout=10)
    except requests.RequestException:
        pass
    return s


def seasons_between(start: tuple[int, int], end: tuple[int, int]) -> list[str]:
    out, (y, q) = [], start
    while (y, q) <= end:
        out.append(f'{y}S{q}')
        y, q = (y + 1, 1) if q == 4 else (y, q + 1)
    return out


def current_season() -> tuple[int, int]:
    t = date.today()
    return t.year - 1911, (t.month - 1) // 3 + 1


def roc_date_to_iso(v: str):
    s = str(v).strip()
    if len(s) != 7 or not s.isdigit():
        return None
    try:
        return date(int(s[:3]) + 1911, int(s[3:5]), int(s[5:7])).isoformat()
    except ValueError:
        return None


def num(v, cast=float, cap=None):
    try:
        s = str(v).strip()
        if s in ('', 'nan', 'NaN'):
            return None
        x = cast(float(s))
        return min(x, cap) if cap is not None else x
    except (TypeError, ValueError):
        return None


def yn(v):
    s = str(v).strip()
    return True if s == '有' else False if s == '無' else None


def download(session: requests.Session, season: str) -> pd.DataFrame | None:
    try:
        r = session.get(URL.format(season=season), timeout=60)
    except requests.RequestException as e:
        print(f'  {season}: 下載失敗（{e.__class__.__name__}）')
        return None
    if r.status_code != 200 or len(r.content) < 1000:
        return None
    lines = r.content.decode('utf-8-sig', errors='replace').splitlines()
    if len(lines) > 1 and lines[1].startswith('The '):   # 第 2 行為英文欄名
        lines = [lines[0]] + lines[2:]
    df = pd.read_csv(io.StringIO('\n'.join(lines)), dtype=str, keep_default_na=False)
    return df if not df.empty else None


def to_record(row: dict, season: str) -> dict:
    g = lambda k: str(row.get(k, '')).strip()
    return {
        'serial_number': g('編號'),
        'source_season': season,
        'district': g('鄉鎮市區'),
        'rental_target': g('交易標的'),
        'address': g('土地位置建物門牌'),
        'rental_date': roc_date_to_iso(g('租賃年月日')),
        'floor': g('租賃層次'),
        'total_floors': num(g('總樓層數'), int, 200),
        'building_type': g('建物型態'),
        'main_use': g('主要用途'),
        'completion_date': g('建築完成年月'),
        'building_area_sqm': num(g('建物總面積平方公尺')),
        'rooms': num(g('建物現況格局-房'), int, 99),
        'living_rooms': num(g('建物現況格局-廳'), int, 99),
        'bathrooms': num(g('建物現況格局-衛'), int, 99),
        'has_management': yn(g('有無管理組織')),
        'has_furniture': yn(g('有無附傢俱')),
        'has_elevator': yn(g('有無電梯')),
        'monthly_rent': num(g('總額元'), int),
        'unit_rent_sqm': num(g('單價元平方公尺')),
        'parking_type': g('車位類別'),
        'parking_rent': num(g('車位總額元'), int),
        'rental_type': g('出租型態'),
        'rental_period': g('租賃期間'),
        'equipment': g('附屬設備'),
        'rental_service': g('租賃住宅服務'),
        'notes': g('備註'),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--seasons', nargs='*')
    ap.add_argument('--backfill', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if args.seasons:
        seasons = args.seasons
    elif args.backfill:
        seasons = seasons_between(BACKFILL_START, current_season())
    else:
        seasons = seasons_between(BACKFILL_START, current_season())[-2:]

    sb = None
    if not args.dry_run:
        from supabase import create_client
        sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'],
                           os.environ['SUPABASE_SERVICE_ROLE_KEY'])

    session = make_session()
    print(f'租賃實價登錄：{seasons[0]} ~ {seasons[-1]}')
    for season in seasons:
        df = download(session, season)
        if df is None:
            print(f'  {season}: 無資料，跳過')
            continue
        records, seen = [], set()
        for row in df.to_dict('records'):
            rec = to_record(row, season)
            if not rec['serial_number'] or not rec['rental_date'] or rec['serial_number'] in seen:
                continue
            seen.add(rec['serial_number'])
            records.append(rec)
        if args.dry_run:
            homes = [r for r in records if r['main_use'] == '住家用' and r['monthly_rent']]
            med = sorted(r['monthly_rent'] for r in homes)[len(homes) // 2] if homes else None
            print(f'  {season}: {len(records)} 筆（住家用 {len(homes)} 筆，月租中位數 {med} 元）— dry-run 未寫入')
        else:
            for k in range(0, len(records), BATCH_SIZE):
                sb.table('rentals').upsert(records[k:k + BATCH_SIZE],
                                           on_conflict='serial_number').execute()
            print(f'  {season}: upsert {len(records)} 筆')
        time.sleep(DELAY_SEC)


if __name__ == '__main__':
    main()

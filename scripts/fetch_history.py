"""
歷史資料初始化腳本
抓取台南市民國110年Q1至今的實價登錄買賣資料（成屋+預售屋），寫入 Supabase。

執行路徑：/Users/nuck/AI/RealEstatePrice
執行方式：python3 scripts/fetch_history.py
"""

import io
import os
import time
import zipfile
from datetime import date

import pandas as pd
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 台南市買賣 CSV 下載 URL（季別格式：115S1）
# a = 成屋買賣，b = 預售屋買賣
BASE_URL = 'https://plvr.land.moi.gov.tw/DownloadSeason?season={season}&fileName={fname}'
BATCH_SIZE = 500
START_YEAR = 110
DELAY_SEC  = 1.5


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://plvr.land.moi.gov.tw/DownloadOpenData',
    })
    s.get('https://plvr.land.moi.gov.tw/DownloadOpenData', timeout=10)
    return s


def get_seasons(start_year: int) -> list:
    today = date.today()
    roc_year = today.year - 1911
    current_q = (today.month - 1) // 3 + 1
    seasons = []
    for y in range(start_year, roc_year + 1):
        max_q = current_q if y == roc_year else 4
        for q in range(1, max_q + 1):
            seasons.append(f'{y}S{q}')
    return seasons


def roc_date_to_iso(roc_str: str):
    s = str(roc_str).strip()
    if len(s) != 7 or not s.isdigit():
        return None
    try:
        return date(int(s[:3]) + 1911, int(s[3:5]), int(s[5:7])).isoformat()
    except ValueError:
        return None


def safe_int(val, default=None):
    try:
        v = str(val).strip()
        return int(float(v)) if v not in ('', 'nan', 'NaN') else default
    except (ValueError, TypeError):
        return default


def safe_float(val, default=None):
    try:
        v = str(val).strip()
        return float(v) if v not in ('', 'nan', 'NaN') else default
    except (ValueError, TypeError):
        return default


def safe_bool(val):
    s = str(val).strip()
    if s in ('有', 'Y', 'y', '1', '是'):
        return True
    if s in ('無', 'N', 'n', '0', '否'):
        return False
    return None


def download_csv(session: requests.Session, season: str, fname: str):
    url = BASE_URL.format(season=season, fname=fname)
    try:
        resp = session.get(url, timeout=30)
        if resp.status_code != 200 or len(resp.content) < 1000:
            return None
        raw = resp.content.decode('utf-8-sig', errors='replace')
        lines = raw.splitlines()
        # 跳過第2行英文說明
        if len(lines) > 1 and not lines[1][:1].encode('utf-8').isdigit():
            raw = '\n'.join([lines[0]] + lines[2:])
        df = pd.read_csv(io.StringIO(raw), dtype=str, low_memory=False)
        return df if not df.empty else None
    except Exception as e:
        print(f'  [錯誤] {season}/{fname} 下載失敗：{e}')
        return None


def parse_row(row: pd.Series, season: str, is_presale: bool = False) -> dict:
    idx = {c.strip(): c for c in row.index}

    def get(col):
        c = idx.get(col)
        if c is None:
            return ''
        v = str(row[c]).strip()
        return '' if v in ('nan', 'NaN') else v

    return {
        'serial_number':           get('編號') or get('移轉編號'),
        'source_season':           season,
        'is_presale':              is_presale,
        'district':                get('鄉鎮市區'),
        'address':                 get('土地位置建物門牌'),
        'transaction_date':        roc_date_to_iso(get('交易年月日')),
        'transaction_target':      get('交易標的'),
        'transaction_pen_count':   get('交易筆棟數'),
        'land_area_sqm':           safe_float(get('土地移轉總面積平方公尺')),
        'urban_land_use':          get('都市土地使用分區'),
        'non_urban_land_use':      get('非都市土地使用分區'),
        'building_type':           get('建物型態'),
        'main_use':                get('主要用途'),
        'main_material':           get('主要建材'),
        'completion_date':         get('建築完成年月'),
        'building_area_sqm':       safe_float(get('建物移轉總面積平方公尺')),
        'main_building_area_sqm':  safe_float(get('主建物面積')),
        'auxiliary_building_area': safe_float(get('附屬建物面積')),
        'balcony_area_sqm':        safe_float(get('陽台面積')),
        'floor':                   get('移轉層次'),
        'total_floors':            min(safe_int(get('總樓層數')) or 0, 200) or None,
        'has_elevator':            safe_bool(get('電梯')),
        'rooms':                   min(safe_int(get('建物現況格局-房')) or 0, 99) or None,
        'living_rooms':            min(safe_int(get('建物現況格局-廳')) or 0, 99) or None,
        'bathrooms':               min(safe_int(get('建物現況格局-衛')) or 0, 99) or None,
        'has_management':          safe_bool(get('有無管理組織')),
        'parking_type':            get('車位類別'),
        'parking_area_sqm':        safe_float(get('車位移轉總面積平方公尺')),
        'parking_price':           safe_int(get('車位總價元')),
        'total_price':             safe_int(get('總價元')),
        'unit_price_sqm':          safe_float(get('單價元平方公尺')),
        'notes':                   get('備註'),
        'project_name':            get('建案名稱') if is_presale else None,
    }


def upsert_batch(records: list, season: str):
    try:
        supabase.table('transactions').upsert(
            records,
            on_conflict='source_season,serial_number',
            ignore_duplicates=True
        ).execute()
        return len(records), 0
    except Exception as e:
        print(f'  [寫入錯誤] {e}')
        return 0, len(records)


def log_scrape(season, status, inserted, skipped, error=None):
    try:
        supabase.table('scrape_logs').insert({
            'season': season, 'status': status,
            'rows_inserted': inserted, 'rows_skipped': skipped,
            'error_message': error,
        }).execute()
    except Exception as e:
        print(f'  [log 錯誤] {e}')


def process_df(df, season: str, is_presale: bool):
    """處理 DataFrame，過濾並回傳筆數。"""
    # 只保留含建物的交易
    if '交易標的' in df.columns:
        df = df[df['交易標的'].str.contains('建物', na=False)]

    # 預售屋：排除解約案件
    if is_presale and '解約情形' in df.columns:
        df = df[df['解約情形'].isna() | (df['解約情形'].str.strip() == '')]

    total_ins = total_skip = 0
    batch = []
    for _, row in df.iterrows():
        rec = parse_row(row, season, is_presale=is_presale)
        if not rec['district'] or not rec['transaction_date']:
            continue
        batch.append(rec)
        if len(batch) >= BATCH_SIZE:
            i, s = upsert_batch(batch, season)
            total_ins += i; total_skip += s; batch = []
    if batch:
        i, s = upsert_batch(batch, season)
        total_ins += i; total_skip += s

    return total_ins, total_skip


def process_season(session: requests.Session, season: str):
    print(f'▶ {season}', end='  ', flush=True)
    total_ins = total_skip = 0

    # 成屋買賣（a 檔）
    df_a = download_csv(session, season, 'd_lvr_land_a.csv')
    if df_a is not None:
        i, s = process_df(df_a, season, is_presale=False)
        total_ins += i; total_skip += s

    # 預售屋（b 檔，從 110S2 開始才有）
    df_b = download_csv(session, season, 'd_lvr_land_b.csv')
    if df_b is not None:
        i, s = process_df(df_b, season, is_presale=True)
        total_ins += i; total_skip += s

    if total_ins == 0 and total_skip == 0:
        log_scrape(season, 'failed', 0, 0, '無資料或下載失敗')
        print('無資料')
        return

    log_scrape(season, 'success', total_ins, total_skip)
    print(f'寫入 {total_ins} 筆，跳過 {total_skip} 筆')


def main():
    seasons = get_seasons(START_YEAR)
    print(f'台南市實價登錄歷史初始化（成屋 + 預售屋）')
    print(f'共 {len(seasons)} 個季別：{seasons[0]} ～ {seasons[-1]}')
    print('=' * 50)

    session = make_session()
    for i, season in enumerate(seasons):
        process_season(session, season)
        if i < len(seasons) - 1:
            time.sleep(DELAY_SEC)

    print('\n✅ 歷史資料初始化完成！')


if __name__ == '__main__':
    main()

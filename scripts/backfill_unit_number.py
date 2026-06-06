"""
backfill_unit_number.py
從原始 CSV 重新下載並 UPSERT 預售屋資料（含 unit_number）
使用 on_conflict update（非 ignore_duplicates），讓既有記錄的 unit_number 被更新
"""

import os, sys, io, time, re
import requests, pandas as pd
from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(line_buffering=True)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

BASE_URL = 'https://plvr.land.moi.gov.tw/DownloadSeason?season={season}&fileName={fname}'
BATCH    = 500

SEASONS = [
    '110S2','110S3','110S4',
    '111S1','111S2','111S3','111S4',
    '112S1','112S2','112S3','112S4',
    '113S1','113S2','113S3','113S4',
    '114S1','114S2','114S3','114S4',
    '115S1','115S2',
]

def safe_float(v):
    try: f = float(v); return f if f == f else None
    except: return None

def safe_int(v):
    try: return int(float(v))
    except: return None

def safe_bool(v):
    if not v: return None
    return str(v).strip() in ('有', 'Y', 'y', '1', 'True', 'true')

def roc_date_to_iso(v):
    v = str(v).strip().replace('/', '')
    if len(v) < 7: return None
    try:
        y = int(v[:3]) + 1911
        m = int(v[3:5])
        d = int(v[5:7])
        return f'{y:04d}-{m:02d}-{d:02d}'
    except: return None

def download_csv(season, fname):
    url = BASE_URL.format(season=season, fname=fname)
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code != 200: return None
        raw = resp.content.decode('utf-8-sig', errors='replace')
        lines = raw.splitlines()
        if len(lines) < 3: return None
        clean = '\n'.join([lines[0]] + lines[2:])
        df = pd.read_csv(io.StringIO(clean), dtype=str, low_memory=False)
        return df if not df.empty else None
    except Exception as e:
        print(f'  [下載失敗] {e}')
        return None

def parse_row(row, season):
    idx = {c.strip(): c for c in row.index}
    def get(col):
        c = idx.get(col)
        if c is None: return ''
        v = str(row[c]).strip()
        return '' if v in ('nan','NaN') else v

    return {
        'serial_number':           get('編號') or get('移轉編號'),
        'source_season':           season,
        'is_presale':              True,
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
        'floor':                   get('移轉層次'),
        'total_floors':            min(safe_int(get('總樓層數')) or 0, 200) or None,
        'rooms':                   min(safe_int(get('建物現況格局-房')) or 0, 99) or None,
        'living_rooms':            min(safe_int(get('建物現況格局-廳')) or 0, 99) or None,
        'bathrooms':               min(safe_int(get('建物現況格局-衛')) or 0, 99) or None,
        'parking_type':            get('車位類別'),
        'parking_area_sqm':        safe_float(get('車位移轉總面積平方公尺')),
        'parking_price':           safe_int(get('車位總價元')),
        'total_price':             safe_int(get('總價元')),
        'unit_price_sqm':          safe_float(get('單價元平方公尺')),
        'notes':                   get('備註'),
        'project_name':            get('建案名稱') or None,
        'unit_number':             get('棟及號') or None,
    }

total_updated = 0

for season in SEASONS:
    print(f'▶ {season}', end='  ', flush=True)
    df = download_csv(season, 'd_lvr_land_b.csv')
    if df is None:
        print('無資料')
        time.sleep(0.5)
        continue

    # 排除解約
    if '解約情形' in df.columns:
        df = df[df['解約情形'].isna() | (df['解約情形'].str.strip() == '')]
    # 只留含建物
    if '交易標的' in df.columns:
        df = df[df['交易標的'].str.contains('建物', na=False)]

    records = []
    for _, row in df.iterrows():
        rec = parse_row(row, season)
        if rec['serial_number'] and rec['transaction_date']:
            records.append(rec)

    if not records:
        print('無有效資料')
        continue

    # 批次 upsert（on_conflict update，更新 unit_number 等所有欄位）
    ok = 0
    for i in range(0, len(records), BATCH):
        batch = records[i:i+BATCH]
        try:
            sb.table('transactions').upsert(
                batch,
                on_conflict='source_season,serial_number',
                ignore_duplicates=False   # ← 覆蓋既有記錄
            ).execute()
            ok += len(batch)
        except Exception as e:
            print(f'\n  [upsert 錯誤] {e}')
            time.sleep(2)

    total_updated += ok
    print(f'更新 {ok} 筆')
    time.sleep(0.3)

print(f'\n✅ 完成！共更新 {total_updated} 筆')

"""
預售屋備查建案下載腳本
下載台南市全部備查建案（含核准總戶數），寫入 presale_projects 資料表。

資料來源：
  https://plvr.land.moi.gov.tw/Download?fileName=d_lvr_buildcase.csv&PayType=saleremark

執行方式：python3 scripts/fetch_buildcase.py
"""

import io
import os
import sys

import pandas as pd
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

BUILDCASE_URL = (
    'https://plvr.land.moi.gov.tw/Download'
    '?fileName=d_lvr_buildcase.csv&PayType=saleremark'
)
BATCH_SIZE = 200


def download_buildcase():
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://plvr.land.moi.gov.tw/DownloadOpenData',
    }
    # 先取 cookie
    session = requests.Session()
    session.headers.update(headers)
    session.get('https://plvr.land.moi.gov.tw/DownloadOpenData', timeout=10)

    try:
        resp = session.get(BUILDCASE_URL, timeout=30)
        if resp.status_code != 200 or len(resp.content) < 500:
            print(f'  下載失敗：HTTP {resp.status_code}')
            return None

        raw = resp.content.decode('utf-8-sig', errors='replace')
        lines = raw.splitlines()

        # 第 2 行是英文說明，跳過
        if len(lines) > 1 and lines[1].startswith('TOWN'):
            lines = [lines[0]] + lines[2:]

        # 部分欄位（如銷售期間）內含逗號，導致欄數不固定
        # 只取前 5 欄：鄉鎮市區, 建案名稱, 坐落街道, 起造人, 層棟戶數
        TARGET_COLS = 5
        cleaned = []
        header_done = False
        for line in lines:
            line = line.strip()
            if not line:
                continue
            parts = line.split(',')
            if not header_done:
                cleaned.append(','.join(parts[:TARGET_COLS]))
                header_done = True
            else:
                cleaned.append(','.join(parts[:TARGET_COLS]))

        df = pd.read_csv(
            io.StringIO('\n'.join(cleaned)),
            dtype=str, low_memory=False,
            on_bad_lines='skip'
        )
        df.columns = df.columns.str.strip()
        return df if not df.empty else None

    except Exception as e:
        print(f'  下載例外：{e}')
        return None


def parse_units(val: str):
    """層棟戶數 → int（幾乎都是純數字）"""
    v = str(val).strip()
    if v.isdigit():
        return int(v)
    return None


def main():
    print('下載台南市預售屋備查建案…')
    df = download_buildcase()
    if df is None:
        print('❌ 下載失敗，請稍後再試。')
        sys.exit(1)

    print(f'  共 {len(df)} 筆')

    records = []
    skip = 0
    for _, row in df.iterrows():
        name = str(row.get('建案名稱', '')).strip()
        if not name:
            skip += 1
            continue

        total_units = parse_units(row.get('層棟戶數', ''))

        records.append({
            'project_name': name,
            'district':     str(row.get('鄉鎮市區', '')).strip() or None,
            'total_units':  total_units,
            'builder':      str(row.get('起造人', '')).strip()[:200] or None,
            'address':      str(row.get('坐落街道', '')).strip()[:200] or None,
            'declare_date': str(row.get('申報備查日期', '')).strip() or None,
        })

    print(f'  有效建案 {len(records)} 筆，略過 {skip} 筆')

    # Upsert（以建案名稱為主鍵）
    inserted = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        try:
            supabase.table('presale_projects').upsert(
                batch, on_conflict='project_name'
            ).execute()
            inserted += len(batch)
        except Exception as e:
            print(f'  [寫入錯誤] {e}')

    print(f'✅ 寫入 {inserted} 筆備查建案到 presale_projects')
    return inserted


if __name__ == '__main__':
    main()

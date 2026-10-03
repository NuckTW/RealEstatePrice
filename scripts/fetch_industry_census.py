"""
工業及服務業普查（行政區 × 行業）＋ 行政區工商家數（SEGIS，最新一期）→ housing_market_stats

A. 主計總處 110 年工業及服務業普查「臺南市報告書統計表」（xlsx，5 年一次，下次為 115 年）
   - 表 8：工業及服務業場所單位經營概況－按行政區別分（全行業）
   - 表 17、20、23 …、62：各大行業場所單位經營概況－按行政區別分
     → census_units:{行業}、census_employees:{行業}、census_output:{行業}（千元）
   - 表 10：場所單位年底從業員工人數－按行政區別分 → census_officers（職員＝監督及專技人員）
   - 105 年普查為舊版 .xls（需額外套件），使用者決定不匯入
B. 內政部 SEGIS「行政區工商家數_鄉鎮市區」開放服務（JSON，固定回傳最新一期）
   → biz_count:{行業}（家）；每年執行一次即可逐年累積趨勢
   - 歷史期別的 CSV 下載需網頁動態驗證碼，不以程式抓取

xlsx 以標準函式庫（zipfile + xml）解析，不需額外套件。

用法（執行路徑：專案根目錄）：
  python3 scripts/fetch_industry_census.py              # 普查 110 年 + 工商家數最新一期
  python3 scripts/fetch_industry_census.py --only segis # 只更新工商家數（排程用）
  python3 scripts/fetch_industry_census.py --dry-run

前置：supabase/migrations/20261006_income_school_poi.sql（housing_market_stats 已允許年資料 'Y'）
"""

from __future__ import annotations

import argparse
import io
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from gov_http import gov_session  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

# 110 年普查臺南市報告書統計表（stat.gov.tw「110年臺南市-報告書統計表」頁面上的附件）
CENSUS_YEAR = '110'
CENSUS_BASE = 'https://ws.dgbas.gov.tw/001/Upload/463/relfile/11059/233925/{n}.xlsx'

# 表號 → 行業代號（場所單位經營概況－按行政區別分）
CENSUS_TABLES = {
    8: 'all', 17: 'mfg', 20: 'electricity', 23: 'water', 26: 'construction', 29: 'trade',
    32: 'transport', 35: 'accommodation', 38: 'ict', 41: 'finance', 44: 'realestate',
    47: 'professional', 50: 'support', 53: 'education', 56: 'health', 59: 'arts', 62: 'other',
}
OFFICERS_TABLE = 10

# SEGIS 行政區工商家數_鄉鎮市區（開放服務，回傳最新一期）
SEGIS_URL = ('https://segisws.moi.gov.tw/STATWSSTData/OpenService.asmx/GetAdminSTDataForOpenCode'
             '?oCode=BF3B727F423963563B5AF84EB798086232103283DD3567E77D559ED93B6B9791CD125DF01BE66FCED5421BC7960893AF')
SEGIS_COLS = {
    'C_CNT': 'all', 'C1_A_CNT': 'agriculture', 'C1_B_CNT': 'mining', 'C1_C_CNT': 'mfg',
    'C1_D_CNT': 'electricity', 'C1_E_CNT': 'water', 'C1_F_CNT': 'construction', 'C1_G_CNT': 'trade',
    'C1_H_CNT': 'transport', 'C1_I_CNT': 'accommodation', 'C1_J_CNT': 'ict', 'C1_K_CNT': 'finance',
    'C1_L_CNT': 'realestate', 'C1_M_CNT': 'professional', 'C1_N_CNT': 'support', 'C1_O_CNT': 'public',
    'C1_P_CNT': 'education', 'C1_Q_CNT': 'health', 'C1_R_CNT': 'arts', 'C1_S_CNT': 'other',
}

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def safe_xml(data: bytes) -> ET.Element:
    """解析前拒絕 DTD／實體宣告，避免 XXE 與 billion-laughs（xlsx 正常不會有這些宣告）"""
    head = data[:4096].upper()
    if b'<!DOCTYPE' in head or b'<!ENTITY' in data.upper():
        raise ValueError('xlsx 內含 DTD／ENTITY 宣告，拒絕解析')
    return ET.fromstring(data)


def read_xlsx(raw: bytes, sheet: int = 1) -> list[list[str]]:
    """最小 xlsx 讀取器：回傳二維字串陣列（只處理共用字串、內嵌字串與數值）"""
    z = zipfile.ZipFile(io.BytesIO(raw))
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in safe_xml(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter(f'{{{NS["m"]}}}t')))
    rows = []
    for r in safe_xml(z.read(f'xl/worksheets/sheet{sheet}.xml')).iter(f'{{{NS["m"]}}}row'):
        cells = {}
        for c in r.findall('m:c', NS):
            col = 0
            for ch in re.match(r'[A-Z]+', c.get('r')).group():
                col = col * 26 + ord(ch) - 64
            v = c.find('m:v', NS)
            if c.get('t') == 's' and v is not None:
                val = shared[int(v.text)]
            elif c.get('t') == 'inlineStr':
                val = ''.join(x.text or '' for x in c.iter(f'{{{NS["m"]}}}t'))
            else:
                val = v.text if v is not None else ''
            cells[col - 1] = val
        if cells:
            rows.append([cells.get(k, '') for k in range(max(cells) + 1)])
    return rows


def num(v) -> float | None:
    s = str(v).replace(',', '').strip()
    try:
        return float(s)
    except ValueError:
        return None      # '－'、'(D)' 等不揭露或無資料


def find_col(rows: list[list[str]], keyword: str) -> int:
    """在表頭（前 14 列）找含關鍵字的欄位"""
    for r in rows[:14]:
        for i, v in enumerate(r):
            if keyword in str(v).replace(' ', '').replace('　', ''):
                return i
    raise RuntimeError(f'找不到欄位「{keyword}」')


def area_rows(rows: list[list[str]]):
    """回傳 [(area_level, area, row)]：第 2 欄「總計」為全市，第 3 欄「○○區」為行政區"""
    for r in rows:
        a = str(r[1]).replace('　', '').strip() if len(r) > 1 else ''
        b = str(r[2]).replace('　', '').strip() if len(r) > 2 else ''
        if a == '總計':
            yield 'city', '臺南市', r
        elif b.endswith('區') and len(b) <= 4:
            yield 'district', b, r


def row(indicator, level, area, period, value):
    return {'indicator': indicator, 'area_level': level, 'area': area, 'period': period,
            'period_type': 'Y', 'period_date': f'{int(period) + 1911}-01-01', 'value': value, 'source': 'dgbas'}


def census(session) -> list[dict]:
    out = []
    for n, ind in CENSUS_TABLES.items():
        rows = read_xlsx(session.get(CENSUS_BASE.format(n=n), timeout=60).content)
        cu, ce, co = find_col(rows, '年底場所單位數'), find_col(rows, '年底從業'), find_col(rows, '全年生產總額')
        k = 0
        for level, area, r in area_rows(rows):
            for key, col in (('census_units', cu), ('census_employees', ce), ('census_output', co)):
                v = num(r[col]) if col < len(r) else None
                if v is not None:
                    out.append(row(f'{key}:{ind}', level, area, CENSUS_YEAR, v))
            k += 1
        if k < 38:
            print(f'  ⚠️ 表 {n}（{ind}）只有 {k} 列地區')
    rows = read_xlsx(session.get(CENSUS_BASE.format(n=OFFICERS_TABLE), timeout=60).content)
    col = find_col(rows, '職員')
    for level, area, r in area_rows(rows):
        v = num(r[col])
        if v is not None:
            out.append(row('census_officers', level, area, CENSUS_YEAR, v))
    print(f'  普查 {CENSUS_YEAR} 年：{len(out)} 筆（{len(CENSUS_TABLES)} 個行業表 + 職員）')
    return out


def segis(session) -> list[dict]:
    d = session.get(SEGIS_URL, timeout=120).json()
    out = []
    period = None
    for r in d.get('RowDataList') or []:
        if r.get('COUNTY') != '臺南市':
            continue
        period = re.match(r'(\d+)Y', r['INFO_TIME']).group(1)   # '114Y12M' → '114'（年底）
        for col, ind in SEGIS_COLS.items():
            v = r.get(col)
            if v is not None:
                out.append({**row(f'biz_count:{ind}', 'district', r['TOWN'], period, float(v)), 'source': 'segis'})
    # 全市 = 各區加總（開放服務只有鄉鎮市區列）
    totals: dict[str, float] = {}
    for x in out:
        totals[x['indicator']] = totals.get(x['indicator'], 0) + x['value']
    out += [{**row(k, 'city', '臺南市', period, v), 'source': 'segis'} for k, v in totals.items()]
    print(f'  工商家數 {period} 年底：{len(out)} 筆（{len({x["area"] for x in out}) - 1} 區）')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', choices=['census', 'segis'])
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    s = gov_session()
    rows = []
    if args.only in (None, 'census'):
        rows += census(s)
    if args.only in (None, 'segis'):
        rows += segis(s)

    if args.dry_run:
        for k in ('census_employees:all', 'census_employees:mfg', 'census_officers', 'biz_count:all'):
            x = next((r for r in rows if r['indicator'] == k and r['area'] == '臺南市'), None)
            if x:
                print(f'    臺南市 {k}：{x["period"]} = {x["value"]:,.0f}')
        print('（dry-run，未寫入）')
        return

    from supabase import create_client
    sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    for k in range(0, len(rows), 500):
        sb.table('housing_market_stats').upsert(rows[k:k + 500], on_conflict='indicator,area_level,area,period').execute()
    print(f'已寫入 {len(rows)} 筆')


if __name__ == '__main__':
    main()

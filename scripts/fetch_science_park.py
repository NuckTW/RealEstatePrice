"""
科學園區從業員工數匯入（潛在客群分析 第二期：南科就業動能）

來源（皆為國科會）：
  1. 統計資料庫 ScienceParkReport（園區級，105 年 11 月起逐月）
     https://wsts.nstc.gov.tw/STSWeb/sciencepark/ScienceParkReport.aspx?language=C&quyid=tqemployees01
     ASP.NET 表單：帶 __VIEWSTATE 等隱藏欄位 POST，期間下拉值為民國年月（'11508'）
  2. 政府資料開放平臺 7599 CSV（子園區級，只有最新一期、沒有日期欄）
     https://mas.nstc.gov.tw/OPENDATA/GetFile?format=csv&serialno=75&fileodr=0
     → 以「南科合計 = 統計資料庫最新月份南科總數」確認是同一期才寫入
  3. 政府資料開放平臺 101986 南科管理局從業員工產業別統計（年，目前 107～113 年）
     https://mas.nstc.gov.tw/OPENDATA/GetFile?format=csv&serialno=398&fileodr=2
     → science_park_industry_yearly（每次全量覆寫）

用法（執行路徑：專案根目錄）：
  python3 scripts/fetch_science_park.py                 # 最近 3 個月 + 子園區最新一期（排程用）
  python3 scripts/fetch_science_park.py --backfill      # 105 年 11 月起全部
  python3 scripts/fetch_science_park.py --dry-run       # 不寫 DB，只印出

前置：先在 Supabase SQL Editor 執行 supabase/migrations/20261003_science_park_employees.sql
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import re
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from gov_http import gov_session  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

WSTS_URL = 'https://wsts.nstc.gov.tw/STSWeb/sciencepark/ScienceParkReport.aspx?language=C&quyid=tqemployees01'
CSV_URL = 'https://mas.nstc.gov.tw/OPENDATA/GetFile?format=csv&serialno=75&fileodr=0'
INDUSTRY_URL = 'https://mas.nstc.gov.tw/OPENDATA/GetFile?format=csv&serialno=398&fileodr=2'
RECENT_MONTHS = 3
EDU_COLS = ['phd', 'master', 'bachelor', 'associate', 'high_school', 'other']
PARKS = ('新竹科學園區', '中部科學園區', '南部科學園區')


def ym_to_date(ym: str) -> str:
    return f'{int(ym[:-2]) + 1911}-{ym[-2:]}-01'


def to_int(s: str) -> int:
    return int(s.replace(',', '').strip() or 0)


# ── 來源 1：統計資料庫（園區級） ────────────────────────────────

def wsts_query(session, begin: str, end: str) -> tuple[list[str], list[dict]]:
    """回傳（可選月份清單，新→舊）與查詢期間內各月各園區資料"""
    html = session.get(WSTS_URL, timeout=60).text
    months = re.findall(r'<option[^>]*value="(\d{5})"', html)
    months = list(dict.fromkeys(months))   # 兩個下拉選單選項相同，去重保序
    if not months:
        raise RuntimeError('統計資料庫頁面結構改變：找不到期間選項')

    form = dict(re.findall(r'<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"', html))
    form.update({
        'ctl00$holderMain$ddlData_PeriodBQ': begin,
        'ctl00$holderMain$ddlData_PeriodEQ': end,
        'ctl00$holderMain$chkAll': 'on',
        'ctl00$holderMain$chkArea1': 'on',
        'ctl00$holderMain$chkArea2': 'on',
        'ctl00$holderMain$chkArea3': 'on',
        'ctl00$holderMain$btnQuery': '製作統計表',
    })
    res = session.post(WSTS_URL, data=form, timeout=120).text

    # 去標籤後以「|」分隔，每個月份區塊以「資料期間：YYYY年M月」開頭
    text = re.sub(r'<script.*?</script>', '', res, flags=re.S)
    text = re.sub(r'<[^>]+>', '|', text)
    text = re.sub(r'\s+', '', text)
    text = re.sub(r'\|+', '|', text)

    rows = []
    blocks = re.split(r'資料期間：', text)[1:]
    for b in blocks:
        m = re.match(r'(\d{4})年(\d{1,2})月', b)
        if not m:
            continue
        ym = f'{int(m.group(1)) - 1911}{int(m.group(2)):02d}'
        for park in PARKS:
            pm = re.search(re.escape(park) + r'\|' + r'\|'.join([r'([\d,]+)'] * 7), b)
            if not pm:
                continue
            vals = [to_int(v) for v in pm.groups()]
            rows.append({
                'ym': ym, 'ym_date': ym_to_date(ym), 'park': park, 'sub_park': '合計',
                **dict(zip(EDU_COLS, vals[:6])), 'total': vals[6], 'source': 'wsts',
            })
    return months, rows


# ── 來源 2：開放資料 CSV（子園區級，最新一期） ───────────────────

def fetch_csv(session) -> list[dict]:
    raw = session.get(CSV_URL, timeout=60).content.decode('utf-8-sig')
    out = []
    for r in csv.DictReader(io.StringIO(raw)):
        out.append({
            'park': r['園區別'].strip(), 'sub_park': r['子園區'].strip(),
            'phd': to_int(r['博士(人)']), 'master': to_int(r['碩士(人)']),
            'bachelor': to_int(r['大學(人)']), 'associate': to_int(r['專科(人)']),
            'high_school': to_int(r['高中(人)']), 'other': to_int(r['其他(人)']),
            'total': to_int(r['總人數']),
        })
    return out


def fetch_industry(session) -> list[dict]:
    """南科產業別員工（年）：欄名「半導體人數」→ 產業「半導體」；「合計人數」→「合計」"""
    raw = session.get(INDUSTRY_URL, timeout=60).content.decode('utf-8-sig')
    if raw.lstrip().startswith('<script'):
        raise RuntimeError('產業別 CSV 下載失敗（網址可能改變）')
    out = []
    for r in csv.DictReader(io.StringIO(raw)):
        y = to_int(r.get('民國年', ''))
        for col, v in r.items():
            if col == '民國年' or not col.endswith('人數'):
                continue
            name = col.removesuffix('人數').replace('其他產業類別', '其他')
            out.append({'year': y, 'park': '南部科學園區', 'industry': name, 'employees': to_int(v)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--backfill', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    session = gov_session()

    # 先取可選月份，決定查詢區間
    html = session.get(WSTS_URL, timeout=60).text
    months = list(dict.fromkeys(re.findall(r'<option[^>]*value="(\d{5})"', html)))
    latest, earliest = months[0], months[-1]
    begin = earliest if args.backfill else months[min(RECENT_MONTHS, len(months)) - 1]

    # 一次查太多月份回應很大，按年分段
    park_rows: list[dict] = []
    span = [m for m in months if begin <= m <= latest][::-1]   # 舊 → 新
    for i in range(0, len(span), 12):
        chunk = span[i:i + 12]
        _, rows = wsts_query(session, chunk[0], chunk[-1])
        park_rows += rows
        print(f'  統計資料庫 {chunk[0]}～{chunk[-1]}：{len(rows)} 筆')

    south = {r['ym']: r['total'] for r in park_rows if r['park'] == '南部科學園區'}
    print(f'園區級：{len(park_rows)} 筆（{begin}～{latest}）｜南科最新 {latest} = {south.get(latest, "—"):,}')

    # 子園區：開放 CSV 的南科合計必須等於統計資料庫最新月，才能確定是 {latest} 這一期
    sub_rows: list[dict] = []
    csv_rows = fetch_csv(session)
    csv_south = next((r['total'] for r in csv_rows if r['park'] == '南部科學園區' and r['sub_park'] == '合計'), None)
    if csv_south is not None and csv_south == south.get(latest):
        sub_rows = [
            {**r, 'ym': latest, 'ym_date': ym_to_date(latest), 'source': 'opendata'}
            for r in csv_rows
            if r['park'] in PARKS and r['sub_park'] not in ('合計', '總計')
        ]
        tn = next((r['total'] for r in sub_rows if r['sub_park'] == '臺南園區'), None)
        print(f'子園區：{len(sub_rows)} 筆，對應 {latest}｜臺南園區 {tn:,}')
    else:
        print(f'⚠️ 開放 CSV 南科合計 {csv_south} ≠ 統計資料庫 {latest} 的 {south.get(latest)}，'
              '期別無法確認，子園區本次不寫入')

    industry = fetch_industry(session)
    years = sorted({r['year'] for r in industry})
    semi = {r['year']: r['employees'] for r in industry if r['industry'] == '半導體'}
    print(f'產業別：{len(industry)} 筆（{years[0]}～{years[-1]} 年）｜半導體 {years[-1]} 年 {semi.get(years[-1], 0):,}')

    if args.dry_run:
        for r in park_rows[-3:] + sub_rows[:3] + industry[:3]:
            print('   ', r)
        print('（dry-run，未寫入）')
        return

    from supabase import create_client
    sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    allrows = park_rows + sub_rows
    for k in range(0, len(allrows), 500):
        sb.table('science_park_employees_monthly').upsert(
            allrows[k:k + 500], on_conflict='ym,park,sub_park').execute()
    print(f'已寫入 {len(allrows)} 筆')
    sb.table('science_park_industry_yearly').upsert(industry, on_conflict='year,park,industry').execute()
    print(f'已寫入產業別 {len(industry)} 筆')

    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write(f'### 科學園區從業員工\n- 園區級 {len(park_rows)} 筆（至 {latest}）\n- 子園區 {len(sub_rows)} 筆\n')


if __name__ == '__main__':
    main()

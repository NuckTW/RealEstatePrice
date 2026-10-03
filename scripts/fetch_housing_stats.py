"""
住宅市場統計匯入 → housing_market_stats（長格式：指標 × 地區 × 期別）
潛在客群分析 第二期：負擔能力、房貸利率、低度使用住宅、住宅存量屋齡、建物移轉

來源
  A. 內政部不動產資訊平台 pip.moi.gov.tw（只取臺南市與全國）
     - E2010Data（JSON）：房價所得比、貸款負擔率（縣市・季）、五大銀行平均房貸利率（全國・月）
     - E3030 匯出 CSV（表單 POST，需 __RequestVerificationToken）：新增購置住宅貸款 利率／成數／期數（縣市・季）
     - E1040 低度使用（用電）住宅 第二版方法（表單 POST）：行政區・半年
     - E4041?m=csv&k=K02&n=T13：房屋稅籍住宅類數量依屋齡區分（行政區・季）
  B. 臺南市政府資料開放平台 data.tainan.gov.tw（每年一個資料集、每月一個 CSV 資源）
     - {年}年臺南市建物第一次移轉統計表：行政區・月（新屋交屋量）
     - {年}年臺南市不動產買賣統計表：行政區・月（建物買賣移轉件數）
  C. 主計總處 家庭收支調查（縣市・年，1998 年起；只取臺南市與臺灣地區）
     - 平均每戶可支配所得、消費支出、所得收入總計

用法（執行路徑：專案根目錄）：
  python3 scripts/fetch_housing_stats.py                # 平台全部歷史（檔案小，每次全抓）+ 台南開放資料今年與去年
  python3 scripts/fetch_housing_stats.py --backfill     # 台南開放資料 104 年起全部
  python3 scripts/fetch_housing_stats.py --only pip     # 只抓不動產資訊平台（或 tainan、fies）
  python3 scripts/fetch_housing_stats.py --dry-run      # 不寫 DB

前置：先在 Supabase SQL Editor 執行 supabase/migrations/20261004_housing_market_stats.sql
"""

from __future__ import annotations

import argparse
import csv
import html
import io
import os
import re
import sys
import time
import urllib.parse
from collections import Counter
from datetime import date

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from gov_http import gov_session  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

PIP = 'https://pip.moi.gov.tw/Publicize/Info'
TN = 'https://data.tainan.gov.tw'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
TN_FIRST_YEAR = 104
DELAY_SEC = 0.8


# ── 共用 ─────────────────────────────────────────────────────

def period_date(period: str, ptype: str) -> str:
    """'115Q1'→2026-01-01、'114H2'→2025-07-01、'11508'→2026-08-01、年 '114'→2025-01-01"""
    y = int(re.match(r'\d+', period).group()) if ptype != 'M' else int(period[:-2])
    if ptype == 'Y':
        m = 1
    elif ptype == 'Q':
        m = (int(period[-1]) - 1) * 3 + 1
    elif ptype == 'H':
        m = 1 if period.endswith('1') else 7
    else:
        m = int(period[-2:])
    return f'{y + 1911}-{m:02d}-01'


def num(s) -> float | None:
    s = str(s).replace(',', '').strip()
    if s in ('', '-', '—', '...'):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def row(indicator, level, area, period, ptype, value, source):
    return {
        'indicator': indicator, 'area_level': level, 'area': area,
        'period': period, 'period_type': ptype, 'period_date': period_date(period, ptype),
        'value': value, 'source': source,
    }


def city_of(name: str) -> str | None:
    """縣市名正規化：只認全國與臺南市"""
    n = name.strip().replace('台', '臺')
    return n if n in ('全國', '臺南市') else None


def pip_token(session, page: str) -> str:
    h = session.get(f'{PIP}/{page}', timeout=60).text
    m = re.search(r'name="__RequestVerificationToken" type="hidden" value="([^"]+)"', h)
    if not m:
        raise RuntimeError(f'{page} 找不到 __RequestVerificationToken（頁面結構可能改變）')
    return m.group(1)


def decode(b: bytes) -> str:
    # 平台回應標頭常寫 big5，但實際多為 UTF-8（含 BOM）；依序嘗試
    for enc in ('utf-8-sig', 'cp950'):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode('utf-8', errors='replace')


# ── A. 不動產資訊平台 ─────────────────────────────────────────

def pip_e2010(session) -> list[dict]:
    session.get(f'{PIP}/E2010', timeout=60)   # 取得 cookie
    out = []
    specs = [
        ('group03', 'price_income_ratio', 'Q', '091Q1', '199Q4'),
        ('group04', 'mortgage_burden_pct', 'Q', '091Q1', '199Q4'),
        ('group06', 'bank5_mortgage_rate', 'M', '09801', '19912'),
    ]
    for group, ind, ptype, f01, f02 in specs:
        j = session.get(f'{PIP}/E2010Data', timeout=60, params={
            'dataGroup': group, 'f01': f01, 'f02': f02, 'f03': 'TAIWAN|全國,D|台南市,'}).json()
        table = j.get('resultTable') or []
        if len(table) < 2:
            print(f'  ⚠️ E2010 {group} 無資料')
            continue
        header = table[0]
        for r in table[1:]:
            period = r[0].replace('/', '')          # 月資料 '115/07' → '11507'
            for col, v in zip(header[1:], r[1:]):
                c = city_of(col) or ('全國' if '房貸利率' in col else None)   # group06 欄名是指標名、只有全國
                val = num(v)
                if c and val is not None:
                    # 來源錯誤：貸款負擔率 110Q4～111Q2 多乘 100（如 3782.6 應為 37.83%）
                    if ind == 'mortgage_burden_pct' and val > 100:
                        val = round(val / 100, 2)
                    out.append(row(ind, 'nation' if c == '全國' else 'city', c, period, ptype, val, 'pip'))
        time.sleep(DELAY_SEC)
    return out


def pip_e3030(session) -> list[dict]:
    token = pip_token(session, 'E3030')
    out = []
    for (t, k, n), ind in {
        ('5', '3', '2'): 'new_mortgage_rate',
        ('5', '3', '3'): 'new_mortgage_ltv',
        ('5', '3', '4'): 'new_mortgage_term',
    }.items():
        r = session.post(f'{PIP}/E3030', timeout=120, headers={'Referer': f'{PIP}/E3030'}, data={
            'F01Sel': '', 'F02': '', 'F01': '', 'T': t, 'K': k, 'N': n, 'Command': '匯出CSV檔',
            'CommandArgument': '', 'ResponseCommand': '', '__RequestVerificationToken': token})
        rows = list(csv.reader(io.StringIO(decode(r.content))))
        for rr in rows[1:]:
            if len(rr) < 3:
                continue
            c = city_of(rr[1])
            if c and num(rr[-1]) is not None:
                out.append(row(ind, 'nation' if c == '全國' else 'city', c, rr[0], 'Q', num(rr[-1]), 'pip'))
        time.sleep(DELAY_SEC)
    return out


def pip_low_usage(session) -> list[dict]:
    h = session.get(f'{PIP}/E1040', timeout=60).text
    token = re.search(r'name="__RequestVerificationToken" type="hidden" value="([^"]+)"', h).group(1)
    # q5（第二版方法）的期別下拉：109H1 起
    sel = re.search(r'id="q5_ddate_sel".*?</select>', h, re.S).group(0)
    periods = re.findall(r'<option value="(\d{3}H\d)"', sel)
    out = []
    for p in periods:
        r = session.post(f'{PIP}/E1040', timeout=120, headers={'Referer': f'{PIP}/E1040'}, data={
            'F01': 'DataGroup3', 'F02': p, 'F03': '67000', 'F04': '', 'F05': '', 'F06': '',
            '__RequestVerificationToken': token})
        rows = list(csv.reader(io.StringIO(decode(r.content))))
        for rr in rows[1:]:
            if len(rr) < 4:
                continue
            level, area = ('city', '臺南市') if rr[1] == '全區' else ('district', rr[1])
            if num(rr[2]) is not None:
                out.append(row('low_usage_units', level, area, p, 'H', num(rr[2]), 'pip'))
            if num(rr[3]) is not None:
                out.append(row('low_usage_rate', level, area, p, 'H', num(rr[3]), 'pip'))
        time.sleep(DELAY_SEC)
    return out


# 房屋稅籍屋齡欄位 → 指標名（欄名內含全形括號，用關鍵字比對）
STOCK_COLS = [
    ('房屋稅籍住宅類數量', 'stock_units'), ('住宅平均屋齡', 'stock_avg_age'),
    ('1（含）年以下', 'stock_age_0_1'), ('1~5', 'stock_age_1_5'), ('5~10', 'stock_age_5_10'),
    ('10~15', 'stock_age_10_15'), ('15~20', 'stock_age_15_20'), ('20~25', 'stock_age_20_25'),
    ('25~30', 'stock_age_25_30'), ('30~40', 'stock_age_30_40'), ('40~50', 'stock_age_40_50'),
    ('50年以上', 'stock_age_50p'),
]


def pip_stock_age(session) -> list[dict]:
    r = session.get(f'{PIP}/E4041', params={'m': 'csv', 'k': 'K02', 'n': 'T13'}, timeout=300)
    rows = list(csv.reader(io.StringIO(decode(r.content))))
    header = rows[0]
    idx = {}
    for kw, ind in STOCK_COLS:
        i = next((i for i, h in enumerate(header) if kw in h), None)
        if i is None:
            raise RuntimeError(f'T13 找不到欄位「{kw}」（格式可能改變）：{header}')
        idx[ind] = i
    out = []
    for rr in rows[1:]:
        name = rr[1].strip().replace('臺', '台')
        if name == '全國':
            level, area = 'nation', '全國'
        elif name == '台南市':
            level, area = 'city', '臺南市'
        elif name.startswith('台南市'):
            level, area = 'district', name[3:]
        else:
            continue
        for ind, i in idx.items():
            v = num(rr[i])
            if v is not None:
                out.append(row(ind, level, area, rr[0], 'Q', v, 'pip'))
    return out


# ── B. 臺南市政府資料開放平台 ─────────────────────────────────

def tn_resources(session, title: str) -> list[tuple[str, str]]:
    """以完整標題找資料集，回傳 [(資源 id, 資源名稱)]"""
    h = session.get(f'{TN}/DataSet', params={'keyword': title}, timeout=60).text
    for ds in dict.fromkeys(re.findall(r'/DataSet/Detail/([0-9a-f-]{36})', h)):
        d = session.get(f'{TN}/DataSet/Detail/{ds}', timeout=60).text
        t = html.unescape(re.search(r'<title>(.*?)</title>', d, re.S).group(1))
        if title in t:
            res = []
            for rid, name in re.findall(r'/Resource/([0-9a-f-]{36})[^>]*>\s*([^<]+)', d):
                name = html.unescape(name).strip()
                if name and name != '詳細資料':
                    res.append((rid, name))
            return list(dict.fromkeys(res))
    return []


def tn_csv(session, rid: str) -> list[dict]:
    raw = session.get(f'{TN}/File/DirectDownload/{rid}', timeout=60).content
    return list(csv.DictReader(io.StringIO(decode(raw))))


def pick(r: dict, *keys):
    for k in keys:
        for col in r:
            if col and k in col:
                return r[col]
    return None


def tn_area(name: str) -> tuple[str, str] | None:
    n = (name or '').strip()
    if not n:
        return None
    if n in ('合計', '總計', '全市', '臺南市', '台南市'):
        return 'city', '臺南市'
    return 'district', n


def tainan_opendata(session, years: list[int]) -> list[dict]:
    out = []
    specs = [
        ('建物第一次移轉統計表', [
            ('first_transfer_low', ('六層以下-筆數', '六層以下筆數')),
            ('first_transfer_low_area', ('六層以下-面積', '六層以下面積')),
            ('first_transfer_high', ('七層以上-筆數', '七層以上筆數')),
            ('first_transfer_high_area', ('七層以上-面積', '七層以上面積')),
        ]),
        ('不動產買賣統計表', [
            ('sale_transfer_buildings', ('建物件數',)),
            ('sale_transfer_area', ('建物面積',)),
        ]),
    ]
    for y in years:
        for kind, cols in specs:
            title = f'{y}年臺南市{kind}'
            res = tn_resources(session, title)
            if not res:
                print(f'  ⚠️ 找不到資料集：{title}')
                continue
            n = 0
            for rid, name in res:
                for r in tn_csv(session, rid):
                    ym = (pick(r, '年月') or '').strip()
                    area = tn_area(pick(r, '區名', '行政區'))
                    if not re.fullmatch(r'\d{5}', ym) or not area:
                        continue
                    for ind, keys in cols:
                        v = num(pick(r, *keys))
                        if v is not None:
                            out.append(row(ind, area[0], area[1], ym, 'M', v, 'tainan_opendata'))
                            n += 1
                time.sleep(DELAY_SEC)
            print(f'  {title}：{len(res)} 個月份資源，{n} 筆')
    return out


# ── C. 主計總處 家庭收支調查（縣市・年，1998 年起） ─────────────

FIES = {
    # data.gov.tw 9415／9420／9418；欄名為「縣市-元」，臺灣地區視為全國
    'fies_disposable_income': 'https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/232214/006-平均每戶可支配所得按區域別分.csv',
    'fies_consumption':       'https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/232214/011-平均每戶消費支出按區域別分.csv',
    'fies_income_receipts':   'https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/232214/009-平均每戶所得收入總計按區域別分.csv',
}


def fies(session) -> list[dict]:
    out = []
    for ind, url in FIES.items():
        rows = list(csv.reader(io.StringIO(decode(session.get(url, timeout=60).content))))
        header = rows[0]
        for r in rows[1:]:
            if not r or not r[0].strip().isdigit():
                continue
            period = str(int(r[0]) - 1911)            # 西元年 → 民國年
            for col, v in zip(header[1:], r[1:]):
                name = col.split('-')[0].strip()
                area = '全國' if name == '臺灣地區' else city_of(name)
                if area and num(v) is not None:
                    out.append(row(ind, 'nation' if area == '全國' else 'city', area, period, 'Y', num(v), 'dgbas'))
        time.sleep(DELAY_SEC)
    return out


# ── 主程式 ───────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--backfill', action='store_true', help='台南開放資料從 104 年起全部回補')
    ap.add_argument('--only', choices=['pip', 'tainan', 'fies'])
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    rows: list[dict] = []
    if args.only in (None, 'pip'):
        s = gov_session(UA)
        for name, fn in [('負擔能力・五大銀行利率', pip_e2010), ('新增房貸利率／成數／期數', pip_e3030),
                         ('低度使用（用電）住宅', pip_low_usage), ('房屋稅籍屋齡', pip_stock_age)]:
            got = fn(s)
            print(f'不動產資訊平台 {name}：{len(got)} 筆')
            rows += got
    if args.only in (None, 'fies'):
        got = fies(gov_session(UA))
        print(f'主計總處 家庭收支調查：{len(got)} 筆')
        rows += got
    if args.only in (None, 'tainan'):
        this_year = date.today().year - 1911
        years = list(range(TN_FIRST_YEAR, this_year + 1)) if args.backfill else [this_year - 1, this_year]
        rows += tainan_opendata(gov_session(UA), years)

    # 同一主鍵只留最後一筆（來源偶有重複列）
    dedup = {(r['indicator'], r['area_level'], r['area'], r['period']): r for r in rows}
    rows = list(dedup.values())
    summary = Counter(r['indicator'] for r in rows)
    print(f'\n合計 {len(rows)} 筆：' + '、'.join(f'{k} {v}' for k, v in sorted(summary.items())))

    if args.dry_run:
        latest = {}
        for r in rows:
            if r['area'] == '臺南市':
                k = r['indicator']
                if k not in latest or r['period_date'] > latest[k]['period_date']:
                    latest[k] = r
        for k, r in sorted(latest.items()):
            print(f'  臺南市 {k}：{r["period"]} = {r["value"]}')
        print('（dry-run，未寫入）')
        return

    from supabase import create_client
    sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    for k in range(0, len(rows), 500):
        sb.table('housing_market_stats').upsert(
            rows[k:k + 500], on_conflict='indicator,area_level,area,period').execute()
    print(f'已寫入 {len(rows)} 筆')

    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write('### 住宅市場統計\n' + '\n'.join(f'- {k}：{v}' for k, v in sorted(summary.items())) + '\n')


if __name__ == '__main__':
    main()

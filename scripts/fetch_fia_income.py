"""
財政部 綜稅綜合所得總額各村里統計 匯入（潛在客群分析 第一期）
資料集：https://data.gov.tw/dataset/103066（財政部財政資訊中心，每年 8 月更新，約落後 2–3 年）
下載網址：https://www.fia.gov.tw/WEB/fia/ias/ias{年度}/{年度}_165-9.csv

⚠️ 課稅資料不含政府移轉、免稅、分離課稅所得 → 只做村里間相對排名，不當絕對購買力。

村里對齊：用（行政區, 村里名）對 villages 主檔；異體字與分割里由 ALIASES 處理，
對不到的列 village_code 留 NULL 並列印出來，不會中斷。

用法（執行路徑：專案根目錄）：
  python3 scripts/fetch_fia_income.py                 # 最新年度
  python3 scripts/fetch_fia_income.py --backfill      # 108 年度起全部
  python3 scripts/fetch_fia_income.py --years 111 112
  python3 scripts/fetch_fia_income.py --years 112 --dry-run

前置：supabase/migrations/20261002_potential_buyers.sql 已執行，
      且 scripts/fetch_ris_village.py 已跑過至少一個月份（villages 主檔有資料）
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import sys
import time
import unicodedata
from datetime import date

import requests
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from gov_http import gov_session  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

URL = 'https://www.fia.gov.tw/WEB/fia/ias/ias{y}/{y}_165-9.csv'
COUNTY = '臺南市'
BACKFILL_START = 105   # 潛在客群資料以近 10 年為目標（民國 105 年起）

# 財政部寫法 → 戶政寫法（異體字）
ALIASES = {
    ('七股區', '𥂁埕里'): '塩埕里',
    ('安南區', '𥂁田里'): '塩田里',
    ('中西區', '赤崁里'): '赤嵌里',     # 105–106 年度寫法
}
# 財政部造字區字元 → 通用字（105 年度「廍」為 U+FFFB4：舊廍里、後廍里、寮廍里、南廍里、頂廍里）
PUA_CHARS = {'\U000FFFB4': '廍'}
# 財政部年度資料仍為合併前的里（戶政已分割）：所得無法拆分，village_code 留 NULL
SPLIT_VILLAGES = {('官田區', '東西庄里'): ['東庄里', '西庄里']}


def make_session() -> requests.Session:
    return gov_session()


def norm(s: str) -> str:
    """統一相容字元（如「檨」在兩來源的 Unicode 碼位不同）"""
    s = ''.join(PUA_CHARS.get(c, c) for c in s.strip())
    return unicodedata.normalize('NFKC', s)


def to_int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def to_num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def fetch_year(session: requests.Session, y: int) -> list[dict] | None:
    r = None
    for attempt in range(3):
        try:
            r = session.get(URL.format(y=y), timeout=60)
            break
        except requests.RequestException as e:
            print(f'  {y} 年度：連線失敗（{e.__class__.__name__}），{"重試" if attempt < 2 else "放棄"}')
            time.sleep(3 * (attempt + 1))
    if r is None or r.status_code != 200 or len(r.content) < 1000:
        return None
    text = r.content.decode('utf-8-sig', errors='replace')
    rd = csv.reader(io.StringIO(text))
    header = [c.replace('﻿', '').strip() for c in next(rd)]
    rows = []
    for raw in rd:
        rec = dict(zip(header, raw))
        site = rec.get('縣市別') or rec.get('鄉鎮市區', '')  # 108–109 年度欄名為「鄉鎮市區」
        village = rec.get('村里', '').strip()
        if not site.startswith(COUNTY) or village in ('合計', '其他', ''):
            continue
        district = site.replace(COUNTY, '', 1)
        if district == '其他':
            continue
        rows.append({
            'tax_year': y, 'district': district, 'village': village,
            'tax_units': to_int(rec.get('納稅單位(戶)')),
            'income_total': to_int(rec.get('綜合所得總額')),
            'income_mean': to_int(rec.get('平均數')),
            'income_median': to_int(rec.get('中位數')),
            'income_q1': to_int(rec.get('第一分位數')),
            'income_q3': to_int(rec.get('第三分位數')),
            'income_sd': to_num(rec.get('標準差')),
            'income_cv': to_num(rec.get('變異係數')),
        })
    return rows


def load_village_index(sb) -> dict[tuple[str, str], str]:
    """(行政區, 正規化村里名) → village_code；同名多碼時取 last_seen_ym 最新者。"""
    idx, seen, start = {}, {}, 0
    while True:
        res = sb.table('villages').select('village_code,district,village,last_seen_ym') \
            .range(start, start + 999).execute()
        data = res.data or []
        for v in data:
            key = (v['district'], norm(v['village']))
            if key not in seen or (v['last_seen_ym'] or '') > seen[key]:
                idx[key], seen[key] = v['village_code'], v['last_seen_ym'] or ''
        if len(data) < 1000:
            return idx
        start += 1000


def attach_codes(rows: list[dict], idx: dict) -> list[tuple[str, str]]:
    missing = []
    for r in rows:
        key = (r['district'], r['village'])
        name = ALIASES.get(key, r['village'])
        code = idx.get((r['district'], norm(name)))
        r['village_code'] = code
        if code is None:
            missing.append(key)
    return missing


def save_aliases(sb, idx: dict):
    """把財政部異體字寫回 villages.name_aliases，供日後其他來源對齊。"""
    for (district, alias), canonical in ALIASES.items():
        code = idx.get((district, norm(canonical)))
        if not code:
            continue
        cur = sb.table('villages').select('name_aliases').eq('village_code', code).execute()
        aliases = set((cur.data or [{}])[0].get('name_aliases') or [])
        if alias not in aliases:
            sb.table('villages').update({'name_aliases': sorted(aliases | {alias})}) \
                .eq('village_code', code).execute()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--years', nargs='*', type=int)
    ap.add_argument('--backfill', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    latest_guess = date.today().year - 1911 - 2
    if args.years:
        years = args.years
    elif args.backfill:
        years = list(range(BACKFILL_START, latest_guess + 1))
    else:
        years = [latest_guess, latest_guess - 1]   # 新年度未發布時，退回前一年度

    session = make_session()

    sb = idx = None
    if not args.dry_run:
        from supabase import create_client
        sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'],
                           os.environ['SUPABASE_SERVICE_ROLE_KEY'])
        idx = load_village_index(sb)
        print(f'villages 主檔：{len(idx)} 個村里')
        if not idx:
            raise SystemExit('villages 主檔是空的，請先跑 scripts/fetch_ris_village.py')
        save_aliases(sb, idx)

    written = 0
    for y in years:
        rows = fetch_year(session, y)
        if not rows:
            print(f'  {y} 年度：尚未發布或下載失敗，跳過')
            continue
        if args.dry_run:
            print(f'  {y} 年度：{len(rows)} 個村里（dry-run，未寫入）')
            top = sorted(rows, key=lambda r: r['income_median'] or 0, reverse=True)[:5]
            for r in top:
                print(f'    中位數前五：{r["district"]}{r["village"]} {r["income_median"]} 千元')
            continue
        missing = attach_codes(rows, idx)
        for k in range(0, len(rows), 500):
            sb.table('village_income_yearly').upsert(
                rows[k:k + 500], on_conflict='tax_year,district,village').execute()
        written += len(rows)
        print(f'  {y} 年度：寫入 {len(rows)} 筆，對不到代碼 {len(missing)} 筆')
        for d, v in missing:
            note = '（已分割為 ' + '、'.join(SPLIT_VILLAGES[(d, v)]) + '）' if (d, v) in SPLIT_VILLAGES else ''
            print(f'    未對齊：{d}{v}{note}')

    if written:
        # 所得更新後重算村里潛在客群指數（所得百分位）
        sb.rpc('refresh_village_buyer_indicators').execute()
        print('已更新 village_buyer_indicators')


if __name__ == '__main__':
    main()

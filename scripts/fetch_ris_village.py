"""
戶政司村里月資料匯入（潛在客群分析 第一期）
API 文件：https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1

資料集（皆為「新增區域代碼」版本，village_code = district_code 11 碼）：
  ODRP014  村里戶數、單一年齡人口        → village_population_monthly
  ODRP060  各村（里）人口統計月報表（含同婚）→ village_vital_monthly
  ODRP011  遷入遷出統計表               → village_migration_monthly
官方約落後 1–2 個月發布；查無資料的月份自動跳過。

用法（執行路徑：專案根目錄）：
  python3 scripts/fetch_ris_village.py                  # 最近 4 個月（月排程用）
  python3 scripts/fetch_ris_village.py --backfill       # 自 11001 起全部回補
  python3 scripts/fetch_ris_village.py --months 11507 11508
  python3 scripts/fetch_ris_village.py --months 11508 --dry-run   # 不寫 DB，輸出 CSV 到 data/ris_preview/

前置：先在 Supabase SQL Editor 執行 supabase/migrations/20261002_potential_buyers.sql
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from datetime import date, datetime, timezone

import requests
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from gov_http import gov_session  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

API = 'https://www.ris.gov.tw/rs-opendata/api/v1/datastore/{code}/{ym}'
COUNTY = '臺南市'
BACKFILL_START = '11001'   # 與實價登錄歷史資料起點對齊
RECENT_MONTHS = 4
DELAY_SEC = 1.0
CITY_KEYS = ['ntp', 'tp', 'ty', 'tc', 'tn', 'kh', 'tw', 'fu', 'other']
PREVIEW_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'ris_preview')


# ── 工具 ──────────────────────────────────────────────────────────

def roc_ym_to_date(ym: str) -> str:
    return f'{int(ym[:-2]) + 1911}-{int(ym[-2:]):02d}-01'


def month_range(start_ym: str, end_ym: str) -> list[str]:
    out = []
    y, m = int(start_ym[:-2]), int(start_ym[-2:])
    ey, em = int(end_ym[:-2]), int(end_ym[-2:])
    while (y, m) <= (ey, em):
        out.append(f'{y}{m:02d}')
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def recent_months(n: int) -> list[str]:
    today = date.today()
    idx = (today.year - 1911) * 12 + today.month - 1
    return [f'{i // 12}{i % 12 + 1:02d}' for i in range(idx - n + 1, idx + 1)]


def i(v) -> int:
    try:
        return int(str(v).strip() or 0)
    except ValueError:
        return 0


def mf(row: dict, key: str) -> int:
    """男 + 女"""
    return i(row.get(f'{key}_m')) + i(row.get(f'{key}_f'))


def split_site(site_id: str) -> str:
    """'臺南市東區' → '東區'"""
    return site_id.replace(COUNTY, '', 1)


# ── 抓取 ──────────────────────────────────────────────────────────

def fetch(session: requests.Session, code: str, ym: str) -> list[dict]:
    """抓單一資料集單一月份的台南市全部村里（自動翻頁）。查無資料回傳 []。"""
    rows, page = [], 1
    while True:
        try:
            r = session.get(API.format(code=code, ym=ym),
                            params={'COUNTY': COUNTY, 'PAGE': page}, timeout=60)
            data = r.json()
        except Exception as e:
            print(f'  {code} {ym} p{page}: 抓取失敗（{e}）')
            return rows
        if data.get('responseCode') != 'OD-0101-S':
            return rows   # 'OD-0102-S' 查無資料
        rows += [x for x in data.get('responseData') or []
                 if str(x.get('site_id', '')).startswith(COUNTY)]
        if page >= i(data.get('totalPage')):
            return rows
        page += 1
        time.sleep(DELAY_SEC)


# ── 轉換 ──────────────────────────────────────────────────────────

def bucket(ages: list[int], lo: int, hi: int) -> int:
    return sum(ages[lo:hi + 1])


def to_population(r: dict) -> dict:
    ages_m = [i(r.get(f'people_age_{a:03d}_m')) for a in range(100)] + [i(r.get('people_age_100up_m'))]
    ages_f = [i(r.get(f'people_age_{a:03d}_f')) for a in range(100)] + [i(r.get('people_age_100up_f'))]
    ages = [m + f for m, f in zip(ages_m, ages_f)]
    ym = r['statistic_yyymm']
    return {
        'ym': ym, 'ym_date': roc_ym_to_date(ym), 'village_code': r['district_code'],
        'households': i(r['household_no']), 'pop_total': i(r['people_total']),
        'pop_m': i(r['people_total_m']), 'pop_f': i(r['people_total_f']),
        'age_0_14': bucket(ages, 0, 14), 'age_15_24': bucket(ages, 15, 24),
        'age_25_34': bucket(ages, 25, 34), 'age_35_44': bucket(ages, 35, 44),
        'age_45_64': bucket(ages, 45, 64), 'age_65_plus': bucket(ages, 65, 100),
        'ages_m': ages_m, 'ages_f': ages_f,
    }


def to_vital(r: dict) -> dict:
    ym = r['statistic_yyymm']
    return {
        'ym': ym, 'ym_date': roc_ym_to_date(ym), 'village_code': r['district_code'],
        'births': i(r.get('birth_total')), 'deaths': i(r.get('death_total')),
        'marriages': i(r.get('marry_pair_OppositeSex')) + i(r.get('marry_pair_SameSex')),
        'divorces': i(r.get('divorce_pair_OppositeSex')) + i(r.get('divorce_pair_SameSex')),
    }


def to_migration(r: dict) -> dict:
    ym = r['statistic_yyymm']
    in_by_city = {c: mf(r, f'in_{c}') for c in CITY_KEYS}
    out_by_city = {c: mf(r, f'out_{c}') for c in CITY_KEYS}
    raw_keys = sorted({k[:-2] for k in r if k.endswith(('_m', '_f'))})
    return {
        'ym': ym, 'ym_date': roc_ym_to_date(ym), 'village_code': r['district_code'],
        'in_total': mf(r, 'in_total'), 'out_total': mf(r, 'out_total'),
        'in_other_city': sum(in_by_city.values()), 'out_other_city': sum(out_by_city.values()),
        'in_other_town': mf(r, 'in_other_town'), 'out_other_town': mf(r, 'out_other_town'),
        'in_same_town': mf(r, 'in_migrants'), 'out_same_town': mf(r, 'out_migrants'),
        'in_foreign': mf(r, 'in_foreign'), 'out_foreign': mf(r, 'out_foreign'),
        'in_by_city': in_by_city, 'out_by_city': out_by_city,
        'raw': {k: mf(r, k) for k in raw_keys},
    }


def to_village(r: dict) -> dict:
    return {'village_code': r['district_code'], 'district': split_site(r['site_id']),
            'village': r['village']}


# ── 寫入 ──────────────────────────────────────────────────────────

def upsert(sb, table: str, records: list[dict], conflict: str, batch: int = 500):
    for k in range(0, len(records), batch):
        sb.table(table).upsert(records[k:k + batch], on_conflict=conflict).execute()


def upsert_villages(sb, villages: dict[str, dict], ym: str):
    """新增村里，或擴展既有村里的 first_seen_ym / last_seen_ym（回補舊月份也不會倒退）。
    name_aliases 不在這裡寫，避免覆蓋 fetch_fia_income.py 補上的異體字。"""
    codes = list(villages)
    existing = {}
    for k in range(0, len(codes), 300):
        res = sb.table('villages').select('village_code,first_seen_ym,last_seen_ym') \
            .in_('village_code', codes[k:k + 300]).execute()
        existing.update({x['village_code']: x for x in res.data or []})
    now = datetime.now(timezone.utc).isoformat()
    records = []
    for code, v in villages.items():
        e = existing.get(code) or {}
        records.append({**v,
                        'first_seen_ym': min(filter(None, [e.get('first_seen_ym'), ym])),
                        'last_seen_ym': max(filter(None, [e.get('last_seen_ym'), ym])),
                        'updated_at': now})
    upsert(sb, 'villages', records, 'village_code')


def write_preview(name: str, records: list[dict]):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    path = os.path.join(PREVIEW_DIR, f'{name}.csv')
    with open(path, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=list(records[0]))
        w.writeheader()
        w.writerows(records)
    print(f'  預覽輸出：{os.path.relpath(path)}')


# ── 主流程 ────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--backfill', action='store_true')
    ap.add_argument('--months', nargs='*')
    ap.add_argument('--dry-run', action='store_true', help='不寫 DB，輸出 CSV 預覽')
    args = ap.parse_args()

    if args.months:
        months = args.months
    elif args.backfill:
        months = month_range(BACKFILL_START, recent_months(1)[0])
    else:
        months = recent_months(RECENT_MONTHS)

    sb = None
    if not args.dry_run:
        from supabase import create_client
        sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'],
                           os.environ['SUPABASE_SERVICE_ROLE_KEY'])

    session = gov_session()

    print(f'戶政村里資料：{months[0]} ~ {months[-1]}（{len(months)} 個月）')
    summary = []
    for ym in months:
        pop = fetch(session, 'ODRP014', ym)
        if not pop:
            print(f'  {ym}: 查無資料，跳過')
            continue
        time.sleep(DELAY_SEC)
        vital = fetch(session, 'ODRP060', ym)
        time.sleep(DELAY_SEC)
        mig = fetch(session, 'ODRP011', ym)
        time.sleep(DELAY_SEC)

        villages = {r['district_code']: to_village(r) for r in pop + vital + mig}
        recs = {
            'village_population_monthly': [to_population(r) for r in pop],
            'village_vital_monthly': [to_vital(r) for r in vital],
            'village_migration_monthly': [to_migration(r) for r in mig],
        }
        if args.dry_run:
            write_preview(f'villages_{ym}', list(villages.values()))
            for t, rs in recs.items():
                if rs:
                    write_preview(f'{t}_{ym}', rs)
        else:
            upsert_villages(sb, villages, ym)
            for t, rs in recs.items():
                if rs:
                    upsert(sb, t, rs, 'ym,village_code')
        line = (f'  {ym}: 村里 {len(villages)}｜人口 {len(pop)}｜動態 {len(vital)}｜遷徙 {len(mig)}'
                f'｜總人口 {sum(r["pop_total"] for r in recs["village_population_monthly"]):,}')
        print(line)
        summary.append(line)

    if not summary:
        print('沒有任何月份有資料')
        sys.exit(0)

    if sb:
        # 重算村里潛在客群指數（materialized view，見 20261003_village_buyer_indicators.sql）
        sb.rpc('refresh_village_buyer_indicators').execute()
        print('已更新 village_buyer_indicators')

    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write('### 戶政村里資料\n' + '\n'.join(summary) + '\n')


if __name__ == '__main__':
    main()

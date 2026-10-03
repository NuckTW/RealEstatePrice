"""
村里戶政年資料 + 村里戶長年齡／宅內人口數／宅內戶數（潛在客群分析）

來源
  A. 戶政司 API（年資料，village_code = district_code）
     ODRP020 村里 15 歲以上教育程度、ODRP025 戶數結構（106 年起）→ village_annual_stats
  B. 內政部不動產資訊平台 E4041 主題下載（村里・季，104Q3 起）→ village_household_quarterly
     K01/T06 戶長年齡、K01/T02 宅內人口數、K01/T04 宅內戶數（105Q1 起；107 年整併前已消失的里對不到，略過）
     （全國村里檔，每個約 25 MB；以「臺南市＋區＋里」名稱對 villages 換代碼）

用法（執行路徑：專案根目錄）：
  python3 scripts/fetch_village_household.py              # 戶政最近 2 年 + 平台最近 8 季（排程用）
  python3 scripts/fetch_village_household.py --backfill   # 戶政 106 年起、平台 105Q1 起
  python3 scripts/fetch_village_household.py --only ris   # 只抓戶政（或 pip）
  python3 scripts/fetch_village_household.py --dry-run

前置：supabase/migrations/20261004_village_household_annual.sql
完成後若 village_buyer_indicators 已存在，會自動 refresh
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import re
import sys
import unicodedata
from datetime import date

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from gov_http import gov_session  # noqa: E402
from fetch_ris_village import fetch as ris_fetch  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

RIS_FIRST_YEAR = 106   # 戶政 API 最早年度；106 年 ODRP025 無 district_code，以里名對照
PIP_FIRST_PERIOD = '105Q1'   # 潛在客群資料以近 10 年為目標（民國 105 年起）
RECENT_QUARTERS = 8
PIP_URL = 'https://pip.moi.gov.tw/Publicize/Info/E4041'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'


def norm(s: str) -> str:
    return unicodedata.normalize('NFKC', s.strip())


def i(v) -> int | None:
    s = str(v).replace(',', '').strip()
    try:
        return int(float(s))
    except ValueError:
        return None


def f(v) -> float | None:
    s = str(v).replace(',', '').strip()
    try:
        return float(s)
    except ValueError:
        return None


# ── A. 戶政年資料 ─────────────────────────────────────────────

def edu_row(r: dict) -> dict:
    g = lambda lvl: sum(i(r.get(f'edu_{lvl}_graduated_{s}')) or 0 for s in ('m', 'f'))
    return {
        'edu_15up_total': i(r['edu_age_15up_total']),
        'edu_doctor': g('doctor'), 'edu_master': g('master'), 'edu_university': g('university'),
        'edu_college': g('juniorcollege_2ys') + g('juniorcollege_5ys_final2y'),
        'edu_senior': g('senior') + g('seniorvocational'),
        'raw_edu': {k: i(v) for k, v in r.items() if k.startswith('edu_')},
    }


def hh_row(r: dict) -> dict:
    h = lambda k: i(r.get(k)) or 0
    return {
        'hh_single': h('household_single_total'),
        'hh_size_2': h('home_group_02'), 'hh_size_3': h('home_group_03'),
        'hh_size_4': h('home_group_04'), 'hh_size_5': h('home_group_05'),
        'hh_size_6up': sum(h(f'home_group_{n:02d}') for n in range(6, 10)) + h('home_group_10up'),
        'hh_business': h('household_business_total'),
        'raw_hh': {k: i(v) for k, v in r.items() if k.startswith(('household_', 'home_group_'))},
    }


def ris_annual(session, years: list[int], valid_codes: set[str] | None, name_code) -> list[dict]:
    def code_of(r: dict, y: int) -> str | None:
        # 106 年 ODRP025 沒有 district_code → 以「行政區＋里名」在該年底對照
        if r.get('district_code'):
            return r['district_code']
        m = re.match(r'[臺台]南市(.+區)$', r.get('site_id', ''))
        return name_code(m.group(1), r.get('village', ''), f'{y}12') if m else None

    out = []
    for y in years:
        edu = {c: edu_row(r) for r in ris_fetch(session, 'ODRP020', str(y)) if (c := code_of(r, y))}
        hh = {c: hh_row(r) for r in ris_fetch(session, 'ODRP025', str(y)) if (c := code_of(r, y))}
        codes = set(edu) | set(hh)
        if not codes:
            print(f'  戶政 {y} 年：查無資料')
            continue
        skipped = 0
        for c in codes:
            if valid_codes is not None and c not in valid_codes:
                skipped += 1
                continue
            row = {'year': y, 'village_code': c}
            # 同一年度每列欄位一致（PostgREST 批次 upsert 要求），缺的來源整組不帶，避免覆寫成 NULL
            if edu:
                row.update(edu.get(c) or {k: None for k in edu_row({'edu_age_15up_total': ''})})
            if hh:
                row.update(hh.get(c) or {k: None for k in hh_row({})})
            out.append(row)
        print(f'  戶政 {y} 年：教育 {len(edu)}、戶數結構 {len(hh)} 里'
              + (f'（{skipped} 個代碼不在 villages，略過）' if skipped else ''))
    return out


# ── B. 不動產資訊平台 村里季資料 ───────────────────────────────

PIP_SPECS = {
    'T06': ['heads_total', 'head_avg_age', 'head_le25', 'head_25_35', 'head_35_45', 'head_45_55', 'head_55_65', 'head_65p'],
    'T02': ['dwellings', 'dw_avg_persons', 'dw_p1', 'dw_p2', 'dw_p3', 'dw_p4', 'dw_p5', 'dw_p6p'],
    'T04': ['dwellings', 'dw_avg_hh', 'dw_h1', 'dw_h2', 'dw_h3', 'dw_h4', 'dw_h5', 'dw_h6p'],
}
FLOAT_COLS = {'head_avg_age', 'dw_avg_persons', 'dw_avg_hh'}


def period_date(p: str) -> str:
    return f'{int(p[:3]) + 1911}-{(int(p[-1]) - 1) * 3 + 1:02d}-01'


def pip_quarterly(session, name_code, keep: int | None) -> list[dict]:
    merged: dict[tuple[str, str], dict] = {}
    unmatched: dict[str, set] = {}
    for table, cols in PIP_SPECS.items():
        raw = session.get(PIP_URL, params={'m': 'csv', 'k': 'K01', 'n': table}, timeout=900).content
        rows = list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))))
        if len(rows[0]) != 2 + len(cols):
            raise RuntimeError(f'{table} 欄位數改變：{rows[0]}')
        n = 0
        for r in rows[1:]:
            m = re.match(r'[臺台]南市(.+?區)(.+)$', r[1])
            if not m or r[0] < PIP_FIRST_PERIOD:
                continue
            # 季末月份（如 '107Q1' → '10703'）用來挑當時存在的代碼
            code = name_code(m.group(1), m.group(2), f'{r[0][:3]}{int(r[0][-1]) * 3:02d}')
            if not code:
                unmatched.setdefault(r[0], set()).add(r[1])
                continue
            rec = merged.setdefault((r[0], code), {'period': r[0], 'period_date': period_date(r[0]), 'village_code': code})
            for col, v in zip(cols, r[2:]):
                rec[col] = f(v) if col in FLOAT_COLS else i(v)
            n += 1
        print(f'  平台 {table}：臺南 {n} 筆')
    # 107 年整併前已消失的里對不到代碼 → 只略過那些里（村里層級的時間序列不受影響）
    periods = sorted({p for p, _ in merged})
    partial = {p: len(v) for p, v in unmatched.items() if p in periods}
    if partial:
        print(f'  對不到代碼而略過的里（依季）：{dict(sorted(partial.items()))}')
    if keep:
        periods = periods[-keep:]
    full = [k for k in PIP_SPECS['T06'] + PIP_SPECS['T02'] + PIP_SPECS['T04']]
    out = []
    for (p, _), rec in merged.items():
        if p in periods:
            out.append({k: rec.get(k) for k in ['period', 'period_date', 'village_code'] + list(dict.fromkeys(full))})
    print(f'  平台合併：{len(out)} 筆（{periods[0]}～{periods[-1]}，{len(periods)} 季）')
    return out


# ── 主程式 ───────────────────────────────────────────────────

def load_villages(sb):
    """回傳 (name_code, codes)
    name_code(行政區, 里名, 民國年月)：同名多碼時，優先取該月份落在 first_seen～last_seen 之間的代碼，
    否則取 last_seen 最新者（village 主檔需先由 fetch_ris_village.py 回補到 106 年）"""
    cand: dict[tuple[str, str], list[tuple[str, str, str]]] = {}
    codes = set()
    data = sb.table('villages').select('village_code,district,village,name_aliases,first_seen_ym,last_seen_ym').execute().data
    for v in data:
        codes.add(v['village_code'])
        for n in [v['village']] + (v['name_aliases'] or []):
            cand.setdefault((v['district'], norm(n)), []).append(
                (v['village_code'], v['first_seen_ym'] or '', v['last_seen_ym'] or ''))

    def name_code(district: str, village: str, ym: str) -> str | None:
        cs = cand.get((district, norm(village)))
        if not cs:
            return None
        inside = [c for c in cs if c[1] <= ym <= c[2]]
        return max(inside or cs, key=lambda c: c[2])[0]

    return name_code, codes


def upsert(sb, table: str, rows: list[dict], conflict: str):
    # PostgREST 批次 upsert 要求每列欄位相同 → 依欄位組合分組（如 113 年缺戶數結構）
    groups: dict[tuple, list[dict]] = {}
    for r in rows:
        groups.setdefault(tuple(sorted(r)), []).append(r)
    for g in groups.values():
        for k in range(0, len(g), 500):
            sb.table(table).upsert(g[k:k + 500], on_conflict=conflict).execute()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--backfill', action='store_true')
    ap.add_argument('--only', choices=['ris', 'pip'])
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    from supabase import create_client
    sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    name_code, codes = load_villages(sb)   # dry-run 也需要 villages 對代碼（只讀）

    annual, quarterly = [], []
    if args.only in (None, 'ris'):
        last = date.today().year - 1911 - 1   # 年資料約於隔年發布
        years = list(range(RIS_FIRST_YEAR, last + 1)) if args.backfill else [last - 1, last]
        annual = ris_annual(gov_session(), years, codes, name_code)
    if args.only in (None, 'pip'):
        quarterly = pip_quarterly(gov_session(UA), name_code, None if args.backfill else RECENT_QUARTERS)

    if args.dry_run:
        for r in (annual[:1] + quarterly[:1]):
            print('   ', {k: v for k, v in r.items() if not k.startswith('raw_')})
        print(f'（dry-run，未寫入）年資料 {len(annual)} 筆、季資料 {len(quarterly)} 筆')
        return

    if annual:
        upsert(sb, 'village_annual_stats', annual, 'year,village_code')
    if quarterly:
        upsert(sb, 'village_household_quarterly', quarterly, 'period,village_code')
    print(f'已寫入：年資料 {len(annual)} 筆、季資料 {len(quarterly)} 筆')

    # 指數 view 會讀這兩張表 → 重算（view 尚未更新到 v3 時 refresh 仍可執行）
    try:
        sb.rpc('refresh_village_buyer_indicators').execute()
        print('已更新 village_buyer_indicators')
    except Exception as e:
        print(f'⚠️ refresh 失敗：{e}')
        raise

    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as fh:
            fh.write(f'### 村里戶政年資料／戶長年齡\n- 年資料 {len(annual)} 筆\n- 季資料 {len(quarterly)} 筆\n')


if __name__ == '__main__':
    main()

"""
臺南市人口推估（行政區・年）→ population_projection
來源：臺南市政府「臺南市人口推估」（data.gov.tw 134546），參考國發會「中華民國人口推估」
  - 單一年齡（0–100）× 性別 × 高／中／低推估 × 37 區 × 未來各年（每版約 50 萬列）
  - 匯入時彙整成購屋相關年齡級距，並加總出全市（area = '臺南市'）
  - ⚠️ 官方只以出生、死亡推估，未計入遷徙 → 淨移入多的區會被低估
版次：從 data.gov.tw API 列出資源，以名稱中的「(起始年-2070)」挑最新版；
      CSV 一律由 data.tainan.gov.tw/File/ResourceCsvDownload/{資源 id} 下載

用法（執行路徑：專案根目錄）：
  python3 scripts/fetch_population_projection.py            # 最新版（已匯入同版則照樣覆寫，資料量小）
  python3 scripts/fetch_population_projection.py --all      # 所有版次
  python3 scripts/fetch_population_projection.py --dry-run

前置：supabase/migrations/20261005_sp_industry_projection.sql
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import re
import sys
from collections import defaultdict

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from gov_http import gov_session  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

DATASET_API = 'https://data.gov.tw/api/v2/rest/dataset/134546'
CSV_URL = 'https://data.tainan.gov.tw/File/ResourceCsvDownload/{rid}'

# 單一年齡 → 欄位（與 village_population_monthly 的級距一致）
BANDS = [('age_0_14', 0, 14), ('age_15_24', 15, 24), ('age_25_34', 25, 34),
         ('age_35_44', 35, 44), ('age_45_64', 45, 64), ('age_65_plus', 65, 200)]


def list_editions(session) -> list[tuple[str, str]]:
    """回傳 [(版次 '2025-2070', 資源 id)]，新 → 舊；同版只留一個 id"""
    res = session.get(DATASET_API, timeout=60).json()['result']['distribution']
    eds = {}
    for r in res:
        m = re.search(r'\((\d{4})-(\d{4})\)', r.get('resourceDescription') or '')
        rid = re.search(r'([0-9a-f]{8}-[0-9a-f-]{27})', r.get('resourceDownloadUrl') or '')
        if m and rid:
            eds.setdefault(f'{m.group(1)}-{m.group(2)}', rid.group(1))
    return sorted(eds.items(), reverse=True)


def aggregate(raw: str, edition: str) -> list[dict]:
    acc: dict[tuple, dict] = defaultdict(lambda: {'pop_total': 0, **{b[0]: 0 for b in BANDS}})
    for r in csv.DictReader(io.StringIO(raw)):
        try:
            age, total, year = int(r['age']), int(r['total']), int(r['year'])
        except (KeyError, ValueError):
            continue
        band = next(b[0] for b in BANDS if b[1] <= age <= b[2])
        for area in (r['area'].strip(), '臺南市'):       # 各區＋全市加總
            a = acc[(r['scope'].strip(), area, year)]
            a['pop_total'] += total
            a[band] += total
    return [{'edition': edition, 'scope': sc, 'area': area, 'year': y, **v}
            for (sc, area, y), v in acc.items()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true', help='匯入所有版次（預設只匯最新版）')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    s = gov_session()
    editions = list_editions(s)
    if not editions:
        raise SystemExit('找不到任何人口推估版次（data.gov.tw 資料集結構可能改變）')
    print('可用版次：' + '、'.join(e for e, _ in editions))
    if not args.all:
        editions = editions[:1]

    rows = []
    for edition, rid in editions:
        raw = s.get(CSV_URL.format(rid=rid), timeout=600).content.decode('utf-8-sig')
        got = aggregate(raw, edition)
        city = {r['year']: r['pop_total'] for r in got if r['area'] == '臺南市' and r['scope'] == '中推估'}
        y0, y1 = min(city), max(city)
        print(f'  {edition}：{len(got)} 列（{len({r["area"] for r in got}) - 1} 區）｜'
              f'中推估全市 {y0} 年 {city[y0]:,} → {y1} 年 {city[y1]:,}')
        rows += got

    if args.dry_run:
        print('   ', next(r for r in rows if r['area'] == '臺南市'))
        print('（dry-run，未寫入）')
        return

    from supabase import create_client
    sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    for k in range(0, len(rows), 500):
        sb.table('population_projection').upsert(rows[k:k + 500], on_conflict='edition,scope,area,year').execute()
    print(f'已寫入 {len(rows)} 列')

    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write(f'### 臺南市人口推估\n- {"、".join(e for e, _ in editions)}：{len(rows)} 列\n')


if __name__ == '__main__':
    main()

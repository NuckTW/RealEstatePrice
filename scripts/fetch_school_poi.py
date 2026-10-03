"""
國中小學生數（教育部統計處）＋ 生活機能點位（OpenStreetMap）匯入（潛在客群分析）

A. 學生數 → school_students_yearly（只存臺南市）
   - 國小校別資料：https://stats.moe.gov.tw/files/detail/{學年}/{學年}_basec.csv（每學年一檔，105 學年起）
   - 國中校別資料：https://stats.moe.gov.tw/files/opendata/basej.csv（104 學年起單一檔）
   - 行政區：國小／國中／高中名錄的地址（e1_new／j1_new／high），以學校代碼對應（附設部與高中同代碼）
   - 入學年級學生數（國小 1 年級、國中 7 年級）≈ 當年新生，反映有學齡子女的家庭

B. 生活機能 → poi_points（© OpenStreetMap contributors，ODbL）
   - Overpass API 查臺南市範圍；以 public/geo/tainan_villages.json 做 point-in-polygon 指定 village_code
   - 只收覆蓋率較可信的類別（便利商店、診所在 OSM 明顯不完整，不收）
   - 每次全量重抓並以 fetched_at 標記批次，查詢只用最新批次（不刪舊資料）

用法（執行路徑：專案根目錄）：
  python3 scripts/fetch_school_poi.py              # 學生數最新 2 學年 + 生活機能
  python3 scripts/fetch_school_poi.py --backfill   # 學生數 105 學年起全部
  python3 scripts/fetch_school_poi.py --only school   # 或 poi
  python3 scripts/fetch_school_poi.py --dry-run

前置：supabase/migrations/20261006_income_school_poi.sql
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import time
from datetime import date, datetime, timezone

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from gov_http import gov_session  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

MOE = 'https://stats.moe.gov.tw/files'
ELEM_FIRST_YEAR = 105      # 潛在客群資料以民國 105 年起為原則
COUNTY = '臺南市'
# 公用 Overpass 伺服器偶爾逾時 → 依序嘗試
OVERPASS = ['https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.private.coffee/api/interpreter']
GEOJSON = os.path.join(os.path.dirname(__file__), '..', 'public', 'geo', 'tainan_villages.json')
UA = 'tainan-realestate-ai data fetcher (https://tainan-realestate-ai.vercel.app)'


def decode(b: bytes) -> str:
    for enc in ('utf-8-sig', 'cp950'):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode('utf-8', errors='replace')


def i(v) -> int:
    try:
        return int(str(v).replace(',', '').strip() or 0)
    except ValueError:
        return 0


def csv_rows(session, url: str) -> list[dict] | None:
    r = session.get(url, timeout=120)
    if r.status_code != 200 or r.content.lstrip().startswith(b'<'):
        return None
    return list(csv.DictReader(io.StringIO(decode(r.content))))


# ── A. 學生數 ────────────────────────────────────────────────

def school_district_map(session, latest: int) -> dict[str, tuple[str, bool]]:
    """學校代碼 → (行政區, 是否公立)；國小名錄逐年往回補，國中名錄為多年份單檔"""
    out: dict[str, tuple[str, bool]] = {}

    def add(rows):
        for r in rows or []:
            if COUNTY not in (r.get('縣市名稱') or ''):
                continue
            m = re.search(r'臺南市(.{1,3}?區)', r.get('地址') or '')
            code = (r.get('代碼') or '').strip()
            if m and code and code not in out:
                out[code] = (m.group(1), r.get('公/私立', '') != '私立')

    for y in range(latest + 1, ELEM_FIRST_YEAR - 1, -1):   # 新 → 舊，新年度優先
        add(csv_rows(session, f'{MOE}/school/{y}/e1_new.csv'))
        # 高中附設國中部／國小部與高中同代碼，國中小名錄沒有 → 用高中名錄補
        add(csv_rows(session, f'{MOE}/school/{y}/high.csv'))
    jr = csv_rows(session, f'{MOE}/opendata/j1_new.csv') or []
    jr.sort(key=lambda r: r.get('學年度', ''), reverse=True)
    add(jr)
    return out


def sum_cols(r: dict, pattern: str) -> int:
    return sum(i(v) for k, v in r.items() if k and re.search(pattern, k))


def schools(session, backfill: bool) -> list[dict]:
    # 國小：逐學年檔案，找出最新學年
    elem_years = []
    y = ELEM_FIRST_YEAR
    while True:
        rows = csv_rows(session, f'{MOE}/detail/{y}/{y}_basec.csv')
        if rows is None:
            break
        elem_years.append((y, rows))
        y += 1
    if not elem_years:
        raise RuntimeError('找不到國小校別資料')
    latest = elem_years[-1][0]
    if not backfill:
        elem_years = elem_years[-2:]
    dmap = school_district_map(session, latest)

    out = []

    def push(y, level, r, entry_pat, total_pat, class_pat):
        code = r['學校代碼'].strip()
        name = r['學校名稱'].strip()
        district = (r.get('鄉鎮市區') or '').strip() or (dmap.get(code) or (None,))[0]
        public = dmap.get(code, (None, None))[1]
        if public is None:
            public = not name.startswith('私立') and '財團法人' not in name
        out.append({
            'school_year': y, 'school_code': code, 'level': level, 'school_name': name,
            'district': district, 'is_public': public,
            'entry_students': sum_cols(r, entry_pat), 'total_students': sum_cols(r, total_pat),
            'classes': sum_cols(r, class_pat),
        })

    for y, rows in elem_years:
        for r in rows:
            if r.get('縣市名稱') == COUNTY:
                push(y, '國小', r, r'^1年級[男女]學生數$', r'^\d年級[男女]學生數$', r'^\d年級班級數$')
    jr = csv_rows(session, f'{MOE}/opendata/basej.csv') or []
    jyears = sorted({i(r['學年度']) for r in jr})
    keep = set(jyears if backfill else jyears[-2:])
    for r in jr:
        y = i(r['學年度'])
        if r.get('縣市名稱') == COUNTY and y in keep and y >= ELEM_FIRST_YEAR - 1:
            push(y, '國中', r, r'^學生數7年級[男女]$', r'^學生數[789]年級[男女]$', r'^班級數[789]年級$')
    # 來源偶有同校同學年兩列（如「私立昭明國中」與「私立昭明國中(代用)」，其中一列多為 0）
    # → 依主鍵合併：人數加總，名稱與屬性取學生數較多的那列
    merged: dict[tuple, dict] = {}
    for r in out:
        k = (r['school_year'], r['school_code'], r['level'])
        if k not in merged:
            merged[k] = dict(r)
            continue
        m = merged[k]
        if r['total_students'] > m['total_students']:
            m.update({x: r[x] for x in ('school_name', 'district', 'is_public') if r[x] is not None})
        for x in ('entry_students', 'total_students', 'classes'):
            m[x] += r[x]
    out = list(merged.values())
    missing = sorted({(r['school_name']) for r in out if not r['district']})
    print(f'  學生數：國小 {elem_years[0][0]}～{latest} 學年、國中 {min(keep)}～{max(keep)} 學年，共 {len(out)} 筆'
          + (f'；{len(missing)} 校查無行政區：{missing[:5]}' if missing else ''))
    return out


# ── B. 生活機能（OSM） ───────────────────────────────────────

OVERPASS_QUERY = """
[out:json][timeout:180];
area["name"="臺南市"]["admin_level"="4"]->.tn;
(
  nwr["leisure"="park"](area.tn);
  nwr["railway"="station"](area.tn);
  nwr["amenity"~"^(hospital|library|school)$"](area.tn);
  nwr["shop"~"^(supermarket|mall|department_store)$"](area.tn);
);
out center tags;
"""


def category(t: dict) -> str | None:
    if t.get('leisure') == 'park':
        return 'park'
    if t.get('railway') == 'station':
        return 'station'
    if t.get('amenity') in ('hospital', 'library', 'school'):
        return t['amenity']
    if t.get('shop') == 'supermarket':
        return 'supermarket'
    if t.get('shop') in ('mall', 'department_store'):
        return 'mall'
    return None


def load_polygons():
    """village_code → [(bbox, [rings...])]；MultiPolygon 拆成多個多邊形"""
    g = json.load(open(GEOJSON, encoding='utf-8'))
    polys = []
    for f in g['features']:
        geom = f['geometry']
        parts = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        for rings in parts:
            xs = [p[0] for p in rings[0]]
            ys = [p[1] for p in rings[0]]
            polys.append((f['properties']['code'], (min(xs), min(ys), max(xs), max(ys)), rings))
    return polys


def in_ring(x: float, y: float, ring) -> bool:
    inside = False
    j = len(ring) - 1
    for k in range(len(ring)):
        xi, yi = ring[k][0], ring[k][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = k
    return inside


def locate(lon: float, lat: float, polys) -> str | None:
    for code, (x0, y0, x1, y1), rings in polys:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and in_ring(lon, lat, rings[0]) \
                and not any(in_ring(lon, lat, h) for h in rings[1:]):
            return code
    return None


def pois(session) -> list[dict]:
    data = None
    for attempt, url in enumerate(OVERPASS * 2):
        try:
            r = session.post(url, data={'data': OVERPASS_QUERY}, timeout=300, headers={'User-Agent': UA})
            r.raise_for_status()
            data = r.json()
            # 部分伺服器在查詢失敗時仍回 200 但沒有任何點位（訊息在 remark）→ 視為失敗
            if len(data.get('elements') or []) < 500:
                raise RuntimeError(f"點位過少（{len(data.get('elements') or [])}）：{data.get('remark', '')[:80]}")
            break
        except Exception as e:
            data = None
            print(f'  Overpass {url} 失敗（{e.__class__.__name__}: {str(e)[:80]}），{"重試" if attempt < len(OVERPASS) * 2 - 1 else "放棄"}')
            time.sleep(10)
    if data is None:
        raise RuntimeError('Overpass 全部伺服器都失敗')
    polys = load_polygons()
    now = datetime.now(timezone.utc).isoformat()
    out = []
    for e in data.get('elements', []):
        t = e.get('tags') or {}
        cat = category(t)
        lat = e.get('lat') or (e.get('center') or {}).get('lat')
        lon = e.get('lon') or (e.get('center') or {}).get('lon')
        if not cat or lat is None:
            continue
        out.append({
            'osm_id': f"{e['type']}/{e['id']}", 'category': cat, 'name': t.get('name'),
            'lat': lat, 'lon': lon, 'village_code': locate(lon, lat, polys),
            'tags': {k: v for k, v in t.items() if k in ('name', 'operator', 'brand', 'railway', 'station', 'amenity', 'shop', 'leisure')},
            'fetched_at': now,
        })
    from collections import Counter
    c = Counter(p['category'] for p in out)
    outside = sum(1 for p in out if not p['village_code'])
    print(f'  生活機能：{len(out)} 點（' + '、'.join(f'{k} {v}' for k, v in c.most_common()) + f'）；{outside} 點未落在任何村里')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--backfill', action='store_true')
    ap.add_argument('--only', choices=['school', 'poi'])
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    sch, pts = [], []
    if args.only in (None, 'school'):
        sch = schools(gov_session(), args.backfill)
    if args.only in (None, 'poi'):
        pts = pois(gov_session(UA))

    if args.dry_run:
        for r in sch[:2] + pts[:2]:
            print('   ', r)
        print('（dry-run，未寫入）')
        return

    from supabase import create_client
    sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    for k in range(0, len(sch), 500):
        sb.table('school_students_yearly').upsert(sch[k:k + 500], on_conflict='school_year,school_code,level').execute()
    for k in range(0, len(pts), 500):
        sb.table('poi_points').upsert(pts[k:k + 500], on_conflict='osm_id').execute()
    print(f'已寫入：學生數 {len(sch)} 筆、生活機能 {len(pts)} 點')

    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as f:
            f.write(f'### 國中小學生數、生活機能\n- 學生數 {len(sch)} 筆\n- 生活機能 {len(pts)} 點\n')


if __name__ == '__main__':
    main()

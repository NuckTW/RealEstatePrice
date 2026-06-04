"""
補齊 building_locations 座標

預售屋策略（雙重補）：
  1. 政府 API (qryType=sale) + fuzzy matching — 正規化名稱後用 difflib 比對
  2. 591 新成屋 API — 關鍵字搜尋，取得座標

成屋策略：
  政府 API (qryType=biz) + 地址正規化 + 前綴比對（已驗證可行）
"""

import base64, difflib, hashlib, json, os, re, time
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad as pkcs7pad
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
supabase = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

KEY     = 'lvr.land.moi.gov.tw'
CITY    = 'D'   # 台南
DELAY   = 1.0   # 政府 API 間隔
DELAY_591 = 0.8 # 591 API 間隔
FUZZY_THRESHOLD = 0.75  # fuzzy matching 相似度門檻

TOWN_NAME = {
    'D01':'中西區','D02':'東區','D03':'南區','D04':'北區','D05':'安平區','D06':'安南區',
    'D07':'永康區','D08':'歸仁區','D09':'新化區','D10':'左鎮區','D11':'玉井區',
    'D12':'楠西區','D13':'南化區','D14':'仁德區','D15':'關廟區','D16':'龍崎區',
    'D17':'官田區','D18':'麻豆區','D19':'佳里區','D20':'西港區','D21':'七股區',
    'D22':'將軍區','D23':'學甲區','D24':'北門區','D25':'新營區','D26':'後壁區',
    'D27':'白河區','D28':'東山區','D29':'六甲區','D30':'下營區','D31':'柳營區',
    'D32':'鹽水區','D33':'善化區','D34':'大內區','D35':'山上區','D36':'新市區',
    'D37':'安定區','D38':'仁德區',
}

# ── 字元正規化 ────────────────────────────────────────────────────────────────

FULLWIDTH = str.maketrans('０１２３４５６７８９', '0123456789')
CN_NUM    = str.maketrans('一二三四五六七八九', '123456789')

def normalize_name(s: str) -> str:
    """正規化建案名稱供 fuzzy 比對：全形→半形、中文數字→阿拉伯數字、去空白"""
    s = s.strip().translate(FULLWIDTH).translate(CN_NUM)
    s = re.sub(r'\s+', '', s)
    return s

def normalize_addr(s: str) -> str:
    """全形→半形，取 # 前半，去行政區前綴"""
    s = s.split('#')[0].strip().translate(FULLWIDTH)
    s = re.sub(r'^[^\s]{2,3}[區市鄉鎮村里]', '', s).strip()
    return s

def strip_district(s: str) -> str:
    return re.sub(r'^(?:臺南市)?[^\s]{2,4}[區市鄉鎮村里]', '', s).strip()

# ── 政府 API 加密 ──────────────────────────────────────────────────────────────

def enc(obj: dict) -> str:
    s    = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    salt = os.urandom(8)
    pwd  = KEY.encode()
    d, d_i = b'', b''
    while len(d) < 48:
        d_i = hashlib.md5(d_i + pwd + salt).digest()
        d  += d_i
    ct = AES.new(d[:32], AES.MODE_CBC, d[32:48]).encrypt(pkcs7pad(s, 16))
    return base64.b64encode(base64.b64encode(b'Salted__' + salt + ct)).decode()

def qhash(obj: dict) -> str:
    return hashlib.md5(json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()

GOV_BASE   = 'https://lvr.land.moi.gov.tw'
DEFAULT_Q  = {
    'ptype': '1,2', 'starty': '107', 'startm': '1', 'endy': '115', 'endm': '12',
    'ftype': '', 'price_s': '', 'price_e': '', 'unit_price_s': '', 'unit_price_e': '',
    'area_s': '', 'area_e': '', 'build_s': '', 'build_e': '',
    'buildyear_s': '', 'buildyear_e': '', 'doorno': '', 'pattern': '',
    'community': '', 'floor': '', 'rent_type': '', 'rent_order': '',
    'urban': '', 'urbantext': '', 'nurban': '', 'aa12': '',
    'p_purpose': '', 'p_unusual_yn': '', 'p_unusualcode': '', 'QB41': '',
    'tmoney_unit': '1', 'pmoney_unit': '1', 'unit': '2',
}

def make_gov_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer':    f'{GOV_BASE}/jsp/list.jsp',
        'X-Requested-With': 'XMLHttpRequest',
    })
    s.get(GOV_BASE, timeout=10)
    return s

def get_gov_token(session: requests.Session) -> str:
    return session.get(f'{GOV_BASE}/jsp/setToken.jsp', timeout=10).json()['token']

def query_gov_district(session: requests.Session, town: str, qry_type: str) -> list:
    """查詢單一行政區所有交易，回傳 [{bn, a_norm, lat, lon}]"""
    token = get_gov_token(session)
    q     = {**DEFAULT_Q, 'qryType': qry_type, 'city': CITY, 'town': town,
             'p_build': '', 'token': token}
    url   = f'{GOV_BASE}/SERVICE/QueryPrice/{qhash(q)}?q={enc(q)}'
    try:
        r = session.get(url, timeout=30)
        if r.status_code != 200:
            return []
        results = []
        for row in r.json():
            if not row.get('lat') or not row.get('lon'):
                continue
            results.append({
                'bn':     row.get('bn', ''),
                'a_norm': normalize_addr(row.get('a', '')),
                'lat':    row.get('lat'),
                'lon':    row.get('lon'),
            })
        return results
    except Exception as e:
        print(f'    [政府 API 警告] {e}')
        return []

# ── 591 API ───────────────────────────────────────────────────────────────────

BASE_591 = 'https://bff-market.591.com.tw'

def make_591_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        'User-Agent':   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':       'application/json, text/plain, */*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Origin':       'https://newdisk.591.com.tw',
        'Referer':      'https://newdisk.591.com.tw/',
    })
    try:
        r = s.get('https://newdisk.591.com.tw/', timeout=10)
        token = s.cookies.get('T591_TOKEN', '')
        s.headers.update({'device': 'pc', 'deviceid': token or 'default'})
    except Exception as e:
        print(f'  [591 初始化警告] {e}')
        s.headers.update({'device': 'pc', 'deviceid': 'default'})
    return s

def get_591_detail_coords(session: requests.Session, building_id) -> tuple:
    """用建案 ID 取得詳細座標"""
    try:
        r = session.get(f'{BASE_591}/v1/newdisk/detail/{building_id}', timeout=10)
        if r.status_code == 200:
            d = (r.json().get('data') or {})
            lat = d.get('lat') or d.get('latitude') or (d.get('location') or {}).get('lat')
            lon = d.get('lng') or d.get('lon') or d.get('longitude') or (d.get('location') or {}).get('lng')
            if lat and lon:
                return float(lat), float(lon)
    except Exception:
        pass
    return None, None

def search_591(session: requests.Session, project_name: str) -> tuple:
    """
    591 關鍵字搜尋 → 回傳 (lat, lon) 或 (None, None)
    嘗試多種可能的回應格式。
    """
    try:
        r = session.get(
            f'{BASE_591}/v1/resource/search-keyword-match',
            params={'q': project_name, 'type': 'newdisk'},
            timeout=10,
        )
        if r.status_code != 200:
            return None, None
        data  = r.json()
        items = (data.get('data') or {}).get('list') or []
        if not items:
            items = data.get('data') or []
        if not isinstance(items, list):
            items = []

        norm_q = normalize_name(project_name)
        best_ratio, best_item = 0.0, None
        for item in items:
            name = (item.get('title') or item.get('name') or
                    item.get('project_name') or item.get('houseName') or '')
            ratio = difflib.SequenceMatcher(None, norm_q, normalize_name(name)).ratio()
            if ratio > best_ratio:
                best_ratio, best_item = ratio, item

        if best_ratio >= FUZZY_THRESHOLD and best_item:
            lat = best_item.get('lat') or best_item.get('latitude')
            lon = best_item.get('lng') or best_item.get('lon') or best_item.get('longitude')
            if lat and lon:
                return float(lat), float(lon)
            # 嘗試用 ID 查詳細座標
            bid = best_item.get('id') or best_item.get('houseid') or best_item.get('houseId')
            if bid:
                return get_591_detail_coords(session, bid)
    except Exception as e:
        print(f'      [591 錯誤] {e}')
    return None, None

# ── 資料庫工具 ─────────────────────────────────────────────────────────────────

def get_presale_projects() -> list:
    r = supabase.rpc('execute_query', {'query_text':
        "SELECT DISTINCT project_name, district FROM transactions "
        "WHERE is_presale=true AND project_name IS NOT NULL AND project_name!='' "
        "ORDER BY district, project_name"
    }).execute()
    return r.data or []

def get_existing_addresses() -> list:
    r = supabase.rpc('execute_query', {'query_text':
        "SELECT DISTINCT "
        "  REGEXP_REPLACE(address, '[0-9零一二三四五六七八九十百千]+樓.*$', '') AS addr, "
        "  district "
        "FROM transactions "
        "WHERE is_presale=false AND address IS NOT NULL AND address!='' "
        "  AND transaction_target LIKE '%建物%' "
        "ORDER BY district, addr"
    }).execute()
    return r.data or []

def get_existing_keys() -> set:
    r = supabase.rpc('execute_query', {'query_text':
        "SELECT location_key FROM building_locations"
    }).execute()
    return {x['location_key'] for x in (r.data or [])}

def upsert_location(key: str, loc_type: str, district: str, name: str, lat: float, lon: float):
    supabase.table('building_locations').upsert({
        'location_key':  key,
        'location_type': loc_type,
        'district':      district,
        'display_name':  name,
        'lat':           float(lat),
        'lon':           float(lon),
    }, on_conflict='location_key').execute()

# ── 主流程 ────────────────────────────────────────────────────────────────────

def main():
    print('=== 補齊 building_locations 座標 ===')

    existing_keys = get_existing_keys()
    print(f'已有座標: {len(existing_keys)} 筆')

    presale  = get_presale_projects()
    existing = get_existing_addresses()
    print(f'預售建案: {len(presale)} 個，成屋地址: {len(existing)} 個')

    presale_needed  = {p['project_name'] for p in presale  if p['project_name'] not in existing_keys}
    existing_needed = {e['addr']         for e in existing if e['addr']         not in existing_keys}
    print(f'需要補: 預售 {len(presale_needed)} 個，成屋 {len(existing_needed)} 個')

    gov_session = make_gov_session()

    # ── district lookup maps
    presale_by_district: dict[str, list] = {}
    for p in presale:
        if p['project_name'] in presale_needed:
            presale_by_district.setdefault(p['district'], []).append(p['project_name'])

    exist_by_district: dict[str, list] = {}
    for e in existing:
        if e['addr'] in existing_needed:
            exist_by_district.setdefault(e['district'], []).append(e['addr'])

    # ════════════════════════════════════════════════════════════════════════════
    # 1 / 3   預售屋 — 政府 API + fuzzy matching
    # ════════════════════════════════════════════════════════════════════════════
    print('\n[1/3] 預售屋 — 政府 API + fuzzy matching ...')
    gov_presale_hit  = 0
    gov_presale_miss = 0   # 紀錄哪些沒命中，留給 591

    for district, names in presale_by_district.items():
        town = next((k for k, v in TOWN_NAME.items() if v == district), None)
        if not town:
            gov_presale_miss += len(names)
            continue
        print(f'  {district} ({len(names)} 棟)', end='  ', flush=True)
        rows = query_gov_district(gov_session, town, 'sale')

        # 建立 {normalize_name: original_name} 查找表
        need_norm = {normalize_name(n): n for n in names if n in presale_needed}
        matched_in_district = 0

        for row in rows:
            bn = row['bn']
            if not bn:
                continue
            norm_bn = normalize_name(bn)

            # 精確比對（優先）
            if norm_bn in need_norm:
                orig = need_norm.pop(norm_bn)
                upsert_location(orig, 'presale', district, orig, row['lat'], row['lon'])
                presale_needed.discard(orig)
                matched_in_district += 1
                gov_presale_hit += 1
                continue

            # Fuzzy 比對
            best_ratio, best_norm_key = 0.0, None
            for norm_key in need_norm:
                r = difflib.SequenceMatcher(None, norm_bn, norm_key).ratio()
                if r > best_ratio:
                    best_ratio, best_norm_key = r, norm_key
            if best_ratio >= FUZZY_THRESHOLD and best_norm_key:
                orig = need_norm.pop(best_norm_key)
                upsert_location(orig, 'presale', district, orig, row['lat'], row['lon'])
                presale_needed.discard(orig)
                matched_in_district += 1
                gov_presale_hit += 1

        gov_presale_miss += len(need_norm)
        print(f'命中 {matched_in_district}/{len(names)}  (fuzzy ≥{FUZZY_THRESHOLD})')
        time.sleep(DELAY)

    print(f'  ✓ 政府 API 共補 {gov_presale_hit} 筆，尚未命中: {len(presale_needed)} 個')

    # ════════════════════════════════════════════════════════════════════════════
    # 2 / 3   預售屋 — 591 補剩下未命中的
    # ════════════════════════════════════════════════════════════════════════════
    if presale_needed:
        print(f'\n[2/3] 預售屋 — 591 補 {len(presale_needed)} 筆 ...')
        s591 = make_591_session()
        hit_591 = 0
        miss_591 = []

        # 建立 project_name → district 對照
        name_to_district = {p['project_name']: p['district'] for p in presale}

        for i, name in enumerate(sorted(presale_needed), 1):
            district = name_to_district.get(name, '')
            print(f'  [{i}/{len(presale_needed)}] {name}', end='  ', flush=True)
            lat, lon = search_591(s591, name)
            if lat and lon:
                upsert_location(name, 'presale', district, name, lat, lon)
                presale_needed.discard(name)
                hit_591 += 1
                print(f'✓ ({lat:.5f}, {lon:.5f})')
            else:
                miss_591.append(name)
                print('✗')
            time.sleep(DELAY_591)

        print(f'  ✓ 591 共補 {hit_591} 筆，仍無座標: {len(miss_591)} 個')
        if miss_591:
            print('  無法命中清單（前20）:')
            for n in miss_591[:20]:
                print(f'    - {n}')
    else:
        print('\n[2/3] 預售屋 — 政府 API 已全部補完，跳過 591')

    # ════════════════════════════════════════════════════════════════════════════
    # 3 / 3   成屋 — 政府 API + 地址比對
    # ════════════════════════════════════════════════════════════════════════════
    print('\n[3/3] 成屋 — 政府 API + 地址比對 ...')
    total_existing = 0
    for district, addrs in exist_by_district.items():
        town = next((k for k, v in TOWN_NAME.items() if v == district), None)
        if not town:
            continue
        print(f'  {district} ({len(addrs)} 棟)', end='  ', flush=True)
        rows = query_gov_district(gov_session, town, 'biz')

        matched = 0
        addr_norm_map = {strip_district(a): a for a in addrs if a}
        for row in rows:
            a_norm = row['a_norm']
            if not a_norm:
                continue
            matched_db_addr = None
            if a_norm in addr_norm_map:
                matched_db_addr = addr_norm_map[a_norm]
            else:
                for norm_key, orig_addr in list(addr_norm_map.items()):
                    if (a_norm.startswith(norm_key[:15]) or norm_key.startswith(a_norm[:15])) and len(norm_key) > 5:
                        matched_db_addr = orig_addr
                        break
            if matched_db_addr and matched_db_addr in existing_needed:
                upsert_location(matched_db_addr, 'existing', district, matched_db_addr, row['lat'], row['lon'])
                existing_needed.discard(matched_db_addr)
                del addr_norm_map[strip_district(matched_db_addr)]
                matched += 1
                total_existing += 1
        print(f'命中 {matched}/{len(addrs)}')
        time.sleep(DELAY)

    print(f'  ✓ 成屋共補 {total_existing} 筆，剩餘無座標: {len(existing_needed)} 個')

    # ── 最終統計
    r = supabase.rpc('execute_query', {'query_text':
        "SELECT location_type, COUNT(*) cnt FROM building_locations GROUP BY location_type"
    }).execute()
    print('\n=== 最終 building_locations ===')
    for row in (r.data or []):
        print(f'  {row["location_type"]}: {row["cnt"]} 筆')
    print('\n✅ 完成！')


if __name__ == '__main__':
    main()

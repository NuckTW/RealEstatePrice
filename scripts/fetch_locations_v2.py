"""
fetch_locations_v2.py
用 Nominatim (OpenStreetMap) geocode 所有建案座標

策略：
  預售: 每個 project_name 取一個代表地址 → 提取路名 → Nominatim
  成屋: 同路名去重，一次查詢覆蓋同路所有建物

速率: 1.2 sec/req（Nominatim 使用規則：≤ 1 req/sec）
台南範圍驗證: lat 22.5–23.6, lon 119.8–120.8
"""

import os, re, sys, time
import requests
from dotenv import load_dotenv
from supabase import create_client

# 強制即時輸出，背景執行時不被緩衝
sys.stdout.reconfigure(line_buffering=True)

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
supabase = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

MAPBOX_TOKEN = os.environ.get('MAPBOX_TOKEN', '')  # 設定於 .env.local：MAPBOX_TOKEN=pk.xxx
DELAY      = 0.2   # Mapbox 100k/月，速率寬鬆
DELAY_BACK = 10.0  # rate-limit 後等待
MAX_RETRY  = 3
TAINAN_LAT = (22.5, 23.6)
TAINAN_LON = (119.8, 120.8)

# ── Mapbox session ─────────────────────────────────────────────────────────────

def make_nom_session() -> requests.Session:
    s = requests.Session()
    return s

def nom_get(session: requests.Session, q: str) -> list:
    """Mapbox Geocoding API，rate-limit 時自動 backoff 重試"""
    import urllib.parse
    for attempt in range(MAX_RETRY):
        try:
            url = f'https://api.mapbox.com/geocoding/v5/mapbox.places/{urllib.parse.quote(q)}.json'
            r = session.get(url,
                params={'access_token': MAPBOX_TOKEN, 'country': 'tw', 'limit': 3},
                timeout=12,
            )
            if r.status_code == 429:
                wait = DELAY_BACK * (attempt + 1)
                print(f'      [rate-limit] 等待 {wait:.0f}s ...')
                time.sleep(wait)
                continue
            if r.status_code != 200:
                print(f'      [HTTP {r.status_code}] {r.text[:80]}')
                return []
            features = r.json().get('features', [])
            # 轉換為統一格式 [{lat, lon}]
            return [{'lat': f['center'][1], 'lon': f['center'][0]} for f in features]
        except Exception as e:
            wait = DELAY_BACK * (attempt + 1)
            print(f'      [錯誤 attempt {attempt+1}] {e}  等待 {wait:.0f}s ...')
            time.sleep(wait)
    return []

def geocode_road(session: requests.Session, road: str, district: str = '') -> tuple:
    """查路名座標，先帶行政區再 fallback 到只帶台南，回傳 (lat, lon) 或 (None, None)"""
    if not road or len(road) < 2:
        return None, None
    # 優先查「路名 + 行政區 + 台南」以區分跨區同名路（中山路、三民路等）
    queries = [f'{road} 台南市{district}', f'{road} 台南'] if district else [f'{road} 台南', road]
    for q in queries:
        data = nom_get(session, q)
        time.sleep(DELAY)
        for item in data:
            lat = float(item['lat'])
            lon = float(item['lon'])
            if TAINAN_LAT[0] < lat < TAINAN_LAT[1] and TAINAN_LON[0] < lon < TAINAN_LON[1]:
                return lat, lon
    return None, None

# ── 地址處理 ───────────────────────────────────────────────────────────────────

def extract_road(addr: str) -> str:
    """
    從完整地址提取路名供 Nominatim 查詢。
    臺南市北區西門路四段357號    → 西門路四段
    臺南市歸仁區中山路一段       → 中山路一段
    臺南市安南區九份子大道與樂活路口 → 九份子大道（取交叉路口第一條路）
    """
    s = addr.strip()
    # 去除縣市/行政區前綴
    s = re.sub(r'^(?:臺南市|台南市)?[^\s]{2,4}[區市鄉鎮]', '', s).strip()
    # 去除土地地號描述（如 "xx段28地號"）
    s = re.sub(r'[^\s]*段\d+地號.*$', '', s).strip()
    # 交叉路口：取 "與" 之前的第一條路
    s = re.sub(r'與[^\s]+(?:路口|交叉口).*$', '', s).strip()
    s = re.sub(r'(?:路口|交叉口).*$', '', s).strip()
    # 去除門號及其後內容（如 "100號之3", "100-2號", "100巷旁"）
    s = re.sub(r'\d[\d\-]*號.*$', '', s).strip()
    # 去除尾端 "旁"、"附近" 等描述
    s = re.sub(r'(?:旁|附近|北側|南側|東側|西側).*$', '', s).strip()
    # 去除尾端標點
    s = re.sub(r'[，。、\s]+$', '', s).strip()
    return s

# ── 資料庫工具 ─────────────────────────────────────────────────────────────────

def get_existing_keys() -> set:
    r = supabase.rpc('execute_query', {'query_text':
        "SELECT location_key FROM building_locations"
    }).execute()
    return {x['location_key'] for x in (r.data or [])}

def get_presale_with_addr() -> list:
    """取得預售建案 + 代表地址（簡化版，用 MIN 取一個地址）"""
    r = supabase.rpc('execute_query', {'query_text':
        "SELECT project_name, district, MIN(address) AS address "
        "FROM transactions "
        "WHERE is_presale=true "
        "  AND project_name IS NOT NULL AND project_name != '' "
        "  AND address IS NOT NULL AND address != '' "
        "GROUP BY project_name, district "
        "LIMIT 1200"
    }).execute()
    return r.data or []

DISTRICTS = [
    '中西區','東區','南區','北區','安平區','安南區','永康區','歸仁區','新化區',
    '左鎮區','玉井區','楠西區','南化區','仁德區','關廟區','龍崎區','官田區',
    '麻豆區','佳里區','西港區','七股區','將軍區','學甲區','北門區','新營區',
    '後壁區','白河區','東山區','六甲區','下營區','柳營區','鹽水區','善化區',
    '大內區','山上區','新市區','安定區',
]

def get_existing_by_district(district: str) -> list:
    """取得單一行政區成屋去樓層地址"""
    r = supabase.rpc('execute_query', {'query_text':
        f"SELECT DISTINCT address FROM transactions "
        f"WHERE is_presale=false AND district='{district}' "
        f"AND address IS NOT NULL AND address != '' "
        f"AND transaction_target LIKE '%建物%' "
        f"LIMIT 5000"
    }).execute()
    return [x['address'] for x in (r.data or [])]

def upsert_location(key: str, loc_type: str, district: str, lat: float, lon: float):
    global supabase
    for attempt in range(3):
        try:
            supabase.table('building_locations').upsert({
                'location_key':  key,
                'location_type': loc_type,
                'district':      district,
                'display_name':  key,
                'lat':           lat,
                'lon':           lon,
            }, on_conflict='location_key').execute()
            return
        except Exception as e:
            if attempt < 2:
                print(f'      [Supabase 重連中...] {e}')
                time.sleep(3)
                supabase = create_client(
                    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
                    os.environ['SUPABASE_SERVICE_ROLE_KEY']
                )
            else:
                print(f'      [Supabase 寫入失敗] {key}: {e}')

# ── 主流程 ────────────────────────────────────────────────────────────────────

def main():
    print('=== Nominatim geocode 補齊 building_locations ===')

    existing_keys = get_existing_keys()
    print(f'已有座標: {len(existing_keys)} 筆')

    nom = make_nom_session()

    # ════════════════════════════════════════════════════════════════════════════
    # 1 / 2   預售屋 — 路名 geocode
    # ════════════════════════════════════════════════════════════════════════════
    print('\n[1/2] 預售屋 — Nominatim 路名 geocode ...')

    presale_rows = get_presale_with_addr()
    presale_needed = [(r['project_name'], r['district'], r['address'])
                      for r in presale_rows if r['project_name'] not in existing_keys]
    print(f'  需補: {len(presale_needed)} 個')

    # 按路名去重：同一路名只查一次，結果共享
    road_cache: dict[tuple, tuple] = {}   # (road, district) → (lat, lon) or (None, None)

    hit, miss = 0, 0
    for i, (name, district, addr) in enumerate(presale_needed, 1):
        road = extract_road(addr)
        if not road:
            miss += 1
            continue

        cache_key = (road, district)
        if cache_key not in road_cache:
            lat, lon = geocode_road(nom, road, district)
            road_cache[cache_key] = (lat, lon)
            time.sleep(DELAY)
        else:
            lat, lon = road_cache[cache_key]

        if lat and lon:
            upsert_location(name, 'presale', district, lat, lon)
            hit += 1
            if i % 50 == 0 or i <= 5:
                print(f'  [{i}/{len(presale_needed)}] {name} → {road} ({lat:.5f},{lon:.5f})')
        else:
            miss += 1
            if i % 100 == 0 or i <= 5:
                print(f'  [{i}/{len(presale_needed)}] {name} → {road} ✗')

    print(f'  ✓ 預售屋補 {hit} 筆，失敗 {miss} 筆')
    print(f'    路名 cache 共 {len(road_cache)} 條路，命中率 {sum(1 for v in road_cache.values() if v[0])/max(len(road_cache),1)*100:.0f}%')

    # ════════════════════════════════════════════════════════════════════════════
    # 2 / 2   成屋 — 逐區查詢 + 路名去重 geocode
    # ════════════════════════════════════════════════════════════════════════════
    print('\n[2/2] 成屋 — 逐區查詢 + Nominatim 路名去重 geocode ...')

    hit_ex = 0
    for di, district in enumerate(DISTRICTS, 1):
        addrs = get_existing_by_district(district)
        # 去除已有座標的、提取路名、去重
        road_to_keys: dict[str, list] = {}
        for addr in addrs:
            # 用 addr 去掉樓層作為 location_key
            import re as _re
            loc_key = _re.sub(r'[0-9零一二三四五六七八九十百千]+樓.*$', '', addr).strip()
            if loc_key in existing_keys:
                continue
            road = extract_road(addr)
            if road:
                road_to_keys.setdefault(road, []).append((loc_key, district))

        unique_roads = list(road_to_keys.keys())
        if not unique_roads:
            print(f'  [{di}/{len(DISTRICTS)}] {district}: 跳過（已完成或無資料）')
            continue

        print(f'  [{di}/{len(DISTRICTS)}] {district}: {len(addrs)} 地址 → {len(unique_roads)} 條路', end='  ', flush=True)
        district_hit = 0
        for road in unique_roads:
            cache_key = (road, district)
            if cache_key in road_cache:
                lat, lon = road_cache[cache_key]
            else:
                lat, lon = geocode_road(nom, road, district)
                road_cache[cache_key] = (lat, lon)

            if lat and lon:
                for loc_key, dist in road_to_keys[road]:
                    if loc_key not in existing_keys:
                        upsert_location(loc_key, 'existing', dist, lat, lon)
                        existing_keys.add(loc_key)
                        district_hit += 1
                        hit_ex += 1

        print(f'補 {district_hit} 筆（累計 {hit_ex}）')

    print(f'  ✓ 成屋共補 {hit_ex} 筆')

    # ── 最終統計
    r = supabase.rpc('execute_query', {'query_text':
        "SELECT location_type, COUNT(*) cnt FROM building_locations GROUP BY location_type"
    }).execute()
    print('\n=== 最終 building_locations ===')
    for row in (r.data or []):
        print(f'  {row["location_type"]}: {row["cnt"]} 筆')
    print('\n✅ 完成！')


if __name__ == '__main__':
    MAX_RESTARTS = 10
    for attempt in range(1, MAX_RESTARTS + 1):
        try:
            main()
            break  # 正常完成，結束
        except Exception as e:
            print(f'\n[!] 發生錯誤（第 {attempt}/{MAX_RESTARTS} 次）: {e}')
            if attempt < MAX_RESTARTS:
                wait = 30 * attempt
                print(f'    {wait} 秒後自動重啟，已補的資料會自動跳過...')
                time.sleep(wait)
                # 重建 Supabase 連線
                supabase = create_client(
                    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
                    os.environ['SUPABASE_SERVICE_ROLE_KEY']
                )
                print(f'    重新啟動中...\n')
            else:
                print('    已達最大重啟次數，結束。')

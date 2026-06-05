"""
fix_project_names.py
統一預售屋建案名稱：修正空白差異、大小寫差異、標點符號差異
同步更新 transactions 和 building_locations 兩張表
"""

import os, re, sys
from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(line_buffering=True)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))
sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

def rpc(sql):
    r = sb.rpc('execute_query', {'query_text': sql}).execute()
    return r.data or []

def normalize(s):
    """正規化建案名稱，用於比對相同建案"""
    s = s.strip()
    s = re.sub(r'\s+', '', s)
    s = s.replace('．', '.').replace('。', '.').replace('·', '.').replace('‧', '.').replace('・', '.')
    s = s.replace('，', ',').replace('、', ',')
    return s.lower()

def pick_canonical(variants: list[tuple[str, int]]) -> str:
    """從變體中選擇最佳標準名稱：
    1. 筆數最多的
    2. 同筆數則選較短的（無多餘空白）
    """
    # 依筆數降序排，同筆數依名稱長度升序
    variants.sort(key=lambda x: (-x[1], len(x[0])))
    return variants[0][0]

# 拉所有建案名稱
rows = rpc("SELECT project_name, COUNT(*) as cnt FROM transactions WHERE is_presale=true AND project_name IS NOT NULL GROUP BY project_name")
print(f'共 {len(rows)} 個建案名稱')

# 分組
groups: dict[str, list] = {}
for r in rows:
    n = normalize(r['project_name'])
    groups.setdefault(n, []).append((r['project_name'], int(r['cnt'])))

dups = {k: v for k, v in groups.items() if len(v) > 1}
print(f'名稱不一致組數: {len(dups)}\n')

if not dups:
    print('✅ 無需修正')
    exit(0)

total_updated = 0

for norm, variants in sorted(dups.items(), key=lambda x: -sum(c for _, c in x[1])):
    canonical = pick_canonical(variants)
    others = [v for v, _ in variants if v != canonical]
    total_cnt = sum(c for _, c in variants)

    print(f'[{total_cnt}筆] 標準名稱: 「{canonical}」')
    for v in others:
        cnt = next(c for name, c in variants if name == v)
        safe_v = v.replace("'", "''")
        safe_c = canonical.replace("'", "''")
        print(f'  更新 {cnt} 筆: 「{v}」→「{canonical}」')

        # 更新 transactions
        sb.table('transactions').update({'project_name': canonical}).eq('project_name', v).eq('is_presale', True).execute()

        # 更新 building_locations（presale 的 location_key = project_name）
        # 若 canonical 已存在，直接刪除舊名稱的記錄；否則更新 key
        existing = sb.table('building_locations').select('location_key').eq('location_key', canonical).eq('location_type', 'presale').execute()
        if existing.data:
            # canonical 已有記錄，刪除舊名稱的重複
            sb.table('building_locations').delete().eq('location_key', v).eq('location_type', 'presale').execute()
        else:
            sb.table('building_locations').update({'location_key': canonical, 'display_name': canonical}).eq('location_key', v).eq('location_type', 'presale').execute()

        total_updated += cnt

print(f'\n✅ 共修正 {total_updated} 筆交易記錄')

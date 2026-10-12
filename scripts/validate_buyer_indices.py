"""
潛在客群指數跨期驗證（唯讀，不寫 DB）

做法：
  1. 在幾個歷史時點 t0（預設 2021–2024 年 7 月），用與 materialized view 相同的公式
     （supabase/migrations/20261003_village_buyer_indicators.sql）重算各里原始指標
  2. 各指數 = 組成指標全市百分位（NULL→50）加權平均；各里分數平均到行政區
  3. 與 t0「之後 24 個月」各區住宅交易／每千戶比 Spearman 排名相關
       新屋 = 預售 ＋ 屋齡 3 年內成屋；二手 = 屋齡 5 年以上成屋
  4. 分「全 37 區」與「都市 18 區（戶數前一半）」兩組；後者排除城鄉差距撐高的相關
  含設籍宅數成長的公式，只用季資料完整的時點（村里季資料 2022Q4–2023Q4 缺）

用法（執行路徑：專案根目錄）：
  python3 scripts/validate_buyer_indices.py
  python3 scripts/validate_buyer_indices.py --t0 2022-07 2023-07

需要環境變數 NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY（會自動讀 .env.local）
"""

from __future__ import annotations

import argparse
import bisect
import os
import statistics as st
from datetime import date

# ── 要比較的公式（key 與前端 src/lib/buyerIndex.ts 的 RawKey 相同） ──
FORMULAS: dict[str, list[tuple[str, float]]] = {
    'v7 首購':   [('share2534', 70), ('marriage', 15), ('income', 15)],
    'v7 換新屋': [('share3544', 45), ('birth', 40), ('income', 15)],
    'v7 換二手': [('head2645', 35), ('eduUnivPlus', 45), ('income', 20)],
    'v7 新屋熱度': [('cohortYoung', 30), ('cohortMid', 20), ('social', 20), ('dwellingsGrowth', 30)],
    'v6 首購':   [('cohortYoung', 30), ('share2534', 25), ('marriage', 10), ('income', 25), ('social', 10)],
    'v6 換新屋': [('cohortMid', 20), ('share3544', 20), ('birth', 20), ('income', 20), ('dwellingsGrowth', 20)],
    'v6 換二手': [('cohortMid', 10), ('share3544', 20), ('head2645', 20), ('income', 30), ('eduUnivPlus', 20)],
}
TARGETS = ('presale', 'new', 'resale')
TARGET_LABEL = {'presale': '預售', 'new': '新屋', 'resale': '二手'}
URBAN_N = 18   # 都市組：戶數前 18 區


def add_months(d: date, n: int) -> date:
    y, m = divmod(d.month - 1 + n, 12)
    return date(d.year + y, m + 1, 1)


def load_env() -> None:
    """讀 .env.local（若有 python-dotenv）；已存在的環境變數不覆蓋"""
    try:
        from dotenv import load_dotenv
        load_dotenv('.env.local', override=False)
    except ImportError:
        pass


class DB:
    """只走 execute_query RPC 的唯讀查詢"""

    def __init__(self) -> None:
        from supabase import create_client
        self.sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'],
                                os.environ['SUPABASE_SERVICE_ROLE_KEY'])

    def q(self, sql: str) -> list[dict]:
        return self.sb.rpc('execute_query', {'query_text': sql.strip()}).execute().data or []


def village_raw(db: DB, t0: date) -> tuple[list[dict], str | None]:
    """t0 當月為時間窗終點，回傳（各里原始指標, 使用的季資料日期）。公式與 MV 一致（含小數 2 位再排名）"""
    end, start = t0.strftime('%Y-%m-01'), add_months(t0, -12).strftime('%Y-%m-01')
    roc = t0.year - 1911
    tax_year = roc - 3   # 綜所稅村里資料約落後 3 年公布（115 年時最新為 112）
    edu_year = roc - 1   # 戶政教育程度約落後 1 年
    sql = f"""
WITH
win AS (SELECT '{end}'::date AS end_date, '{start}'::date AS start_date),
cur AS (SELECT p.* FROM village_population_monthly p, win WHERE p.ym_date = win.end_date),
prev AS (SELECT p.* FROM village_population_monthly p, win WHERE p.ym_date = win.start_date),
pop_w AS (SELECT p.village_code, avg(p.pop_total)::numeric AS avg_pop FROM village_population_monthly p, win
          WHERE p.ym_date > win.start_date AND p.ym_date <= win.end_date GROUP BY p.village_code),
vital_w AS (SELECT v.village_code, sum(v.births) AS births, sum(v.marriages) AS marriages, count(*) AS n_months
            FROM village_vital_monthly v, win WHERE v.ym_date > win.start_date AND v.ym_date <= win.end_date GROUP BY v.village_code),
mig_w AS (SELECT m.village_code,
                 sum(m.in_total - m.out_total + coalesce(m.in_same_town, 0) - coalesce(m.out_same_town, 0)) AS net_social,
                 count(*) AS n_months
          FROM village_migration_monthly m, win WHERE m.ym_date > win.start_date AND m.ym_date <= win.end_date GROUP BY m.village_code),
cohort AS (
  SELECT c.village_code,
    (SELECT sum(c.ages_m[i] + c.ages_f[i]) FROM generate_series(27, 36) i) - (SELECT sum(p.ages_m[i] + p.ages_f[i]) FROM generate_series(26, 35) i) AS young_net,
    (SELECT sum(p.ages_m[i] + p.ages_f[i]) FROM generate_series(26, 35) i) AS young_base,
    (SELECT sum(c.ages_m[i] + c.ages_f[i]) FROM generate_series(37, 46) i) - (SELECT sum(p.ages_m[i] + p.ages_f[i]) FROM generate_series(36, 45) i) AS mid_net,
    (SELECT sum(p.ages_m[i] + p.ages_f[i]) FROM generate_series(36, 45) i) AS mid_base
  FROM cur c JOIN prev p USING (village_code)),
inc AS (SELECT village_code, income_median FROM village_income_yearly WHERE tax_year = {tax_year} AND village_code IS NOT NULL),
edu AS (SELECT village_code, (edu_doctor + edu_master + edu_university)::numeric / nullif(edu_15up_total, 0) * 100 AS edu_univ
        FROM village_annual_stats WHERE year = {edu_year}),
hq_d AS (SELECT max(period_date) AS d FROM village_household_quarterly WHERE period_date <= '{end}'::date),
hq AS (SELECT q.village_code, q.dwellings,
              (q.head_25_35 + q.head_35_45)::numeric / nullif(q.heads_total, 0) * 100 AS head2645
       FROM village_household_quarterly q, hq_d WHERE q.period_date = hq_d.d),
hq_prev AS (SELECT q.village_code, q.dwellings FROM village_household_quarterly q, hq_d
            WHERE q.period_date = (hq_d.d - interval '1 year')::date),
base AS (
  SELECT c.village_code, vg.district, c.pop_total, c.households,
    c.age_25_34::numeric / nullif(c.pop_total, 0) * 100 AS share2534,
    c.age_35_44::numeric / nullif(c.pop_total, 0) * 100 AS share3544,
    co.young_net::numeric / nullif(co.young_base, 0) * 1000 AS cohort_young,
    co.mid_net::numeric / nullif(co.mid_base, 0) * 1000 AS cohort_mid,
    vw.marriages, vw.births, pw.avg_pop * vw.n_months / 12.0 AS exposure,
    mw.net_social / nullif(pw.avg_pop, 0) * 1000 * 12.0 / nullif(mw.n_months, 0) AS social,
    inc.income_median AS income, edu.edu_univ, hq.head2645,
    (hq.dwellings::numeric / nullif(hp.dwellings, 0) - 1) * 100 AS dwellings_growth
  FROM cur c JOIN villages vg USING (village_code)
  LEFT JOIN cohort co USING (village_code) LEFT JOIN pop_w pw USING (village_code)
  LEFT JOIN vital_w vw USING (village_code) LEFT JOIN mig_w mw USING (village_code)
  LEFT JOIN inc USING (village_code) LEFT JOIN edu USING (village_code)
  LEFT JOIN hq USING (village_code) LEFT JOIN hq_prev hp USING (village_code)),
dist_rate AS (SELECT district, sum(marriages)::numeric / nullif(sum(exposure), 0) AS mr,
                     sum(births)::numeric / nullif(sum(exposure), 0) AS br FROM base GROUP BY district)
SELECT b.village_code AS code, b.district, b.pop_total AS pop, b.households AS hh,
  (SELECT d FROM hq_d)::text AS hq_date,
  round(b.share2534, 2) AS share2534, round(b.share3544, 2) AS share3544,
  round(b.cohort_young, 2) AS "cohortYoung", round(b.cohort_mid, 2) AS "cohortMid",
  round((b.marriages + 7000 * d.mr) / (b.exposure + 7000) * 1000, 3) AS marriage,
  round((b.births + 7000 * d.br) / (b.exposure + 7000) * 1000, 3) AS birth,
  round(b.social, 2) AS social, b.income, round(b.edu_univ, 2) AS "eduUnivPlus",
  round(b.head2645, 2) AS head2645, round(b.dwellings_growth, 2) AS "dwellingsGrowth"
FROM base b JOIN dist_rate d USING (district)
"""
    rows = db.q(sql)
    hq_date = rows[0]['hq_date'] if rows else None
    for r in rows:
        for k, v in list(r.items()):
            if k not in ('code', 'district', 'hq_date') and v is not None:
                r[k] = float(v)
    return rows, hq_date


def district_tx(db: DB, lo: date, hi: date) -> dict[str, dict[str, float]]:
    """各區 [lo, hi) 住宅交易筆數（排除特殊關係）"""
    sql = f"""
WITH t AS (
  SELECT district, transaction_date, is_presale,
    CASE WHEN completion_date ~ '^[0-9]{{6,7}}$'
         THEN make_date(left(completion_date, length(completion_date) - 4)::int + 1911,
                        greatest(1, least(12, substr(completion_date, length(completion_date) - 3, 2)::int)), 1)
    END AS done
  FROM transactions
  WHERE transaction_date >= '{lo.isoformat()}' AND transaction_date < '{hi.isoformat()}'
    AND (building_type LIKE '住宅大樓%' OR building_type LIKE '華廈%' OR building_type LIKE '透天%'
         OR building_type LIKE '公寓%' OR building_type LIKE '套房%')
    AND coalesce(notes, '') NOT LIKE '%特殊關係%' AND total_price > 0)
SELECT district,
  count(*) FILTER (WHERE is_presale) AS presale,
  count(*) FILTER (WHERE is_presale OR (done IS NOT NULL AND transaction_date - done <= 1096)) AS new,
  count(*) FILTER (WHERE NOT is_presale AND done IS NOT NULL AND transaction_date - done > 1826) AS resale
FROM t GROUP BY district
"""
    return {r['district']: {k: float(v) for k, v in r.items() if k != 'district'} for r in db.q(sql)}


# ── 計算（與前端 buyerIndex.ts 相同定義） ──
def prank(vals: list[float | None]) -> list[float]:
    """全市百分位 0–100：(比自己小的個數) ÷ (n − 1)；NULL → 50"""
    xs = sorted(x for x in vals if x is not None)
    m = len(xs)
    return [50.0 if (x is None or m < 2) else bisect.bisect_left(xs, x) / (m - 1) * 100 for x in vals]


def index_scores(rows: list[dict], comps: list[tuple[str, float]]) -> list[float]:
    parts = {k: prank([r.get(k) for r in rows]) for k, _ in comps}
    tw = sum(w for _, w in comps)
    return [sum(w * parts[k][i] for k, w in comps) / tw for i in range(len(rows))]


def spearman(a: list[float], b: list[float]) -> float:
    ra, rb = prank(a), prank(b)
    ma, mb = st.mean(ra), st.mean(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** 0.5
    return num / den if den else float('nan')


def evaluate(rows: list[dict], fut: dict, comps, urban: bool) -> dict[str, float]:
    """各里分數 → 區平均 → 與未來每千戶交易的 Spearman"""
    acc: dict[str, list[float]] = {}
    for r, s in zip(rows, index_scores(rows, comps)):
        a = acc.setdefault(r['district'], [0.0, 0.0, 0.0])
        a[0] += s; a[1] += 1; a[2] += r['hh']
    ds = sorted(acc, key=lambda d: -acc[d][2])[: (URBAN_N if urban else None)]
    sc = [acc[d][0] / acc[d][1] for d in ds]
    return {t: spearman(sc, [fut.get(d, {}).get(t, 0) / acc[d][2] * 1000 for d in ds]) for t in TARGETS}


def main() -> None:
    ap = argparse.ArgumentParser(description='潛在客群指數跨期驗證（唯讀）')
    ap.add_argument('--t0', nargs='+', default=['2021-07', '2022-07', '2023-07', '2024-07'],
                    help='時間窗終點（YYYY-MM），需早於最新資料 24 個月以上')
    args = ap.parse_args()
    load_env()
    db = DB()

    data = []
    for s in args.t0:
        y, m = map(int, s.split('-'))
        t0 = date(y, m, 1)
        rows, hq_date = village_raw(db, t0)
        fut = district_tx(db, add_months(t0, 1), add_months(t0, 25))
        # 宅數成長可用：季資料日期在 t0 前 6 個月內，且九成以上的里有值
        dw_ok = (hq_date is not None and date.fromisoformat(hq_date) >= add_months(t0, -6)
                 and sum(r['dwellingsGrowth'] is not None for r in rows) >= 0.9 * len(rows))
        data.append((t0, rows, fut, dw_ok))
        print(f'{t0:%Y-%m}：{len(rows)} 里、季資料 {hq_date}、宅數成長{"可用" if dw_ok else "不可用（跳過含宅數成長的公式）"}')

    print(f'\n跨期 Spearman（t0 分數 vs 之後 24 個月每千戶交易，各時點平均）')
    head = ' '.join(TARGET_LABEL[t] for t in TARGETS)
    print(f'{"":14s}| 全 37 區 {head} | 都市 {URBAN_N} 區 {head} | 時點數')
    for name, comps in FORMULAS.items():
        uses_dw = any(k == 'dwellingsGrowth' for k, _ in comps)
        use = [(rows, fut) for _, rows, fut, ok in data if ok or not uses_dw]
        if not use:
            print(f'{name:14s}| （沒有可用時點）')
            continue
        res = {u: {t: st.mean(evaluate(r, f, comps, u)[t] for r, f in use) for t in TARGETS} for u in (False, True)}
        fmt = lambda d: ' '.join(f'{d[t]:5.2f}' for t in TARGETS)
        print(f'{name:14s}|        {fmt(res[False])} |          {fmt(res[True])} | {len(use)}')


if __name__ == '__main__':
    main()

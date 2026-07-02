import { cachedQuery, runQuery, type Row } from './client'
import { escapeSqlString } from '@/lib/filters'

/** 建案名稱清單 → SQL IN 列表（單引號跳脫） */
function toSqlList(projects: string[]): string {
  return projects.map(p => `'${escapeSqlString(p)}'`).join(',')
}

/** ILIKE pattern 跳脫：除了單引號，還要跳脫萬用字元 % 和 _ */
function escapeLikePattern(s: string): string {
  return escapeSqlString(s).replace(/\\/g, '\\\\').replace(/[%_]/g, m => `\\${m}`)
}

/** 框選分析：依建案名稱清單取每案統計 */
export async function fetchProjectStats(projects: string[]): Promise<Row[]> {
  if (!projects.length) return []
  return cachedQuery(`
    SELECT
      t.project_name,
      t.district,
      COUNT(*)::int                                           AS count,
      ROUND((AVG(t.unit_price_sqm)*3.3058/10000)::numeric,1) AS unit_price,
      ROUND(AVG(t.total_price)/10000)::int                   AS avg_total,
      MIN(t.transaction_date)::text                          AS first_date,
      MAX(t.transaction_date)::text                          AS last_date
    FROM transactions t
    WHERE t.is_presale = true
      AND t.project_name IN (${toSqlList(projects)})
      AND t.transaction_target LIKE '%建物%'
    GROUP BY t.project_name, t.district
    ORDER BY unit_price DESC
  `)
}

/** 框選分析：各建案月度均單價走勢 */
export async function fetchProjectTrend(projects: string[]): Promise<Row[]> {
  if (!projects.length) return []
  return cachedQuery(`
    SELECT
      t.project_name,
      TO_CHAR(t.transaction_date, 'YYYY-MM')                  AS month,
      ROUND((AVG(t.unit_price_sqm)*3.3058/10000)::numeric,1)  AS unit_price,
      COUNT(*)::int                                            AS count
    FROM transactions t
    WHERE t.is_presale = true
      AND t.project_name IN (${toSqlList(projects)})
      AND t.transaction_target LIKE '%建物%'
    GROUP BY t.project_name, month
    ORDER BY t.project_name, month
  `)
}

/** 框選分析：各建案建物型態分布 */
export async function fetchProjectBuildingTypes(projects: string[]): Promise<Row[]> {
  if (!projects.length) return []
  return cachedQuery(`
    SELECT
      t.project_name,
      t.building_type,
      COUNT(*)::int AS count
    FROM transactions t
    WHERE t.is_presale = true
      AND t.project_name IN (${toSqlList(projects)})
      AND t.transaction_target LIKE '%建物%'
      AND t.building_type IS NOT NULL AND t.building_type != ''
    GROUP BY t.project_name, t.building_type
    ORDER BY t.project_name, count DESC
  `)
}

/** 搜尋建案名稱（供手動加入）；即時搜尋不走快取 */
export async function searchPresaleProjects(q: string): Promise<Row[]> {
  return runQuery(`
    SELECT t.project_name, t.district,
      COUNT(*)::int AS count
    FROM transactions t
    WHERE t.is_presale = true
      AND t.project_name ILIKE '%${escapeLikePattern(q)}%'
      AND t.project_name IS NOT NULL AND t.project_name != ''
      AND t.transaction_target LIKE '%建物%'
    GROUP BY t.project_name, t.district
    ORDER BY count DESC
    LIMIT 20
  `)
}

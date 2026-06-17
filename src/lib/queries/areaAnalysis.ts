import { runQuery, type Row } from './client'

/** 框選分析：依建案名稱清單取每案統計 */
export async function fetchProjectStats(projects: string[]): Promise<Row[]> {
  if (!projects.length) return []
  const list = projects.map(p => `'${p.replace(/'/g, "''")}'`).join(',')
  return runQuery(`
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
      AND t.project_name IN (${list})
      AND t.transaction_target LIKE '%建物%'
    GROUP BY t.project_name, t.district
    ORDER BY unit_price DESC
  `)
}

/** 框選分析：各建案月度均單價走勢 */
export async function fetchProjectTrend(projects: string[]): Promise<Row[]> {
  if (!projects.length) return []
  const list = projects.map(p => `'${p.replace(/'/g, "''")}'`).join(',')
  return runQuery(`
    SELECT
      t.project_name,
      TO_CHAR(t.transaction_date, 'YYYY-MM')                  AS month,
      ROUND((AVG(t.unit_price_sqm)*3.3058/10000)::numeric,1)  AS unit_price,
      COUNT(*)::int                                            AS count
    FROM transactions t
    WHERE t.is_presale = true
      AND t.project_name IN (${list})
      AND t.transaction_target LIKE '%建物%'
    GROUP BY t.project_name, month
    ORDER BY t.project_name, month
  `)
}

/** 搜尋建案名稱（供手動加入） */
export async function searchPresaleProjects(q: string): Promise<Row[]> {
  const safe = q.replace(/'/g, "''")
  return runQuery(`
    SELECT DISTINCT t.project_name, t.district,
      COUNT(*)::int AS count
    FROM transactions t
    WHERE t.is_presale = true
      AND t.project_name ILIKE '%${safe}%'
      AND t.project_name IS NOT NULL AND t.project_name != ''
      AND t.transaction_target LIKE '%建物%'
    GROUP BY t.project_name, t.district
    ORDER BY count DESC
    LIMIT 20
  `)
}

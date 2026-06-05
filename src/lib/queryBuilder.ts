/**
 * 共用 WHERE 條件建構器
 * 用於 /api/charts 和 /api/map，確保兩者套用相同篩選邏輯。
 *
 * @param params      URL search params
 * @param tableAlias  有 JOIN 時需傳入 transactions 的 alias（如 't'），避免欄位名稱衝突
 */
export function buildWhere(params: URLSearchParams, tableAlias = '', skipDate = false): string {
  const p = tableAlias ? `${tableAlias}.` : ''
  const conds: string[] = [`${p}unit_price_sqm > 0`, `${p}total_price > 0`]

  const fromYear  = parseInt(params.get('dateFromYear')  ?? '110') + 1911
  const fromMonth = parseInt(params.get('dateFromMonth') ?? '1')
  const toYear    = parseInt(params.get('dateToYear')    ?? '115') + 1911
  const toMonth   = parseInt(params.get('dateToMonth')   ?? '12')

  const fromDate   = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01`
  const nextMonth  = toMonth === 12 ? 1 : toMonth + 1
  const nextYear   = toMonth === 12 ? toYear + 1 : toYear
  const toDateExcl = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  if (!skipDate) {
    conds.push(`${p}transaction_date >= '${fromDate}' AND ${p}transaction_date < '${toDateExcl}'`)
  }

  const districts = (params.get('districts') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (districts.length > 0) {
    const list = districts.map(d => `'${d.replace(/'/g, "''")}'`).join(',')
    conds.push(`${p}district IN (${list})`)
  }

  const types = (params.get('types') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (types.length > 0) {
    const typeConds = types.map(t => {
      const safe = t.replace(/'/g, "''")
      return `TRIM(${p}building_type) LIKE '${safe}%'`
    })
    conds.push(`(${typeConds.join(' OR ')})`)
  }

  const rooms = (params.get('rooms') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (rooms.length > 0) {
    const roomConds = rooms.map(r => {
      if (r === '5+') return `${p}rooms >= 5`
      return `COALESCE(${p}rooms, 0) = ${parseInt(r)}`
    })
    conds.push(`(${roomConds.join(' OR ')})`)
  }

  const presale = params.get('presale') ?? 'all'
  if (presale === 'true')       conds.push(`${p}is_presale = true`)
  else if (presale === 'false') conds.push(`${p}is_presale = false`)

  const buildingAge = params.get('buildingAge') ?? 'all'
  if (buildingAge !== 'all' && presale !== 'true') {
    const ageExpr   = `(EXTRACT(YEAR FROM ${p}transaction_date) - (CAST(LEFT(${p}completion_date, 3) AS INT) + 1911))`
    const ageFilter = `${p}completion_date IS NOT NULL AND LENGTH(${p}completion_date) >= 3 AND ${ageExpr} >= 0`
    const ageCond   = buildingAge === '30+'
      ? `${ageFilter} AND ${ageExpr} > 30`
      : `${ageFilter} AND ${ageExpr} <= ${parseInt(buildingAge)}`

    if (presale === 'all') {
      conds.push(`(${p}is_presale = true OR (${ageCond}))`)
    } else {
      conds.push(ageCond)
    }
  }

  return conds.join(' AND ')
}

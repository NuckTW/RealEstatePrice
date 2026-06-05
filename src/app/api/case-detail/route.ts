import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function runQuery(sql: string) {
  const { data, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql.trim() })
  if (error) throw error
  return (data as Record<string, unknown>[]) ?? []
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const name      = p.get('name')      ?? ''
  const district  = p.get('district')  ?? ''
  const caseType  = p.get('case_type') ?? 'presale'   // 'presale' | 'existing'

  // date range
  const fromYear  = parseInt(p.get('dateFromYear')  ?? '110') + 1911
  const fromMonth = parseInt(p.get('dateFromMonth') ?? '1')
  const toYear    = parseInt(p.get('dateToYear')    ?? '115') + 1911
  const toMonth   = parseInt(p.get('dateToMonth')   ?? '12')

  const fromDate   = `${fromYear}-${String(fromMonth).padStart(2,'0')}-01`
  const nextMonth  = toMonth === 12 ? 1 : toMonth + 1
  const nextYear   = toMonth === 12 ? toYear + 1 : toYear
  const toDateExcl = `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`

  const safeName     = name.replace(/'/g, "''")
  const safeDistrict = district.replace(/'/g, "''")

  let sql: string
  const selectCols = `
        transaction_date,
        floor,
        total_floors,
        COALESCE(rooms, 0)                                               AS rooms,
        ROUND((NULLIF(building_area_sqm,0) * 0.3025)::numeric, 1)       AS area,
        ROUND((unit_price_sqm * 3.3058 / 10000)::numeric, 1)            AS unit_price,
        ROUND(total_price / 10000)::int                                  AS total_price,
        CASE
          WHEN parking_type IS NULL OR parking_type = '' THEN 'x'
          WHEN COALESCE(parking_price, 0) = 0             THEN '含'
          ELSE ROUND(parking_price / 10000)::int::text
        END                                                              AS parking_price`

  if (caseType === 'presale') {
    // 預售屋：建案只要在篩選範圍內有銷售記錄就顯示全部交易（不限日期）
    // 因為預售銷售期可能跨越使用者設定的範圍，顯示完整建案資料較有意義
    sql = `
      SELECT ${selectCols}
      FROM transactions
      WHERE district = '${safeDistrict}'
        AND project_name = '${safeName}'
        AND is_presale = true
        AND unit_price_sqm > 0
      ORDER BY transaction_date DESC
      LIMIT 500
    `
  } else {
    sql = `
      SELECT ${selectCols}
      FROM transactions
      WHERE district = '${safeDistrict}'
        AND REGEXP_REPLACE(address, '[0-9零一二三四五六七八九十百千]+樓.*$', '') = '${safeName}'
        AND is_presale = false
        AND address IS NOT NULL AND address != ''
        AND transaction_target LIKE '%建物%'
        AND transaction_date >= '${fromDate}'
        AND transaction_date < '${toDateExcl}'
        AND unit_price_sqm > 0
      ORDER BY transaction_date DESC
      LIMIT 200
    `
  }

  try {
    const rows = await runQuery(sql)
    return NextResponse.json({ rows })
  } catch (err) {
    console.error('[/api/case-detail]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

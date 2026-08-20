import { NextRequest, NextResponse } from 'next/server'
import { buildWhere } from '@/lib/filters'
import { fetchTransactions } from '@/lib/queries/transactions'

const DEFAULT_LIMIT = 50
const MAX_LIMIT      = 200
const MAX_OFFSET     = 5000  // 深層 OFFSET 會拖慢查詢，超過此上限請使用者縮小日期範圍

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams

  const rawLimit = parseInt(p.get('limit') ?? String(DEFAULT_LIMIT))
  const limit  = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT, 1), MAX_LIMIT)

  const rawOffset = parseInt(p.get('offset') ?? '0')
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0)

  if (offset > MAX_OFFSET) {
    return NextResponse.json(
      { error: `分頁範圍過深（offset 超過 ${MAX_OFFSET}），請縮小日期範圍後再查詢` },
      { status: 400 }
    )
  }

  try {
    // 篩選條件與 /api/charts、/api/map 共用同一套 buildWhere，確保三者邏輯一致
    // （這裡保留日期篩選，因為 Dashboard 本身就有日期選擇器）
    const where = buildWhere(p)
    const rows  = await fetchTransactions(where, limit, offset)

    const hasMore = rows.length > limit
    return NextResponse.json({ rows: rows.slice(0, limit), hasMore })
  } catch (err) {
    console.error('[/api/transactions]', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { runQuery } from '@/lib/queries/client'

/**
 * Supabase keep-alive（由 Vercel Cron 每日呼叫，見 vercel.json）
 * Supabase free tier 閒置 7 天會自動暫停，scraper 每月只跑 3 次不足以維持活躍，
 * 因此定期執行一個極輕量的查詢讓專案保持喚醒狀態。
 *
 * 注意：刻意用 runQuery（不走 unstable_cache），否則命中快取時根本不會碰到資料庫。
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Vercel Cron 會帶 Authorization: Bearer <CRON_SECRET>，擋掉外部隨意呼叫
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const started = Date.now()
    const rows = await runQuery('SELECT 1 AS ok')
    return NextResponse.json({
      ok: rows[0]?.ok === 1,
      latency_ms: Date.now() - started,
      at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[/api/keepalive]', err)
    return NextResponse.json({ ok: false, error: 'db unreachable' }, { status: 500 })
  }
}

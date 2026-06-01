import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc('execute_query', {
      query_text: `
        SELECT
          MAX(transaction_date)::text AS last_date,
          COUNT(*)::int               AS total
        FROM transactions
      `.trim()
    })
    if (error) throw error
    const row = (data as Record<string, unknown>[])?.[0] ?? {}
    return NextResponse.json({ last_date: row.last_date ?? null, total: row.total ?? 0 })
  } catch {
    return NextResponse.json({ last_date: null, total: 0 })
  }
}

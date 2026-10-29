import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'

export type Row = Record<string, unknown>

/** 執行唯讀 SQL（失敗時丟出例外） */
export async function runQuery(sql: string): Promise<Row[]> {
  const { data, error } = await supabaseAdmin.rpc('execute_query', { query_text: sql.trim() })
  if (error) throw error
  return (data as Row[]) ?? []
}

/**
 * AI 問答專用：執行 LLM 產生的 SQL，回傳 { rows, error } 而不丟例外（錯誤訊息要回報給使用者）
 * 走 chat_query 而不是 execute_query：DB 端以唯讀 chat_reader 身分執行、只能讀 transactions 與統計 view、
 * 8 秒逾時、最多回 10001 筆（見 supabase/migrations/20261029_chat_query_readonly.sql）
 * ⚠️ LLM 或使用者輸入產生的 SQL 一律走這裡，不要用 runQuery / cachedQuery
 */
export async function runChatQuery(sql: string): Promise<{ rows: Row[]; error: { message: string } | null }> {
  const { data, error } = await supabaseAdmin.rpc('chat_query', { query_text: sql })
  const rows = Array.isArray(data) ? (data as Row[]) : data ? [data as Row] : []
  return { rows, error }
}

/**
 * 帶快取的唯讀查詢：以 SQL 字串為快取 key。
 * 資料由 scraper 於每月 1、11、21 日更新，1 小時快取不影響時效性。
 */
export const cachedQuery = unstable_cache(
  (sql: string) => runQuery(sql),
  ['execute-query'],
  { revalidate: 3600, tags: ['transactions'] }
)

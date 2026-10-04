import type { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { timingSafeEqual } from 'node:crypto'

/**
 * AI 功能共用：Gemini client、模型 fallback、密碼驗證、限流
 * 使用者：/api/chat（AI 問答）、/api/potential-buyers/ai-weights（AI 建議指數權重）
 * ⚠️ 只能在 server 端 import
 */

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// ── 模型設定 ────────────────────────────────────────────
// 免費層每個模型各有獨立 RPD 上限（3.8-flash 免費層僅約 20 RPD，公開用會秒爆），
// text-to-SQL 用 flash-lite 等級即足夠；主模型打到 429 時自動切到 fallback。
export const PRIMARY_MODEL  = process.env.GEMINI_MODEL          ?? 'gemini-3.5-flash-lite'
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-2.5-flash-lite'

export function isQuotaError(err: unknown): boolean {
  const e = err as { status?: number; message?: string }
  return e?.status === 429 || /429|quota|RESOURCE_EXHAUSTED/i.test(e?.message ?? '')
}

/** 先用 first 模型，quota 爆了就換 fallback；回傳 { result, model } 讓前端知道實際用了哪個 */
export async function withFallback<T>(
  fn: (modelId: string) => Promise<T>,
  first: string = PRIMARY_MODEL,
): Promise<{ result: T; model: string }> {
  try {
    return { result: await fn(first), model: first }
  } catch (err) {
    if (!isQuotaError(err) || first === FALLBACK_MODEL) throw err
    console.warn(`[ai] ${first} quota 用盡，改用 ${FALLBACK_MODEL}`)
    return { result: await fn(FALLBACK_MODEL), model: FALLBACK_MODEL }
  }
}

// ── 存取控制 ────────────────────────────────────────────
// 兩種放行方式：
//   1. x-chat-password === CHAT_PASSWORD（一般使用者，前端密碼閘）
//   2. x-api-token     === CHAT_API_TOKEN（nuck_os 私人程式呼叫，不受限流）
export function safeEqual(a: string | null, b: string | undefined): boolean {
  if (!a || !b) return false
  const ba = Buffer.from(a), bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export type Access = { ok: true; byToken: boolean } | { ok: false; status: number; error: string }

/** 驗證密碼或私人 token；未設定 CHAT_PASSWORD 時整個功能暫停 */
export function checkAccess(req: NextRequest): Access {
  if (safeEqual(req.headers.get('x-api-token'), process.env.CHAT_API_TOKEN)) return { ok: true, byToken: true }
  if (!process.env.CHAT_PASSWORD) return { ok: false, status: 503, error: '尚未設定密碼，暫停服務' }
  if (!safeEqual(req.headers.get('x-chat-password'), process.env.CHAT_PASSWORD)) {
    return { ok: false, status: 401, error: '密碼錯誤' }
  }
  return { ok: true, byToken: false }
}

// ── 限流（in-memory）────────────────────────────────────
// Fluid Compute 會重用 instance，所以計數在 warm 期間有效；冷啟動歸零屬可接受的保守估算。
// 目的是擋「密碼外流後被刷」與「單人狂問」，不是精確計費。
// 同一個 instance 內 AI 問答與 AI 權重建議共用計數（不同 route 可能跑在不同 instance，屆時各自計算）。
const PER_IP_LIMIT   = Number(process.env.CHAT_IP_LIMIT_PER_HOUR ?? 10)   // 每 IP 每小時題數
const DAILY_LIMIT    = Number(process.env.CHAT_DAILY_LIMIT       ?? 200)  // 全站每日題數
const HOUR_MS = 60 * 60 * 1000

const ipHits = new Map<string, number[]>()           // ip → 最近一小時的時間戳
let dailyCount = 0
let dailyKey = ''                                    // 'YYYY-MM-DD'（台灣時間）

function todayKey() {
  return new Date(Date.now() + 8 * HOUR_MS).toISOString().slice(0, 10)
}

/** 回傳 null 表示放行，否則回傳拒絕原因 */
export function checkRateLimit(ip: string): string | null {
  const now = Date.now()

  // 每日總量（跨日自動歸零）
  const key = todayKey()
  if (key !== dailyKey) { dailyKey = key; dailyCount = 0 }
  if (dailyCount >= DAILY_LIMIT) return '今日 AI 額度已用完，明天再來吧'

  // 每 IP 每小時
  const hits = (ipHits.get(ip) ?? []).filter(t => now - t < HOUR_MS)
  if (hits.length >= PER_IP_LIMIT) return `每小時最多 ${PER_IP_LIMIT} 次，請稍後再試`

  hits.push(now)
  ipHits.set(ip, hits)
  dailyCount++

  // 順手清掉久未出現的 IP，避免 Map 無限成長
  if (ipHits.size > 1000) {
    for (const [k, v] of ipHits) if (!v.some(t => now - t < HOUR_MS)) ipHits.delete(k)
  }
  return null
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

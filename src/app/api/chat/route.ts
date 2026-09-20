import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { timingSafeEqual } from 'node:crypto'
import { runQueryRaw } from '@/lib/queries/client'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// ── 模型設定 ────────────────────────────────────────────
// 免費層每個模型各有獨立 RPD 上限（3.8-flash 免費層僅約 20 RPD，公開用會秒爆），
// text-to-SQL 用 flash-lite 等級即足夠；主模型打到 429 時自動切到 fallback。
const PRIMARY_MODEL  = process.env.GEMINI_MODEL          ?? 'gemini-3.5-flash-lite'
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-2.5-flash-lite'

function isQuotaError(err: unknown): boolean {
  const e = err as { status?: number; message?: string }
  return e?.status === 429 || /429|quota|RESOURCE_EXHAUSTED/i.test(e?.message ?? '')
}

/** 先用 first 模型，quota 爆了就換 fallback；回傳 { result, model } 讓前端知道實際用了哪個 */
async function withFallback<T>(
  fn: (modelId: string) => Promise<T>,
  first: string = PRIMARY_MODEL,
): Promise<{ result: T; model: string }> {
  try {
    return { result: await fn(first), model: first }
  } catch (err) {
    if (!isQuotaError(err) || first === FALLBACK_MODEL) throw err
    console.warn(`[chat] ${first} quota 用盡，改用 ${FALLBACK_MODEL}`)
    return { result: await fn(FALLBACK_MODEL), model: FALLBACK_MODEL }
  }
}

// ── 存取控制 ────────────────────────────────────────────
// 兩種放行方式：
//   1. x-chat-password === CHAT_PASSWORD（一般使用者，前端密碼閘）
//   2. x-api-token     === CHAT_API_TOKEN（nuck_os 私人程式呼叫，不受限流）
function safeEqual(a: string | null, b: string | undefined): boolean {
  if (!a || !b) return false
  const ba = Buffer.from(a), bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

// ── 限流（in-memory）────────────────────────────────────
// Fluid Compute 會重用 instance，所以計數在 warm 期間有效；冷啟動歸零屬可接受的保守估算。
// 目的是擋「密碼外流後被刷」與「單人狂問」，不是精確計費。
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
function checkRateLimit(ip: string): string | null {
  const now = Date.now()

  // 每日總量（跨日自動歸零）
  const key = todayKey()
  if (key !== dailyKey) { dailyKey = key; dailyCount = 0 }
  if (dailyCount >= DAILY_LIMIT) return '今日 AI 問答額度已用完，明天再來吧'

  // 每 IP 每小時
  const hits = (ipHits.get(ip) ?? []).filter(t => now - t < HOUR_MS)
  if (hits.length >= PER_IP_LIMIT) return `每小時最多 ${PER_IP_LIMIT} 題，請稍後再試`

  hits.push(now)
  ipHits.set(ip, hits)
  dailyCount++

  // 順手清掉久未出現的 IP，避免 Map 無限成長
  if (ipHits.size > 1000) {
    for (const [k, v] of ipHits) if (!v.some(t => now - t < HOUR_MS)) ipHits.delete(k)
  }
  return null
}

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

const DB_SCHEMA = `
你是台南市實價登錄資料分析師。資料庫有一個主要資料表 transactions，欄位如下：

基本欄位：
- district (text): 行政區，例如「東區」「永康區」「仁德區」「安平區」「中西區」
- transaction_date (date): 交易日期，格式 YYYY-MM-DD
- address (text): 地址
- is_presale (boolean): 是否為預售屋（true=預售屋，false=成屋）
- project_name (text): 建案名稱（預售屋專屬，例如「公園伯爵23」）
- unit_number (text): 棟及號（預售屋，例如「A棟6號」）
- source_season (text): 資料季別，例如「115S1」

價格欄位：
- total_price (bigint): 總價（元），換算萬元請除以 10000
- unit_price_sqm (numeric): 單價（元/平方公尺），換算萬元/坪：乘以 3.3058 再除以 10000
- parking_price (bigint): 車位總價（元）

面積欄位（平方公尺）：
- building_area_sqm (numeric): 建物總面積
- main_area (numeric): 主建物面積
- aux_area (numeric): 附屬建物面積
- balcony_area (numeric): 陽台面積
- land_area (numeric): 土地面積
- parking_area (numeric): 車位面積

建物欄位：
- building_type (text): 建物型態，例如「住宅大樓(11層含以上有電梯)」「透天厝」「公寓(5樓含以下無電梯)」「華廈(10層含以下有電梯)」
- main_material (text): 主要建材
- completion_date (text): 建築完成年月（民國格式）
- floor (text): 移轉層次
- total_floors (int): 總樓層數
- rooms (int): 房間數
- living_rooms (int): 廳數
- bathrooms (int): 衛浴數
- has_elevator (boolean): 是否有電梯
- has_management (boolean): 是否有管理組織
- main_use (text): 主要用途，例如「住家用」
- urban_land_use (text): 都市土地使用分區
- parking_type (text): 車位類別

有用的 View：
- district_monthly_stats: 行政區月統計（district, month, transaction_count, avg_unit_price, avg_total_price）
- yearly_overview: 全市年度統計（year, total_transactions, avg_unit_price, avg_total_price_wan）

重要換算：
- 總價（元）→ 萬元：除以 10000
- 單價（元/m²）→ 萬元/坪：× 3.3058 ÷ 10000
- 資料涵蓋民國110年（2021年）至今（2026年）
`

export interface ChartConfig {
  type: 'bar' | 'line'
  xKey: string
  yKeys: string[]
}

function detectChartConfig(rows: Record<string, unknown>[]): ChartConfig | null {
  if (rows.length < 2) return null
  const keys = Object.keys(rows[0])

  // 找時間軸 key
  const timeKey = keys.find(k =>
    /^(month|year|ym|quarter|date)$/i.test(k)
  )
  // 找分類 key
  const catKey = keys.find(k =>
    /^(district|building_type|type|rooms|行政區|類型|區域)$/.test(k)
  )

  // 找數值 key（排除分類和時間）
  const numKeys = keys.filter(k => {
    if (k === timeKey || k === catKey) return false
    const v = rows[0][k]
    return typeof v === 'number' ||
      (typeof v === 'string' && v !== '' && !isNaN(Number(v)))
  })

  if (!numKeys.length) return null

  if (timeKey) {
    return { type: 'line', xKey: timeKey, yKeys: numKeys.slice(0, 3) }
  }
  if (catKey && rows.length >= 2) {
    return { type: 'bar', xKey: catKey, yKeys: numKeys.slice(0, 2) }
  }
  return null
}

// 把全部 rows 壓縮成 Gemini 可讀的摘要，避免 token 爆炸
function buildRowSummary(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '（無資料）'

  const keys = Object.keys(rows[0])

  // 數值欄位 → 計算 avg / min / max
  const numStats: string[] = []
  for (const k of keys) {
    const vals = rows
      .map(r => Number(r[k]))
      .filter(v => !isNaN(v) && v !== 0)
    if (!vals.length) continue
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    numStats.push(`${k}：平均 ${avg.toFixed(1)}，最低 ${min.toFixed(1)}，最高 ${max.toFixed(1)}`)
  }

  // 文字欄位 → 頻率前5
  const catStats: string[] = []
  for (const k of keys) {
    const vals = rows.map(r => r[k]).filter(v => typeof v === 'string' && v)
    if (!vals.length) continue
    const freq: Record<string, number> = {}
    for (const v of vals) freq[String(v)] = (freq[String(v)] ?? 0) + 1
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
    catStats.push(`${k}：${top.map(([v, n]) => `${v}(${n}筆)`).join('、')}`)
  }

  const sampleRows = rows.slice(0, 20)

  return [
    numStats.length ? `數值統計：\n${numStats.join('\n')}` : '',
    catStats.length ? `類別分佈：\n${catStats.join('\n')}` : '',
    `前 ${sampleRows.length} 筆樣本：\n${JSON.stringify(sampleRows, null, 2)}`,
  ].filter(Boolean).join('\n\n')
}

interface HistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  // ── 存取控制 ──
  const byToken = safeEqual(req.headers.get('x-api-token'), process.env.CHAT_API_TOKEN)
  if (!byToken) {
    if (!process.env.CHAT_PASSWORD) {
      return Response.json({ error: 'AI 問答功能尚未設定密碼，暫停服務' }, { status: 503 })
    }
    if (!safeEqual(req.headers.get('x-chat-password'), process.env.CHAT_PASSWORD)) {
      return Response.json({ error: '密碼錯誤' }, { status: 401 })
    }
    // 私人 token 不限流；密碼使用者走限流
    const denied = checkRateLimit(clientIp(req))
    if (denied) return Response.json({ error: denied }, { status: 429 })
  }

  const body = await req.json()
  const question: string = body.question ?? ''
  const history: HistoryItem[] = body.history ?? []

  if (!question.trim()) {
    return Response.json({ error: '請輸入問題' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }

      try {
        // ── 對話歷史 context（最近4輪）──────────────────
        const recentHistory = history.slice(-8)
        const historyCtx = recentHistory.length
          ? '對話歷史（供參考）：\n' +
            recentHistory.map(h =>
              `${h.role === 'user' ? '使用者' : 'AI'}：${h.content}`
            ).join('\n') + '\n\n'
          : ''

        // ── Step 1：生成 SQL ─────────────────────────────
        const sqlPrompt = `${DB_SCHEMA}

${historyCtx}使用者問題：「${question}」

請根據以上資料庫結構，生成一條 PostgreSQL SELECT 查詢語句。
規則：
1. 只輸出純 SQL，不要任何說明文字或 markdown
2. 不要加 LIMIT，除非問題明確要求「前N名」或「最貴N筆」等排名性質查詢
3. 金額欄位記得換算（total_price ÷ 10000）
4. 單價換算：ROUND(unit_price_sqm * 3.3058 / 10000, 1)
5. 日期範圍預設為近 2 年，除非問題有指定
6. 只能 SELECT，不可 INSERT/UPDATE/DELETE/DROP
7. 若問題是追問（「那」「呢」「再看」等），請根據對話歷史理解指向`

        const { result: sqlRes, model: sqlModel } = await withFallback(id =>
          genAI.getGenerativeModel({ model: id }).generateContent(sqlPrompt)
        )
        let sql = sqlRes.response.text().trim()
        sql = sql.replace(/^```sql\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
        sql = sql.replace(/;\s*$/, '').trim()

        const lower = sql.toLowerCase()
        if (['insert', 'update', 'delete', 'drop', 'truncate', 'alter'].some(k => lower.includes(k))) {
          send({ type: 'error', message: '不支援修改類型的查詢' })
          controller.close()
          return
        }

        send({ type: 'sql', sql })

        // ── Step 2：執行 SQL ─────────────────────────────
        const { rows: queryRows, error: dbError } = await runQueryRaw(sql)

        let rows: Record<string, unknown>[] = []
        if (dbError) {
          console.error('[chat] DB error:', dbError.message)
          send({ type: 'db_error', message: dbError.message })
          // 繼續讓 AI 說明
        } else {
          rows = queryRows
        }

        const chart = detectChartConfig(rows)
        send({ type: 'rows', rows, chart })

        // ── Step 3：Streaming 自然語言回答 ──────────────
        // 傳給 Gemini 的是「摘要 + 前20筆樣本」，不傳全部（避免 token 爆炸）
        const rowSummary = buildRowSummary(rows)
        const answerPrompt = `使用者問題：「${question}」

查詢共回傳 ${rows.length} 筆資料。
${rowSummary}

${dbError ? `查詢時發生錯誤：${dbError.message}\n` : ''}
請用**繁體中文**、條列式方式回答使用者問題。
- 必須使用繁體中文，禁止出現簡體字
- 回答格式以「・」或「－」開頭的條列項目呈現，每點一個重點
- 金額請加「萬元」單位，數量加「筆」或「件」
- 數字盡量精確，並標明是平均值或總計
- 若結果為空，請說明可能原因
- 總結放在最後一條，以「📌 小結：」開頭`

        // 回答階段沿用生 SQL 成功的那個模型（主模型若已 429 就不再白打一次）
        const { result: answerStream, model: answerModel } = await withFallback(
          id => genAI.getGenerativeModel({ model: id }).generateContentStream(answerPrompt),
          sqlModel,
        )

        for await (const chunk of answerStream.stream) {
          const text = chunk.text()
          if (text) send({ type: 'text', delta: text })
        }

        send({ type: 'done', model: answerModel })
      } catch (err) {
        console.error('[chat] error:', err)
        send({
          type: 'error',
          message: isQuotaError(err) ? 'AI 模型今日免費額度已用完，請明天再試' : '查詢失敗，請稍後再試',
        })
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    }
  })
}

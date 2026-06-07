import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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

interface HistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

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
2. 結果最多回傳 20 筆
3. 金額欄位記得換算（total_price ÷ 10000）
4. 單價換算：ROUND(unit_price_sqm * 3.3058 / 10000, 1)
5. 日期範圍預設為近 2 年，除非問題有指定
6. 只能 SELECT，不可 INSERT/UPDATE/DELETE/DROP
7. 若問題是追問（「那」「呢」「再看」等），請根據對話歷史理解指向`

        const sqlRes = await model.generateContent(sqlPrompt)
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
        const { data: rpcResult, error: dbError } = await supabaseAdmin
          .rpc('execute_query', { query_text: sql })

        let rows: Record<string, unknown>[] = []
        if (dbError) {
          console.error('[chat] DB error:', dbError.message)
          send({ type: 'db_error', message: dbError.message })
          // 繼續讓 AI 說明
        } else {
          rows = Array.isArray(rpcResult) ? rpcResult : (rpcResult ? [rpcResult] : [])
        }

        const chart = detectChartConfig(rows)
        send({ type: 'rows', rows, chart })

        // ── Step 3：Streaming 自然語言回答 ──────────────
        const answerPrompt = `使用者問題：「${question}」

SQL 查詢結果（共 ${rows.length} 筆）：
${JSON.stringify(rows.slice(0, 15), null, 2)}

${dbError ? `查詢時發生錯誤：${dbError.message}\n` : ''}
請用繁體中文、口語化方式回答使用者問題。
- 金額請加「萬元」單位，數量加「筆」或「件」
- 若結果為空，請說明可能原因
- 回答簡潔有重點，100-200 字`

        const answerStream = await model.generateContentStream(answerPrompt)

        for await (const chunk of answerStream.stream) {
          const text = chunk.text()
          if (text) send({ type: 'text', delta: text })
        }

        send({ type: 'done' })
      } catch (err) {
        console.error('[chat] error:', err)
        send({ type: 'error', message: '查詢失敗，請稍後再試' })
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
